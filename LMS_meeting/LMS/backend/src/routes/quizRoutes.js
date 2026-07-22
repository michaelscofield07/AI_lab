const express = require('express');
const router = express.Router();
const {
  createQuiz,
  getQuizById,
  submitQuiz,
  getQuizResults,
} = require('../controllers/quizController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .post(protect, authorize('teacher', 'admin'), createQuiz);

router.route('/:id')
  .get(protect, getQuizById);

router.route('/:id/submit')
  .post(protect, authorize('student'), submitQuiz);

router.route('/:id/results')
  .get(protect, getQuizResults);

module.exports = router;
