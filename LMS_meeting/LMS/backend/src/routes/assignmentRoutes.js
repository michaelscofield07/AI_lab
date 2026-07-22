const express = require('express');
const router = express.Router();
const {
  createAssignment,
  getAssignmentById,
  runAssignmentCode,
  submitAssignment,
  getSubmissions,
} = require('../controllers/assignmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('teacher', 'admin'), createAssignment);

router.route('/:id')
  .get(protect, getAssignmentById);

router.route('/:id/run')
  .post(protect, runAssignmentCode);

router.route('/:id/submit')
  .post(protect, authorize('student'), submitAssignment);

router.route('/:id/submissions')
  .get(protect, getSubmissions);

module.exports = router;
