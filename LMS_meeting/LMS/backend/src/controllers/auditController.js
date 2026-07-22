const AuditLog = require('../models/AuditLog');

// @desc    Get all audit logs for a session
// @route   GET /api/sessions/:sessionId/audit-logs
// @access  Private (Teacher or Admin)
const getSessionAuditLogs = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const logs = await AuditLog.find({ session: sessionId })
      .populate('student', 'name email')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ message: 'Server error fetching audit logs' });
  }
};

// @desc    Create an audit log manually via REST API if needed
// @route   POST /api/sessions/:sessionId/audit-logs
// @access  Private
const createAuditLog = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      studentId,
      studentName,
      eventType,
      score,
      combinedRisk,
      outputCode,
      evidenceFrame,
      reason,
      popupTriggered,
    } = req.body;

    const newLog = await AuditLog.create({
      session: sessionId,
      student: studentId || req.user._id,
      studentName: studentName || req.user.name,
      eventType,
      score,
      combinedRisk,
      outputCode,
      evidenceFrame,
      reason,
      popupTriggered: !!popupTriggered,
    });

    res.status(201).json(newLog);
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ message: 'Server error creating audit log' });
  }
};

// @desc    Get all audit logs for a specific student across sessions
// @route   GET /api/sessions/user/:studentId/audit-logs
// @access  Private (Teacher, Admin, or the Student themselves)
const getStudentAuditLogs = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Students can only view their own logs unless teacher/admin
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({ message: 'Not authorized to view these audit logs' });
    }

    const logs = await AuditLog.find({ student: studentId })
      .populate('session', 'title course')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching student audit logs:', error);
    res.status(500).json({ message: 'Server error fetching student audit logs' });
  }
};

module.exports = {
  getSessionAuditLogs,
  createAuditLog,
  getStudentAuditLogs,
};

