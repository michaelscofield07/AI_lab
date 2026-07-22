const Quiz = require('../models/Quiz');
const Result = require('../models/Result');
const Course = require('../models/Course');

// @desc    Create a quiz
// @route   POST /api/quizzes
// @access  Private (Teacher or Admin)
const createQuiz = async (req, res) => {
  try {
    const { course, title, description, durationMinutes, questions } = req.body;

    if (!course || !title || !description || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Please provide course, title, description, and questions' });
    }

    // Verify course exists and belongs to the teacher
    const courseObj = await Course.findById(course);
    if (!courseObj) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (courseObj.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to add quizzes to this course' });
    }

    const quiz = await Quiz.create({
      course,
      title,
      description,
      durationMinutes: durationMinutes || 30,
      questions,
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get quiz by ID
// @route   GET /api/quizzes/:id
// @access  Private
const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Secure correct answers: strip correctAnswerIndex for student roles
    if (req.user.role === 'student') {
      const sanitizedQuestions = quiz.questions.map((q) => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
      }));

      return res.json({
        _id: quiz._id,
        course: quiz.course,
        title: quiz.title,
        description: quiz.description,
        durationMinutes: quiz.durationMinutes,
        questions: sanitizedQuestions,
      });
    }

    res.json(quiz);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit quiz answers and score them
// @route   POST /api/quizzes/:id/submit
// @access  Private (Student only)
const submitQuiz = async (req, res) => {
  try {
    const { answers } = req.body; // Array of { questionIndex: Number, selectedAnswerIndex: Number }
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Please provide answers array' });
    }

    let correctCount = 0;
    const gradedAnswers = quiz.questions.map((question, idx) => {
      // Find matching student answer
      const studentAns = answers.find((ans) => ans.questionIndex === idx);
      const selectedAnswerIndex = studentAns ? studentAns.selectedAnswerIndex : -1;
      const isCorrect = selectedAnswerIndex === question.correctAnswerIndex;

      if (isCorrect) {
        correctCount++;
      }

      return {
        questionIndex: idx,
        selectedAnswerIndex,
        isCorrect,
      };
    });

    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);

    const result = await Result.create({
      student: req.user._id,
      quiz: quiz._id,
      score: correctCount,
      totalQuestions,
      percentage,
      answers: gradedAnswers,
    });

    res.status(201).json({
      result,
      correctAnswers: quiz.questions.map((q) => q.correctAnswerIndex), // Return correct keys to let student see their results page
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get results for a quiz
// @route   GET /api/quizzes/:id/results
// @access  Private
const getQuizResults = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    let results;

    if (req.user.role === 'student') {
      // Students see their own results
      results = await Result.find({
        quiz: req.params.id,
        student: req.user._id,
      }).sort({ createdAt: -1 });
    } else {
      // Teachers and Admins see all results
      results = await Result.find({ quiz: req.params.id })
        .populate('student', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createQuiz,
  getQuizById,
  submitQuiz,
  getQuizResults,
};
