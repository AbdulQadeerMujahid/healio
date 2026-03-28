const { getSupabaseAdmin } = require('../config/supabase');
const { mapPatientNote } = require('../utils/formatters');

// Ensure doctor has relationship with patient
const verifyDoctorPatientAccess = async (doctorId, patientId) => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', doctorId)
    .eq('patient_id', patientId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
};

exports.listNotesForPatient = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { patientId } = req.params;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctors only.' });
    }

    const hasAccess = await verifyDoctorPatientAccess(req.user.id, patientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this patient.' });
    }

    const { data: notes, error } = await supabase
      .from('patient_notes')
      .select('*')
      .eq('doctor_id', req.user.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json((notes || []).map(mapPatientNote));
  } catch (error) {
    console.error('List patient notes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createNote = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { patientId, title, content } = req.body;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctors only.' });
    }

    if (!patientId || !content?.trim()) {
      return res.status(400).json({ message: 'Patient and content are required.' });
    }

    const hasAccess = await verifyDoctorPatientAccess(req.user.id, patientId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this patient.' });
    }

    const { data: note, error } = await supabase
      .from('patient_notes')
      .insert({
        doctor_id: req.user.id,
        patient_id: patientId,
        title: title?.trim() || null,
        content: content.trim(),
      })
      .select('*')
      .single();

    if (error) throw error;

    res.status(201).json(mapPatientNote(note));
  } catch (error) {
    console.error('Create patient note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;
    const { title, content } = req.body;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctors only.' });
    }

    const { data: existingNote, error: findError } = await supabase
      .from('patient_notes')
      .select('*')
      .eq('id', id)
      .eq('doctor_id', req.user.id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existingNote) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content.trim();

    const { data: note, error } = await supabase
      .from('patient_notes')
      .update(updates)
      .eq('id', id)
      .eq('doctor_id', req.user.id)
      .select('*')
      .single();

    if (error) throw error;

    res.json(mapPatientNote(note));
  } catch (error) {
    console.error('Update patient note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    const { id } = req.params;

    if (req.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctors only.' });
    }

    const { data: note, error } = await supabase
      .from('patient_notes')
      .delete()
      .eq('id', id)
      .eq('doctor_id', req.user.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete patient note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
