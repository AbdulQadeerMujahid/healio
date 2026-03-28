function mapUser(row) {
  if (!row) return null;

  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    specialization: row.specialization || null,
    experience: row.experience ?? null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function mapAppointment(row, usersById = {}) {
  if (!row) return null;

  const normalizeMessages = (items = []) =>
    items.map((item) => {
      const authorId = item?.author?._id || item?.author || item?.author_id || null;
      const author = authorId && usersById[authorId] ? mapUser(usersById[authorId]) : authorId ? { _id: authorId, id: authorId } : null;

      return {
        ...item,
        author,
        createdAt: item?.createdAt || item?.created_at || null,
      };
    });

  const patient = usersById[row.patient_id] ? mapUser(usersById[row.patient_id]) : row.patient_id ? { _id: row.patient_id, id: row.patient_id } : null;
  const doctor = usersById[row.doctor_id] ? mapUser(usersById[row.doctor_id]) : row.doctor_id ? { _id: row.doctor_id, id: row.doctor_id } : null;

  return {
    _id: row.id,
    id: row.id,
    patient,
    doctor,
    reason: row.reason,
    datetime: row.datetime,
    age: row.age,
    weight: row.weight,
    severity: row.severity,
    status: row.status,
    rescheduledTime: row.rescheduled_time || null,
    meetingLink: row.meeting_link || null,
    notes: normalizeMessages(Array.isArray(row.notes) ? row.notes : []),
    messages: normalizeMessages(Array.isArray(row.messages) ? row.messages : []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row) {
  if (!row) return null;

  return {
    _id: row.id,
    id: row.id,
    user: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data || {},
    read: !!row.read,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPatientNote(row) {
  if (!row) return null;

  return {
    _id: row.id,
    id: row.id,
    doctor: row.doctor_id,
    patient: row.patient_id,
    title: row.title || '',
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(row, usersById = {}, appointmentsById = {}, includeFileData = false) {
  if (!row) return null;

  const response = {
    _id: row.id,
    id: row.id,
    patient: row.patient_id,
    title: row.title,
    description: row.description || '',
    reportType: row.report_type,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: usersById[row.uploaded_by]
      ? {
          _id: usersById[row.uploaded_by].id,
          id: usersById[row.uploaded_by].id,
          name: usersById[row.uploaded_by].name,
          role: usersById[row.uploaded_by].role,
        }
      : row.uploaded_by
      ? { _id: row.uploaded_by, id: row.uploaded_by }
      : null,
    appointment:
      row.appointment_id && appointmentsById[row.appointment_id]
        ? {
            _id: appointmentsById[row.appointment_id].id,
            id: appointmentsById[row.appointment_id].id,
            datetime: appointmentsById[row.appointment_id].datetime,
            reason: appointmentsById[row.appointment_id].reason,
          }
        : row.appointment_id
        ? { _id: row.appointment_id, id: row.appointment_id }
        : null,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (includeFileData) {
    response.fileData = row.file_data;
  }

  return response;
}

module.exports = {
  mapUser,
  mapAppointment,
  mapNotification,
  mapPatientNote,
  mapReport,
};
