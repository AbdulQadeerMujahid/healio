const router = require('express').Router();
const { authRequired, requireRole } = require('../middleware/auth');
const { getOverview } = require('../controllers/adminController');

router.use(authRequired);
router.use(requireRole('admin'));

router.get('/overview', getOverview);

module.exports = router;
