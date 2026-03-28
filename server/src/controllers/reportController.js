const { getSupabaseAdmin } = require('../config/supabase');
const { mapReport } = require('../utils/formatters');

const REPORT_SELECT = 'id, patient_id, title, description, report_type, file_data, file_name, file_type, file_size, uploaded_by, appointment_id, date, created_at, updated_at';

async function fetchUsersByIds(supabase, ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .in('id', uniqueIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

async function fetchAppointmentsByIds(supabase, ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('appointments')
    .select('id, datetime, reason')
    .in('id', uniqueIds);

  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
}

async function hydrateReports(supabase, rows = [], includeFileData = false) {
  const uploadedByIds = rows.map((r) => r.uploaded_by);
  const appointmentIds = rows.map((r) => r.appointment_id).filter(Boolean);

  const usersById = await fetchUsersByIds(supabase, uploadedByIds);
  const appointmentsById = await fetchAppointmentsByIds(supabase, appointmentIds);

  return rows.map((row) => mapReport(row, usersById, appointmentsById, includeFileData));
}

// Get all reports for the current user
exports.getAllReports = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .eq('patient_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reports = await hydrateReports(supabase, data || [], false);
    res.json(reports);
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Upload a new report
exports.uploadReport = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { title, description, reportType, fileData, fileName, fileType, fileSize, appointmentId } = req.body;

    if (!title || !fileData || !fileName || !fileType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate file size (max 5MB)
    if (fileSize > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'File size exceeds 5MB limit' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ message: 'Invalid file type. Only JPEG, PNG, and PDF are allowed' });
    }

    const { data: inserted, error } = await supabase
      .from('reports')
      .insert({
        patient_id: req.user.id,
        title,
        description: description || null,
        report_type: reportType || 'other',
        file_data: fileData,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        uploaded_by: req.user.id,
        appointment_id: appointmentId || null,
      })
      .select(REPORT_SELECT)
      .single();

    if (error) throw error;

    const [response] = await hydrateReports(supabase, [inserted], false);
    res.status(201).json(response);
  } catch (error) {
    console.error('Upload report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a specific report with file data
exports.getReportById = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: report, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check access permissions
    const isOwner = report.patient_id === req.user.id;
    let hasAccess = isOwner;

    // If user is a doctor, check if they have appointments with this patient
    if (req.user.role === 'doctor' && !isOwner) {
      const { data: hasAppointment, error: hasAppointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', req.user.id)
        .eq('patient_id', report.patient_id)
        .limit(1)
        .maybeSingle();

      if (hasAppointmentError) throw hasAppointmentError;
      hasAccess = !!hasAppointment;
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [response] = await hydrateReports(supabase, [report], true);
    res.json(response);
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a report
exports.deleteReport = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data: report, error: selectError } = await supabase
      .from('reports')
      .select('id')
      .eq('id', req.params.id)
      .eq('patient_id', req.user.id)
      .maybeSingle();

    if (selectError) throw selectError;

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const { error } = await supabase.from('reports').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get reports for a specific patient (Doctor access)
exports.getPatientReports = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { patientId } = req.params;

    // Verify the requesting user is a doctor
    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctors only.' });
    }

    // Optional: Verify doctor has appointments with this patient
    const { data: hasAppointment, error: hasAppointmentError } = await supabase
      .from('appointments')
      .select('id')
      .eq('doctor_id', req.user.id)
      .eq('patient_id', patientId)
      .limit(1)
      .maybeSingle();

    if (hasAppointmentError) throw hasAppointmentError;

    if (!hasAppointment) {
      return res.status(403).json({ message: 'You do not have access to this patient\'s reports' });
    }

    const { data: reportsRows, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const reports = await hydrateReports(supabase, reportsRows || [], false);

    res.json(reports);
  } catch (error) {
    console.error('Get patient reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
