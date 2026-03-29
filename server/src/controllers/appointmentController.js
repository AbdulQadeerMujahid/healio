const { randomUUID } = require('crypto');
const { getSupabaseAdmin } = require('../config/supabase');
const { mapAppointment, mapUser, mapNotification } = require('../utils/formatters');

const APPOINTMENT_SELECT = 'id, patient_id, doctor_id, reason, datetime, age, weight, severity, status, rescheduled_time, meeting_link, notes, messages, created_at, updated_at';

async function fetchUsersByIds(supabase, ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, specialization, experience, created_at, updated_at')
    .in('id', uniqueIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

async function fetchAppointmentById(supabase, appointmentId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function buildAlertAssessment({ bpm, temperature }) {
  let score = 1;

  if (bpm >= 140 || bpm <= 45) score += 3;
  else if (bpm >= 125 || bpm <= 50) score += 2;
  else if (bpm >= 115 || bpm <= 55) score += 1;

  if (temperature >= 39 || temperature <= 35) score += 3;
  else if (temperature >= 38 || temperature <= 35.5) score += 2;
  else if (temperature >= 37.5 || temperature <= 36) score += 1;

  const severity = Math.max(1, Math.min(5, score));

  let risk = 'low';
  if (severity >= 5) risk = 'critical';
  else if (severity >= 4) risk = 'high';
  else if (severity >= 3) risk = 'moderate';

  let recommendation = 'Continue monitoring and hydration.';
  if (risk === 'critical') recommendation = 'Immediate doctor intervention recommended. Consider emergency care.';
  else if (risk === 'high') recommendation = 'Doctor review is required urgently within minutes.';
  else if (risk === 'moderate') recommendation = 'Doctor review advised soon and increase monitoring frequency.';

  return { severity, risk, recommendation };
}

async function fetchActiveAppointment(supabase, patientId) {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_SELECT)
    .eq('patient_id', patientId)
    .in('status', ['pending', 'accepted', 'rescheduled'])
    .order('datetime', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

exports.listDoctors = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, specialization, experience, created_at, updated_at')
      .eq('role', 'doctor')
      .order('name', { ascending: true });

    if (error) throw error;
    res.json((data || []).map(mapUser));
  } catch (err) {
    console.error('List doctors error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { doctorId, reason, datetime, age, weight, severity } = req.body;

    if (!doctorId || !reason || !datetime || !age || !weight || !severity) {
      return res.status(400).json({ message: 'Doctor, reason, datetime, age, weight, and severity are required' });
    }

    const { data: doctor, error: doctorError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', doctorId)
      .maybeSingle();

    if (doctorError) throw doctorError;
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    const parsedSeverity = parseInt(severity, 10);
    if (Number.isNaN(parsedSeverity) || parsedSeverity < 1 || parsedSeverity > 5) {
      return res.status(400).json({ message: 'Severity must be between 1 and 5' });
    }

    const { data: inserted, error } = await supabase
      .from('appointments')
      .insert({
        patient_id: req.user.id,
        doctor_id: doctorId,
        reason,
        datetime: new Date(datetime).toISOString(),
        age: parseInt(age, 10),
        weight: parseFloat(weight),
        severity: parsedSeverity,
        status: 'pending',
        notes: [],
        messages: [],
      })
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;

    const usersById = await fetchUsersByIds(supabase, [inserted.patient_id, inserted.doctor_id]);
    const appt = mapAppointment(inserted, usersById);
    
    req.io.to(`user:${doctorId}`).emit('appointment:new', appt);
    res.status(201).json(appt);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.myAppointments = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const role = req.user.role;
    const column = role === 'doctor' ? 'doctor_id' : 'patient_id';

    const { data, error } = await supabase
      .from('appointments')
      .select(APPOINTMENT_SELECT)
      .eq(column, req.user.id)
      .order('datetime', { ascending: false });

    if (error) throw error;

    const userIds = (data || []).flatMap((row) => [row.patient_id, row.doctor_id]);
    const usersById = await fetchUsersByIds(supabase, userIds);
    const list = (data || []).map((row) => mapAppointment(row, usersById));

    res.json(list);
  } catch (err) {
    console.error('My appointments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { status, newTime, meetingLink } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: 'Appointment id and status are required' });
    }

    const appt = await fetchAppointmentById(supabase, id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const isDoctor = req.user.role === 'doctor';
    const isPatient = req.user.role === 'patient';
    const isAssignedDoctor = appt.doctor_id === req.user.id;
    const isOwnerPatient = appt.patient_id === req.user.id;

    if (isDoctor && !isAssignedDoctor) {
      return res.status(403).json({ message: 'Only that doctor can update' });
    }

    if (isPatient) {
      if (!isOwnerPatient) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (status !== 'declined') {
        return res.status(403).json({ message: 'Patients can only cancel appointments' });
      }
    }

    const validStatuses = ['accepted', 'rescheduled', 'declined', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const update = {
      status,
    };

    if (isDoctor && newTime) {
      update.status = 'rescheduled';
      update.rescheduled_time = new Date(newTime).toISOString();
      update.datetime = new Date(newTime).toISOString();
    }

    if (isDoctor && meetingLink !== undefined) {
      update.meeting_link = meetingLink;
    }

    const { data: updatedRow, error } = await supabase
      .from('appointments')
      .update(update)
      .eq('id', id)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;

    const usersById = await fetchUsersByIds(supabase, [updatedRow.patient_id, updatedRow.doctor_id]);
    const updated = mapAppointment(updatedRow, usersById);

    // ✅ Notify patient
    req.io.to(`user:${updated.patient._id}`).emit('appointment:update', updated);

    // ✅ Notify doctor
    req.io.to(`user:${updated.doctor._id}`).emit('appointment:update', updated);

    res.json(updated);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Append a doctor note to an appointment
exports.addAppointmentNote = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const appt = await fetchAppointmentById(supabase, id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.doctor_id !== req.user.id) {
      return res.status(403).json({ message: 'Only that doctor can add notes' });
    }

    const notes = Array.isArray(appt.notes) ? [...appt.notes] : [];
    notes.push({
      _id: randomUUID(),
      author: req.user.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });

    const { data: updatedRow, error } = await supabase
      .from('appointments')
      .update({ notes })
      .eq('id', id)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;

    const usersById = await fetchUsersByIds(supabase, [updatedRow.patient_id, updatedRow.doctor_id, req.user.id]);
    const updated = mapAppointment(updatedRow, usersById);

    // Notify patient and doctor
    req.io.to(`user:${updated.patient._id}`).emit('appointment:update', updated);
    req.io.to(`user:${updated.doctor._id}`).emit('appointment:update', updated);

    res.json(updated);
  } catch (err) {
    console.error('Add note error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get messages for an appointment
exports.getMessages = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    const appt = await fetchAppointmentById(supabase, id);

    if (!appt) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Check user has access to this appointment
    if (appt.patient_id !== req.user.id && appt.doctor_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = Array.isArray(appt.messages) ? appt.messages : [];
    const authorIds = messages.map((m) => m?.author?._id || m?.author || m?.author_id).filter(Boolean);
    const usersById = await fetchUsersByIds(supabase, [...authorIds]);

    const normalized = messages.map((message) => {
      const authorId = message?.author?._id || message?.author || message?.author_id;
      const mappedAuthor = authorId && usersById[authorId] ? mapUser(usersById[authorId]) : authorId ? { _id: authorId, id: authorId } : null;

      return {
        ...message,
        _id: message._id || randomUUID(),
        author: mappedAuthor,
        createdAt: message.createdAt || message.created_at || null,
      };
    });

    res.json(normalized);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a chat message (doctor or patient) while appointment is active
exports.sendMessage = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Message text required' });

    const appt = await fetchAppointmentById(supabase, id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    // Only doctor or patient involved can send
    if (appt.doctor_id !== req.user.id && appt.patient_id !== req.user.id) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    // Only while not completed/declined
    if (appt.status === 'completed' || appt.status === 'declined') {
      return res.status(400).json({ message: 'Chat closed for this appointment' });
    }

    const trimmed = text.trim();
    const messages = Array.isArray(appt.messages) ? [...appt.messages] : [];
    messages.push({
      _id: randomUUID(),
      author: req.user.id,
      text: trimmed,
      createdAt: new Date().toISOString(),
    });

    const { data: updatedRow, error } = await supabase
      .from('appointments')
      .update({ messages })
      .eq('id', id)
      .select(APPOINTMENT_SELECT)
      .single();

    if (error) throw error;

    const messageAuthorIds = (updatedRow.messages || []).map((m) => m?.author?._id || m?.author || m?.author_id).filter(Boolean);
    const usersById = await fetchUsersByIds(supabase, [updatedRow.patient_id, updatedRow.doctor_id, ...messageAuthorIds]);
    const updated = mapAppointment(updatedRow, usersById);

    const senderId = req.user.id;
    const senderRole = req.user.role;
    const patientId = updated.patient?._id;
    const doctorId = updated.doctor?._id;
    const recipientId = senderId === doctorId ? patientId : doctorId;

    if (recipientId) {
      try {
        const senderName = senderId === doctorId ? updated.doctor?.name : updated.patient?.name;
        const { data: notificationRow, error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: recipientId,
            type: 'message',
            title: `New message from ${senderName || 'your contact'}`,
            body: trimmed,
            data: {
              appointmentId: updated._id,
              senderId,
              senderRole,
            },
            read: false,
          })
          .select('*')
          .single();

        if (notificationError) throw notificationError;

        req.io.to(`user:${recipientId}`).emit('notification:new', mapNotification(notificationRow));
      } catch (notificationErr) {
        console.error('Notification creation error:', notificationErr);
      }
    }

    req.io.to(`user:${updated.patient._id}`).emit('appointment:update', updated);
    req.io.to(`user:${updated.doctor._id}`).emit('appointment:update', updated);

    res.json(updated);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.escalateVitalsAlert = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const bpm = Number(req.body?.bpm);
    const temperature = Number(req.body?.temperature ?? req.body?.temp);
    const ecgSeries = Array.isArray(req.body?.ecgSeries) ? req.body.ecgSeries.slice(-120) : [];

    if (!Number.isFinite(bpm) || !Number.isFinite(temperature)) {
      return res.status(400).json({ message: 'Valid bpm and temperature are required' });
    }

    const assessment = buildAlertAssessment({ bpm, temperature });
    const nowIso = new Date().toISOString();

    const activeAppointment = await fetchActiveAppointment(supabase, req.user.id);
    let updatedAppointment = null;

    if (activeAppointment) {
      const currentSeverity = Number(activeAppointment.severity || 1);
      const escalatedSeverity = Math.max(currentSeverity, assessment.severity);

      const notes = Array.isArray(activeAppointment.notes) ? [...activeAppointment.notes] : [];
      notes.push({
        _id: randomUUID(),
        author: req.user.id,
        text: `AUTO-ALERT (${assessment.risk.toUpperCase()}): BPM ${bpm}, Temp ${temperature}. Severity adjusted to ${escalatedSeverity}. ${assessment.recommendation}`,
        createdAt: nowIso,
      });

      const { data: updatedRow, error: updateError } = await supabase
        .from('appointments')
        .update({ severity: escalatedSeverity, notes })
        .eq('id', activeAppointment.id)
        .select(APPOINTMENT_SELECT)
        .single();

      if (updateError) throw updateError;

      const usersById = await fetchUsersByIds(supabase, [updatedRow.patient_id, updatedRow.doctor_id]);
      updatedAppointment = mapAppointment(updatedRow, usersById);

      req.io.to(`user:${updatedAppointment.patient?._id}`).emit('appointment:update', updatedAppointment);
      req.io.to(`user:${updatedAppointment.doctor?._id}`).emit('appointment:update', updatedAppointment);

      if (updatedAppointment?.doctor?._id) {
        const { data: notificationRow, error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: updatedAppointment.doctor._id,
            type: 'critical_alert',
            title: `Patient alert: ${req.user.name || 'Patient'}`,
            body: `BPM ${bpm}, Temp ${temperature}C, Severity ${Math.max(currentSeverity, assessment.severity)} (${assessment.risk}).`,
            data: {
              appointmentId: updatedAppointment._id,
              patientId: req.user.id,
              bpm,
              temperature,
              risk: assessment.risk,
            },
            read: false,
          })
          .select('*')
          .single();

        if (notificationError) throw notificationError;
        req.io.to(`user:${updatedAppointment.doctor._id}`).emit('notification:new', mapNotification(notificationRow));
      }
    }

    const reportPayload = {
      generatedAt: nowIso,
      patient: { id: req.user.id, name: req.user.name || null },
      vitals: { bpm, temperature },
      assessment,
      appointmentId: updatedAppointment?._id || null,
      ecgSeries,
    };

    const reportJson = JSON.stringify(reportPayload, null, 2);

    const { data: insertedReport, error: reportError } = await supabase
      .from('reports')
      .insert({
        patient_id: req.user.id,
        title: `Automated Vitals Alert - ${new Date().toLocaleString()}`,
        description: `Risk: ${assessment.risk.toUpperCase()}. ${assessment.recommendation}`,
        report_type: 'other',
        file_data: Buffer.from(reportJson, 'utf8').toString('base64'),
        file_name: `vitals-alert-${Date.now()}.json`,
        file_type: 'application/json',
        file_size: Buffer.byteLength(reportJson, 'utf8'),
        uploaded_by: req.user.id,
        appointment_id: updatedAppointment?._id || null,
        date: nowIso,
      })
      .select('id, title, description, report_type, file_name, file_type, file_size, appointment_id, created_at')
      .single();

    if (reportError) throw reportError;

    res.json({
      ok: true,
      assessment,
      appointment: updatedAppointment,
      report: {
        _id: insertedReport.id,
        title: insertedReport.title,
        description: insertedReport.description,
        reportType: insertedReport.report_type,
        fileName: insertedReport.file_name,
        fileType: insertedReport.file_type,
        fileSize: insertedReport.file_size,
        appointment: insertedReport.appointment_id,
        createdAt: insertedReport.created_at,
      },
    });
  } catch (err) {
    console.error('Escalate vitals alert error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

