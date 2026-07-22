const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonitoringSession',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    studentName: {
      type: String,
      default: '',
    },
    eventType: {
      type: String,
      enum: ['SCREENSHOT_CHANGE', 'SCREENSHOT_ANOMALY', 'BEHAVIORAL_ANOMALY'],
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    combinedRisk: {
      type: Number,
      required: true,
    },
    outputCode: {
      type: String, // e.g., "y38.5" or "r72.1"
      required: true,
    },
    evidenceFrame: {
      type: String, // Compressed base64 JPEG image payload
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
    popupTriggered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
