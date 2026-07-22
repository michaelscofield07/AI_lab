const express = require('express');
const router = express.Router();
const {
  createSession,
  getSessions,
  getStudentSessions,
  getSessionById,
  joinSession,
  updateSessionStatus,
} = require('../controllers/sessionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Student: get sessions for their enrolled courses
router.route('/student')
  .get(protect, authorize('student'), getStudentSessions);

// Teacher: list all their sessions / create a new session
router.route('/')
  .get(protect, authorize('teacher', 'admin'), getSessions)
  .post(protect, authorize('teacher', 'admin'), createSession);

// Get single session (teacher only)
router.route('/:id')
  .get(protect, authorize('teacher', 'admin'), getSessionById);

// Student joins a session (password + enrollment check)
router.route('/:id/join')
  .post(protect, authorize('student'), joinSession);

// Update session status
router.route('/:id/status')
  .patch(protect, authorize('teacher', 'admin'), updateSessionStatus);

// Nested audit log routes
router.use('/:sessionId/audit-logs', require('./auditRoutes'));

module.exports = router;
