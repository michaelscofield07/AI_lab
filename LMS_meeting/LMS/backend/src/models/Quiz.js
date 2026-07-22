const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a quiz title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add quiz instructions'],
    },
    durationMinutes: {
      type: Number,
      default: 30,
    },
    questions: [
      {
        questionText: {
          type: String,
          required: true,
        },
        options: [
          {
            type: String,
            required: true,
          },
        ],
        correctAnswerIndex: {
          type: Number,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Quiz', quizSchema);
