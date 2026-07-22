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
        questionType: {
          type: String,
          enum: ['choice', 'paragraph'],
          default: 'choice',
        },
        questionText: {
          type: String,
          required: true,
        },
        options: [
          {
            type: String,
          },
        ],
        correctAnswerIndex: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Quiz', quizSchema);
