const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Course = require('../models/Course');
const { runCode } = require('../utils/codeRunner');

// @desc    Create a coding assignment
// @route   POST /api/assignments
// @access  Private (Teacher or Admin)
const createAssignment = async (req, res) => {
  try {
    const { course, title, description, starterCode, language, testCases } = req.body;

    if (!course || !title || !description || !testCases || testCases.length === 0) {
      return res.status(400).json({ message: 'Please provide course, title, description, and test cases' });
    }

    // Verify course exists and belongs to the teacher
    const courseObj = await Course.findById(course);
    if (!courseObj) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (courseObj.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to add assignments to this course' });
    }

    const assignment = await Assignment.create({
      course,
      title,
      description,
      starterCode: starterCode || '',
      language: language || 'javascript',
      testCases,
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get assignment by ID
// @route   GET /api/assignments/:id
// @access  Private
const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Run code against test cases (No save to DB)
// @route   POST /api/assignments/:id/run
// @access  Private
const runAssignmentCode = async (req, res) => {
  try {
    const { code, language } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (!code) {
      return res.status(400).json({ message: 'Please provide code to run' });
    }

    const runResult = runCode(code, assignment.testCases, language || assignment.language);

    res.json(runResult);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit code (Runs and saves to DB)
// @route   POST /api/assignments/:id/submit
// @access  Private (Student only)
const submitAssignment = async (req, res) => {
  try {
    const { code, language } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (!code) {
      return res.status(400).json({ message: 'Please provide code to submit' });
    }

    const runResult = runCode(code, assignment.testCases, language || assignment.language);

    // Save submission to database
    const submission = await Submission.create({
      student: req.user._id,
      assignment: assignment._id,
      code,
      language: language || assignment.language,
      status: runResult.status,
      output: runResult.consoleOutput,
      testCasesPassed: runResult.passedCount,
      testCasesTotal: runResult.totalCount,
    });

    res.status(201).json({
      submission,
      runResult,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get submissions for an assignment
// @route   GET /api/assignments/:id/submissions
// @access  Private
const getSubmissions = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    let submissions;

    if (req.user.role === 'student') {
      // Students see their own submissions
      submissions = await Submission.find({
        assignment: req.params.id,
        student: req.user._id,
      }).sort({ createdAt: -1 });
    } else {
      // Teachers and Admins see all submissions
      submissions = await Submission.find({ assignment: req.params.id })
        .populate('student', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json(submissions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createAssignment,
  getAssignmentById,
  runAssignmentCode,
  submitAssignment,
  getSubmissions,
};
