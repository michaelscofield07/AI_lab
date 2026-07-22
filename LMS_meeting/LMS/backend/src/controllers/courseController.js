const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const Result = require('../models/Result');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Private
const getCourses = async (req, res) => {
  try {
    let courses;

    if (req.user.role === 'teacher') {
      // Teachers see their own courses
      courses = await Course.find({ teacher: req.user._id })
        .populate('teacher', 'name email')
        .populate('studentsEnrolled', 'name email');
    } else if (req.user.role === 'admin') {
      // Admins see all courses
      courses = await Course.find()
        .populate('teacher', 'name email')
        .populate('studentsEnrolled', 'name email');
    } else {
      // Students see all available courses
      courses = await Course.find()
        .populate('teacher', 'name email');
    }

    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get course by ID
// @route   GET /api/courses/:id
// @access  Private
const getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('studentsEnrolled', 'name email');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Verify student is enrolled OR user is the teacher of this course OR user is admin
    const isTeacher = course.teacher._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const isEnrolled = course.studentsEnrolled.some(
      (student) => student._id.toString() === req.user._id.toString()
    );

    if (!isTeacher && !isAdmin && !isEnrolled) {
      return res.status(403).json({ message: 'Not enrolled in this course' });
    }

    // Fetch assignments and quizzes for this course
    const assignments = await Assignment.find({ course: course._id });
    const quizzes = await Quiz.find({ course: course._id }).select('-questions.correctAnswerIndex'); 
    // ^ Exclude correct answer index for students? Actually, since it's a demo, we can just hide correct answers from the list
    // or select only basic details. We'll load the answers only during quiz grading or if the user is a teacher.
    
    // For student: check their quiz results and assignment submissions
    let submissions = [];
    let results = [];
    if (req.user.role === 'student') {
      submissions = await Submission.find({ student: req.user._id, assignment: { $in: assignments.map(a => a._id) } });
      results = await Result.find({ student: req.user._id, quiz: { $in: quizzes.map(q => q._id) } });
    }

    res.json({
      course,
      assignments,
      quizzes,
      studentData: {
        submissions,
        results
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a course
// @route   POST /api/courses
// @access  Private (Teacher or Admin)
const createCourse = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Please add a title and description' });
    }

    const course = await Course.create({
      title,
      description,
      teacher: req.user._id,
      studentsEnrolled: [],
    });

    const populatedCourse = await Course.findById(course._id).populate('teacher', 'name email');

    res.status(201).json(populatedCourse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Enroll in a course
// @route   POST /api/courses/:id/enroll
// @access  Private (Student only)
const enrollInCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if student is already enrolled
    const alreadyEnrolled = course.studentsEnrolled.some(
      (studentId) => studentId.toString() === req.user._id.toString()
    );

    if (alreadyEnrolled) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    course.studentsEnrolled.push(req.user._id);
    await course.save();

    res.json({ message: 'Enrolled successfully', courseId: course._id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  enrollInCourse,
};
