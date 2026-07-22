const express = require('express');
const router = express.Router();
const {
  getCourses,
  getCourseById,
  createCourse,
  enrollInCourse,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getCourses)
  .post(protect, authorize('teacher', 'admin'), createCourse);

router.route('/:id').get(protect, getCourseById);
router.route('/:id/enroll').post(protect, authorize('student'), enrollInCourse);

module.exports = router;
