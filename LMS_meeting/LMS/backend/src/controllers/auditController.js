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

module.exports = {
  getSessionAuditLogs,
  createAuditLog,
};
