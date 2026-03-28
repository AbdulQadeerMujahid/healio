const router = require('express').Router();
const { authRequired, requireRole } = require('../middleware/auth');
const { listDoctors, createAppointment, myAppointments, updateAppointmentStatus, addAppointmentNote, getMessages, sendMessage } = require('../controllers/appointmentController');

router.get('/doctors', authRequired, listDoctors);
router.post('/', authRequired, requireRole('patient'), createAppointment);
router.get('/me', authRequired, myAppointments);
router.patch('/:id', authRequired, updateAppointmentStatus);
router.post('/:id/notes', authRequired, requireRole('doctor'), addAppointmentNote);
router.get('/:id/messages', authRequired, getMessages);
router.post('/:id/messages', authRequired, sendMessage);

module.exports = router;
