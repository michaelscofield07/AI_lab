const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const AuditLog = require('./models/AuditLog');

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Basic sanity check route
app.get('/', (req, res) => {
  res.json({ message: 'LMS API is running...' });
});

// Mount REST Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/courses', require('./routes/courseRoutes'));
app.use('/api/assignments', require('./routes/assignmentRoutes'));
app.use('/api/quizzes', require('./routes/quizRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Not Found - ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// --- Socket.IO Setup ---
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  // Enable binary transport for screen frames (avoids base64 overhead)
  transports: ['websocket'],
});

// In-memory store: sessionId → { teacher: socketId, students: { socketId: { userId, name } } }
const sessionRooms = {};

io.on('connection', (socket) => {
  // -------------------------------------------------------------------
  // JOIN SESSION ROOM
  // Payload: { sessionId, userId, userName, role: 'teacher' | 'student' }
  // -------------------------------------------------------------------
  socket.on('join-session', ({ sessionId, userId, userName, role }) => {
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.userId = userId;
    socket.userName = userName;
    socket.role = role;

    if (!sessionRooms[sessionId]) {
      sessionRooms[sessionId] = { teacher: null, students: {} };
    }

    if (role === 'teacher') {
      sessionRooms[sessionId].teacher = socket.id;
    } else {
      sessionRooms[sessionId].students[socket.id] = { userId, name: userName, socketId: socket.id };
    }

    // Notify teacher of updated participant list (includes socketId for private chat)
    const room = sessionRooms[sessionId];
    const participants = Object.values(room.students);
    io.to(sessionId).emit('participants-update', participants);

    console.log(`[Session ${sessionId}] ${role} "${userName}" joined`);
  });

  // -------------------------------------------------------------------
  // BROADCAST TEACHER SOCKET ID — so students can address private chats
  // -------------------------------------------------------------------
  socket.on('broadcast-teacher-socket', ({ sessionId, socketId }) => {
    // Relay teacher's socket ID to all students in the room
    socket.to(sessionId).emit('teacher-socket-id', { socketId });
  });

  // -------------------------------------------------------------------
  // SCREEN FRAME (binary) — student → teacher only
  // Payload: ArrayBuffer (raw JPEG bytes from canvas.toBlob)
  // -------------------------------------------------------------------
  socket.on('screen-frame', (frameBuffer) => {
    const { sessionId, userId, userName } = socket;
    if (!sessionId) return;

    const room = sessionRooms[sessionId];
    if (room && room.teacher) {
      // Relay to teacher socket only (not broadcast to all)
      io.to(room.teacher).emit('student-frame', {
        studentId: userId,
        studentName: userName,
        frame: frameBuffer,   // raw binary ArrayBuffer — no base64
      });
    }
  });

  // -------------------------------------------------------------------
  // CHAT MESSAGE — private teacher ↔ student
  // Payload: { sessionId, toUserId, toSocketId, message, senderName }
  // -------------------------------------------------------------------
  socket.on('chat-message', ({ sessionId, toSocketId, message, senderName }) => {
    // Send to recipient only + send back to sender for display
    io.to(toSocketId).emit('chat-message', {
      fromSocketId: socket.id,
      fromUserId: socket.userId,
      senderName,
      message,
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------
  // ANOMALY EVENT — SentryClass agent or server-side rule triggers
  // Payload: { sessionId, studentId, studentName, reason, timestamp }
  // -------------------------------------------------------------------
  // -------------------------------------------------------------------
  // ANOMALY EVENT — Continuous Behavioral Telemetry (Paste, Focus, Idle)
  // Payload: { sessionId, studentId, studentName, eventType, score, level, reason, evidenceFrame }
  // -------------------------------------------------------------------
  socket.on('anomaly-event', async (data) => {
    const { sessionId, userId, userName } = socket;
    const targetSessionId = data.sessionId || sessionId;
    const studentId = data.studentId || userId;
    const studentName = data.studentName || userName;

    if (!targetSessionId || !studentId) return;

    try {
      const isRed = data.level === 'red' || data.isRed;
      const outputCode = isRed ? `r${data.score || 75}` : `y${data.score || 35}`;

      // Save behavioral log to DB for this specific student & session
      const auditLog = await AuditLog.create({
        session: targetSessionId,
        student: studentId,
        studentName: studentName || 'Student',
        eventType: data.eventType || 'BEHAVIORAL_ANOMALY',
        score: Number(data.score) || (isRed ? 75 : 35),
        combinedRisk: Number(data.combinedRisk) || (isRed ? 75 : 35),
        outputCode,
        evidenceFrame: isRed ? (data.evidenceFrame || null) : null, // 480p JPEG screenshot snapshot on Red
        reason: data.reason || (isRed ? 'High Behavioral Anomaly' : 'Behavioral Alert'),
        popupTriggered: isRed,
      });

      console.log(`[Behavior Log] ${studentName} - ${outputCode}: ${data.reason}`);

      const room = sessionRooms[targetSessionId];
      if (room && room.teacher) {
        // Relay audit event to teacher dashboard
        io.to(room.teacher).emit('screenshot-audit-event', {
          logId: auditLog._id,
          studentId,
          studentName,
          eventType: auditLog.eventType,
          score: auditLog.score,
          combinedRisk: auditLog.combinedRisk,
          outputCode: auditLog.outputCode,
          evidenceFrame: auditLog.evidenceFrame,
          reason: auditLog.reason,
          popupTriggered: isRed,
          timestamp: auditLog.createdAt,
        });

        // Trigger Red Popup alert to Teacher ONLY
        if (isRed) {
          io.to(room.teacher).emit('teacher-red-popup', {
            logId: auditLog._id,
            studentId,
            studentName,
            title: `Red Alert: ${data.reason || 'Behavioral Anomaly'}`,
            message: `Student ${studentName} triggered a high-severity anomaly (${outputCode}).`,
            outputCode: auditLog.outputCode,
            score: auditLog.score,
            evidenceFrame: auditLog.evidenceFrame,
            timestamp: auditLog.createdAt,
          });
        }
      }
    } catch (err) {
      console.error('Error saving behavioral audit log:', err);
    }
  });

  // -------------------------------------------------------------------
  // QUIZ SUBMITTED — Student finished assessment, relay results to teacher
  // Payload: { sessionId, studentId, studentName, quizId, percentage, score, totalMarks, chooseAnswers }
  // -------------------------------------------------------------------
  socket.on('quiz-submitted', (data) => {
    const { sessionId: sid, userId, userName } = socket;
    const targetSessionId = data.sessionId || sid;
    const room = sessionRooms[targetSessionId];
    if (room && room.teacher) {
      io.to(room.teacher).emit('student-quiz-submitted', {
        studentId: data.studentId || userId,
        studentName: data.studentName || userName,
        quizId: data.quizId,
        percentage: data.percentage,
        score: data.score,
        totalMarks: data.totalMarks,
        chooseAnswers: data.chooseAnswers || [],
        timestamp: new Date().toISOString(),
      });
    }
    console.log(`[Quiz Submitted] ${data.studentName || userName} scored ${data.percentage}%`);
  });

  // -------------------------------------------------------------------
  // SCREENSHOT ANALYSIS RESULT — 5s Frame Diff (Y/R threshold)
  // Payload: { sessionId, studentId, studentName, eventType, score, combinedRisk, outputCode, evidenceFrame, reason, popupTriggered }
  // -------------------------------------------------------------------
  socket.on('screenshot-analysis-result', async (data) => {
    const { sessionId, userId, userName } = socket;
    const targetSessionId = data.sessionId || sessionId;
    const studentId = data.studentId || userId;
    const studentName = data.studentName || userName;

    if (!targetSessionId || !studentId) return;

    try {
      // Save audit log to DB for this specific student & session
      const auditLog = await AuditLog.create({
        session: targetSessionId,
        student: studentId,
        studentName: studentName || 'Student',
        eventType: data.eventType || 'SCREENSHOT_CHANGE',
        score: Number(data.score) || 0,
        combinedRisk: Number(data.combinedRisk) || 0,
        outputCode: data.outputCode, // e.g., "y34.2" or "r65.8"
        evidenceFrame: data.evidenceFrame || null, // compressed image base64
        reason: data.reason || 'Screen content change detected',
        popupTriggered: !!data.popupTriggered,
      });

      console.log(`[Audit Log] ${studentName} - Code: ${data.outputCode} (Score: ${data.score})`);

      const room = sessionRooms[targetSessionId];
      if (room && room.teacher) {
        // Relay audit event to teacher dashboard
        io.to(room.teacher).emit('screenshot-audit-event', {
          logId: auditLog._id,
          studentId,
          studentName,
          eventType: auditLog.eventType,
          score: auditLog.score,
          combinedRisk: auditLog.combinedRisk,
          outputCode: auditLog.outputCode,
          evidenceFrame: auditLog.evidenceFrame,
          reason: auditLog.reason,
          popupTriggered: auditLog.popupTriggered,
          timestamp: auditLog.createdAt,
        });

        // Trigger Red Popup alert to Teacher ONLY if popup condition met (Red anomaly r>=60)
        if (data.popupTriggered) {
          io.to(room.teacher).emit('teacher-red-popup', {
            logId: auditLog._id,
            studentId,
            studentName,
            title: `Visual Anomaly Alert: ${studentName}`,
            message: `Large visual change detected (${data.outputCode}) on ${studentName}'s screen.`,
            outputCode: data.outputCode,
            score: data.score,
            combinedRisk: data.combinedRisk,
            evidenceFrame: auditLog.evidenceFrame,
            timestamp: auditLog.createdAt,
          });
        }
      }
    } catch (err) {
      console.error('Error saving screenshot audit log:', err);
    }
  });

  // -------------------------------------------------------------------
  // SESSION ENDED — teacher broadcasts end to all students
  // -------------------------------------------------------------------
  socket.on('end-session', ({ sessionId }) => {
    io.to(sessionId).emit('session-ended');
    delete sessionRooms[sessionId];
  });

  // -------------------------------------------------------------------
  // DISCONNECT — clean up participant
  // -------------------------------------------------------------------
  socket.on('disconnect', () => {
    const { sessionId, role, userId, userName } = socket;
    if (!sessionId || !sessionRooms[sessionId]) return;

    const room = sessionRooms[sessionId];

    if (role === 'teacher') {
      room.teacher = null;
    } else {
      delete room.students[socket.id];
      // Notify remaining participants
      const participants = Object.values(room.students);
      io.to(sessionId).emit('participants-update', participants);
      // Tell teacher this student disconnected
      if (room.teacher) {
        io.to(room.teacher).emit('student-disconnected', { studentId: userId, studentName: userName });
      }
    }

    console.log(`[Session ${sessionId}] ${role} "${userName}" disconnected`);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
