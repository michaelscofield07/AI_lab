const MonitoringSession = require('../models/MonitoringSession');
const Course = require('../models/Course');
const bcrypt = require('bcryptjs');

// @desc    Create a new monitoring session
// @route   POST /api/sessions
// @access  Private (Teacher or Admin)
const createSession = async (req, res) => {
  try {
    const {
      title,
      course,
      durationMinutes,
      sessionPassword,
      blacklistedApps,
      blacklistedKeywords,
      behavioralMonitoring,
      quiz,
      assignment,
    } = req.body;

    if (!title || !course) {
      return res.status(400).json({ message: 'Please provide a session title and course' });
    }

    // Verify course exists and belongs to this teacher
    const courseObj = await Course.findById(course).populate('studentsEnrolled', 'name email');
    if (!courseObj) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (courseObj.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to create sessions for this course' });
    }

    // Hash password if provided
    let hashedPassword = '';
    if (sessionPassword && sessionPassword.trim()) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(sessionPassword.trim(), salt);
    }

    // Parse comma-separated strings into arrays if needed
    const appsArray = typeof blacklistedApps === 'string'
      ? blacklistedApps.split(',').map(s => s.trim()).filter(Boolean)
      : blacklistedApps || [];

    const keywordsArray = typeof blacklistedKeywords === 'string'
      ? blacklistedKeywords.split(',').map(s => s.trim()).filter(Boolean)
      : blacklistedKeywords || [];

    // Auto-pull enrolled students from the course
    const enrolledStudents = courseObj.studentsEnrolled.map(s => s._id);

    const session = await MonitoringSession.create({
      title,
      course,
      teacher: req.user._id,
      enrolledStudents,
      durationMinutes: durationMinutes || 60,
      sessionPassword: hashedPassword,
      blacklistedApps: appsArray,
      blacklistedKeywords: keywordsArray,
      behavioralMonitoring: behavioralMonitoring !== undefined ? behavioralMonitoring : true,
      quiz: quiz || null,
      assignment: assignment || null,
      status: 'pending',
    });

    const populated = await MonitoringSession.findById(session._id)
      .populate('course', 'title')
      .populate('quiz')
      .populate('assignment')
      .populate('enrolledStudents', 'name email');

    // Strip hashed password from response
    const result = populated.toObject();
    delete result.sessionPassword;

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all sessions for this teacher
// @route   GET /api/sessions
// @access  Private (Teacher or Admin)
const getSessions = async (req, res) => {
  try {
    const sessions = await MonitoringSession.find({ teacher: req.user._id })
      .populate('course', 'title')
      .populate('quiz', 'title questions')
      .populate('assignment', 'title language')
      .populate('enrolledStudents', 'name email')
      .sort({ createdAt: -1 });

    // Strip passwords from all sessions
    const result = sessions.map(s => {
      const obj = s.toObject();
      delete obj.sessionPassword;
      return obj;
    });

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get sessions for enrolled student's courses (pending + active only)
// @route   GET /api/sessions/student
// @access  Private (Student)
const getStudentSessions = async (req, res) => {
  try {
    // Find all courses this student is enrolled in
    const courses = await Course.find({ studentsEnrolled: req.user._id }).select('_id');
    const courseIds = courses.map(c => c._id);

    // Find pending/active sessions for those courses
    const sessions = await MonitoringSession.find({
      course: { $in: courseIds },
      status: { $in: ['pending', 'active'] },
    })
      .populate('course', 'title')
      .populate('teacher', 'name email')
      .populate('quiz')
      .populate('assignment')
      .select('-sessionPassword -blacklistedApps -blacklistedKeywords')
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single session by ID
// @route   GET /api/sessions/:id
// @access  Private
const getSessionById = async (req, res) => {
  try {
    const session = await MonitoringSession.findById(req.params.id)
      .populate('course', 'title description')
      .populate('enrolledStudents', 'name email')
      .populate('quiz')
      .populate('assignment')
      .populate('teacher', 'name email');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Allow only the teacher who created it or an admin
    if (session.teacher._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this session' });
    }

    const result = session.toObject();
    delete result.sessionPassword;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Student joins a session (validates password + enrollment)
// @route   POST /api/sessions/:id/join
// @access  Private (Student)
const joinSession = async (req, res) => {
  try {
    const { password } = req.body;

    const session = await MonitoringSession.findById(req.params.id)
      .populate('course', 'title')
      .populate('teacher', 'name email')
      .populate('quiz')
      .populate('assignment')
      .populate('enrolledStudents', '_id name email');

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'ended') {
      return res.status(400).json({ message: 'This session has already ended' });
    }

    // Check student is enrolled (either in session snapshot OR in course dynamically)
    const courseObj = await Course.findById(session.course._id || session.course);
    const isEnrolledInCourse = courseObj && courseObj.studentsEnrolled.some(
      sId => sId.toString() === req.user._id.toString()
    );
    const isEnrolled = session.enrolledStudents.some(
      s => s._id.toString() === req.user._id.toString()
    ) || isEnrolledInCourse;
    if (!isEnrolled) {
      return res.status(403).json({ message: 'You are not enrolled in the course for this session' });
    }

    // Check password if session has one
    if (session.sessionPassword) {
      if (!password) {
        return res.status(401).json({ message: 'This session requires a password' });
      }
      const isMatch = await bcrypt.compare(password, session.sessionPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect session password' });
      }
    }

    // Return safe session config (no password hash)
    res.json({
      _id: session._id,
      title: session.title,
      course: session.course,
      teacher: session.teacher,
      durationMinutes: session.durationMinutes,
      behavioralMonitoring: session.behavioralMonitoring,
      quiz: session.quiz,
      assignment: session.assignment,
      status: session.status,
      enrolledStudents: session.enrolledStudents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update session status (pending -> active -> ended)
// @route   PATCH /api/sessions/:id/status
// @access  Private (Teacher or Admin)
const updateSessionStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'active', 'ended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be pending, active, or ended.' });
    }

    const session = await MonitoringSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.teacher.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this session' });
    }

    session.status = status;
    await session.save();

    const updated = await MonitoringSession.findById(session._id)
      .populate('course', 'title')
      .populate('enrolledStudents', 'name email');

    const result = updated.toObject();
    delete result.sessionPassword;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createSession,
  getSessions,
  getStudentSessions,
  getSessionById,
  joinSession,
  updateSessionStatus,
};
