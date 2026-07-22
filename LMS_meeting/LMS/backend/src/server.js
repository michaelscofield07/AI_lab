const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

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
  // BEHAVIORAL STATUS (telemetry) — student → teacher only
  // Payload: { status: 'green' | 'yellow' | 'red' | 'gray' }
  // -------------------------------------------------------------------
  socket.on('behavioral-status', (payload) => {
    const { sessionId, userId } = socket;
    if (!sessionId) return;

    const room = sessionRooms[sessionId];
    if (room && room.teacher) {
      io.to(room.teacher).emit('student-behavioral-status', {
        studentId: userId,
        status: payload.status,
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
  socket.on('anomaly-event', (data) => {
    const { sessionId } = socket;
    if (!sessionId) return;
    const room = sessionRooms[sessionId];
    if (room && room.teacher) {
      io.to(room.teacher).emit('anomaly-alert', data);
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

const PORT = 5001;
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
