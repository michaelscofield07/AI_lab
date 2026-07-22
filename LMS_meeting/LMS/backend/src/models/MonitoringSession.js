const mongoose = require('mongoose');

const monitoringSessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a session title'],
      trim: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Auto-populated from course.studentsEnrolled at session creation time
    enrolledStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    durationMinutes: {
      type: Number,
      default: 60,
    },
    // Password students enter to join (stored as bcrypt hash)
    sessionPassword: {
      type: String,
      default: '',
    },
    // SentryClass agent config (kept for Python agent integration)
    blacklistedApps: {
      type: [String],
      default: [],
    },
    blacklistedKeywords: {
      type: [String],
      default: [],
    },
    behavioralMonitoring: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'ended'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('MonitoringSession', monitoringSessionSchema);

