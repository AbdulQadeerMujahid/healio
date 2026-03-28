const { getSupabaseAdmin } = require('../config/supabase');
const { mapUser, mapAppointment } = require('../utils/formatters');

const APPOINTMENT_SELECT = 'id, patient_id, doctor_id, reason, datetime, age, weight, severity, status, rescheduled_time, meeting_link, notes, messages, created_at, updated_at';

exports.getOverview = async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();

    const [{ data: users, error: usersError }, { data: appointmentRows, error: appointmentsError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, specialization, experience, created_at, updated_at')
        .order('name', { ascending: true }),
      supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .order('datetime', { ascending: false }),
    ]);

    if (usersError) throw usersError;
    if (appointmentsError) throw appointmentsError;

    const usersById = (users || []).reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});

    const doctors = (users || []).filter((u) => u.role === 'doctor').map(mapUser);
    const patients = (users || []).filter((u) => u.role === 'patient').map(mapUser);

    const appointments = (appointmentRows || []).map((row) => mapAppointment(row, usersById));

    const statusCount = appointments.reduce(
      (acc, item) => {
        const key = item.status || 'pending';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      { pending: 0, accepted: 0, rescheduled: 0, declined: 0, completed: 0 }
    );

    const doctorMap = doctors.map((doctor) => {
      const doctorAppointments = appointments.filter((a) => a.doctor?._id === doctor._id);
      const uniquePatientsById = doctorAppointments.reduce((acc, appt) => {
        if (appt.patient?._id) {
          acc[appt.patient._id] = appt.patient;
        }
        return acc;
      }, {});

      return {
        ...doctor,
        appointmentCount: doctorAppointments.length,
        patientCount: Object.keys(uniquePatientsById).length,
        patients: Object.values(uniquePatientsById),
        appointments: doctorAppointments,
      };
    });

    res.json({
      summary: {
        totalDoctors: doctors.length,
        totalPatients: patients.length,
        totalAppointments: appointments.length,
        ...statusCount,
      },
      doctors: doctorMap,
      patients,
      appointments,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
