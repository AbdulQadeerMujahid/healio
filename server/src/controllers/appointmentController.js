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

