const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getAllUsers,
  updateUserRole,
  deleteUser,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin'));

router.route('/stats').get(getAdminStats);
router.route('/users').get(getAllUsers);
router.route('/users/:id/role').put(updateUserRole);
router.route('/users/:id').delete(deleteUser);

module.exports = router;
