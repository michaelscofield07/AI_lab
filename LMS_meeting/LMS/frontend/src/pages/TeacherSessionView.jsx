import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  PhoneOff, Users, MessageSquare, X, Send,
  AlertTriangle, Shield, Wifi, WifiOff,
  LayoutGrid, ChevronDown
} from 'lucide-react';

const GRID_OPTIONS = [10, 30];

export default function TeacherSessionView() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [status, setStatus] = useState('connecting');

  // Grid layout
  const [gridSize, setGridSize] = useState(10);
  const [showGridMenu, setShowGridMenu] = useState(false);

  // Students and their frames
  // Map: studentId → { name, imageUrl }
  const [studentFrames, setStudentFrames] = useState({});
  // Map: studentId → status ('green' | 'yellow' | 'red' | 'gray')
  const [studentStatuses, setStudentStatuses] = useState({});
  const [participants, setParticipants] = useState([]);

  // Panels
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [anomalies, setAnomalies] = useState([]);

  // Chat — teacher clicks a participant
  const [showChat, setShowChat] = useState(false);
  const [chatTarget, setChatTarget] = useState(null); // { socketId, name }
  const [chatMessages, setChatMessages] = useState({}); // { socketId: [messages] }
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Refs
  const socketRef = useRef(null);
  // Map: studentId → blobURL (to avoid memory leaks, revoke old ones)
  const prevBlobUrls = useRef({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatTarget]);

  // --- Load session info ---
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get(`/api/sessions/${sessionId}`);
        setSessionInfo(res.data);
        connectSocket(res.data);
      } catch (err) {
        setStatus('error');
      }
    };
    fetchSession();

    return () => {
      // Cleanup all blob URLs on unmount
      Object.values(prevBlobUrls.current).forEach(URL.revokeObjectURL);
      socketRef.current?.disconnect();
    };
  }, [sessionId]);

  const connectSocket = (info) => {
    // Empty string makes it use the current domain (e.g. ngrok), Vite proxies /socket.io to backend
    const socket = io('', {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('joined');
      socket.emit('join-session', {
        sessionId,
        userId: user._id,
        userName: user.name,
        role: 'teacher',
      });
      // Broadcast teacher's socket ID so students can address private chats
      socket.emit('broadcast-teacher-socket', { sessionId, socketId: socket.id });
    });

    socket.on('connect_error', () => setStatus('error'));

    socket.on('participants-update', (list) => {
      setParticipants(list);
    });

    // Binary frame from a student: { studentId, studentName, frame: ArrayBuffer }
    socket.on('student-frame', ({ studentId, studentName, frame }) => {
      // Revoke previous blob URL for this student (prevent memory leak)
      if (prevBlobUrls.current[studentId]) {
        URL.revokeObjectURL(prevBlobUrls.current[studentId]);
      }
      const blob = new Blob([frame], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      prevBlobUrls.current[studentId] = url;

      setStudentFrames(prev => ({
        ...prev,
        [studentId]: { name: studentName, imageUrl: url },
      }));
    });

    socket.on('student-behavioral-status', ({ studentId, status }) => {
      setStudentStatuses(prev => ({
        ...prev,
        [studentId]: status,
      }));
    });

    socket.on('student-disconnected', ({ studentId, studentName }) => {
      setStudentFrames(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    });

    // Private chat message received from a student
    socket.on('chat-message', ({ fromSocketId, senderName, message, timestamp }) => {
      setChatMessages(prev => {
        const thread = prev[fromSocketId] || [];
        return {
          ...prev,
          [fromSocketId]: [...thread, {
            from: senderName,
            text: message,
            time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            self: false,
          }],
        };
      });
      // Auto-open chat to the student
      if (!chatTarget || chatTarget.socketId !== fromSocketId) {
        setChatTarget({ socketId: fromSocketId, name: senderName });
        setShowChat(true);
      }
    });

    socket.on('anomaly-alert', (data) => {
      setAnomalies(prev => [{ ...data, id: Date.now() }, ...prev]);
    });

    socket.on('disconnect', () => {
      if (status !== 'ended') setStatus('error');
    });
  };

  const sendChat = () => {
    if (!chatInput.trim() || !chatTarget || !socketRef.current) return;

    socketRef.current.emit('chat-message', {
      sessionId,
      toSocketId: chatTarget.socketId,
      message: chatInput.trim(),
      senderName: user.name,
    });

    setChatMessages(prev => {
      const thread = prev[chatTarget.socketId] || [];
      return {
        ...prev,
        [chatTarget.socketId]: [...thread, {
          from: 'You',
          text: chatInput.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          self: true,
        }],
      };
    });
    setChatInput('');
  };

  const openChatWith = (participant) => {
    setChatTarget({ socketId: participant.socketId, name: participant.name });
    setShowChat(true);
    setShowParticipants(false);
  };

  const endSession = async () => {
    if (!window.confirm('End this session for all students?')) return;
    try {
      await axios.patch(`/api/sessions/${sessionId}/status`, { status: 'ended' });
      socketRef.current?.emit('end-session', { sessionId });
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to end session', err);
    }
  };

  const studentEntries = Object.entries(studentFrames); // [studentId, { name, imageUrl }]

  const gridCols = gridSize === 10
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7';

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md text-center space-y-4">
          <AlertTriangle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-white">Cannot Load Session</h2>
          <p className="text-slate-400 text-sm">Make sure you have access to this session and the server is running.</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Grid size selector */}
          <div className="relative">
            <button
              onClick={() => setShowGridMenu(g => !g)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              <LayoutGrid size={14} />
              {gridSize} tiles
              <ChevronDown size={12} />
            </button>
            {showGridMenu && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl z-50">
                {GRID_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setGridSize(n); setShowGridMenu(false); }}
                    className={`w-full px-4 py-2 text-left text-xs font-semibold transition-colors ${
                      gridSize === n ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {n} tiles per view
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-white font-bold text-sm">{sessionInfo?.title || 'Monitoring Session'}</h1>
            <p className="text-slate-500 text-xs">{sessionInfo?.course?.title} · {sessionInfo?.durationMinutes}m</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'joined' ? (
            <span className="flex items-center gap-1 text-emerald-400 text-xs"><Wifi size={12} /> Live</span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 text-xs"><WifiOff size={12} /> Connecting…</span>
          )}
          <span className="text-slate-400 text-xs">{participants.length} student{participants.length !== 1 ? 's' : ''} connected</span>
          {anomalies.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-xs font-bold animate-pulse">
              <AlertTriangle size={10} /> {anomalies.length} alert{anomalies.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Main — student screen grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {studentEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <div className="space-y-3">
              <Shield size={48} className="mx-auto text-slate-700" />
              <p className="text-slate-500 font-semibold">Waiting for students to join…</p>
              <p className="text-slate-600 text-sm">
                Session ID: <span className="font-mono text-violet-400">{sessionId}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-3`}>
            {studentEntries.slice(0, gridSize).map(([studentId, { name, imageUrl }]) => (
              <div
                key={studentId}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden group hover:border-violet-500/50 transition-all cursor-pointer"
                onClick={() => {
                  const p = participants.find(p => p.userId === studentId);
                  if (p) openChatWith(p);
                }}
              >
                {/* Screen frame */}
                <div className="aspect-video bg-slate-950 relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-slate-600 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                  )}
                  {/* Student name badge */}
                  <div className="absolute bottom-1.5 left-1.5 bg-slate-950/80 backdrop-blur text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                    {name}
                  </div>
                  {/* Behavioral Biometrics indicator */}
                  {(() => {
                    const bStatus = studentStatuses[studentId] || 'gray';
                    let bgColor = 'bg-slate-500 shadow-slate-500/50';
                    if (bStatus === 'green') bgColor = 'bg-emerald-400 shadow-emerald-400/50';
                    if (bStatus === 'yellow') bgColor = 'bg-amber-400 shadow-amber-400/50';
                    if (bStatus === 'red') bgColor = 'bg-rose-500 shadow-rose-500/50';
                    
                    return (
                      <div 
                        className={`absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full ${bgColor} shadow-sm z-10 transition-colors duration-300`} 
                        title={`Behavioral Status: ${bStatus.toUpperCase()}`}
                      />
                    );
                  })()}
                  {/* Chat overlay on hover */}
                  <div className="absolute inset-0 bg-violet-600/0 group-hover:bg-violet-600/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <MessageSquare size={20} className="text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side panels */}
      {/* Participants panel */}
      {showParticipants && (
        <div className="fixed right-4 top-16 bottom-24 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm">Participants ({participants.length})</h3>
            <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {participants.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No students connected yet</p>
            ) : (
              participants.map((p, i) => (
                <button
                  key={i}
                  onClick={() => openChatWith(p)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 hover:bg-violet-600/10 hover:border-violet-500/30 border border-transparent transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold flex-shrink-0">
                    {p.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-xs font-semibold truncate">{p.name}</p>
                    <p className="text-[10px] text-violet-400">Click to chat</p>
                  </div>
                  <MessageSquare size={12} className="text-slate-500 flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Anomaly History panel */}
      {showAnomalies && (
        <div className="fixed right-4 top-16 bottom-24 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm">Anomaly History ({anomalies.length})</h3>
            <button onClick={() => setShowAnomalies(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {anomalies.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No anomalies detected yet</p>
            ) : (
              anomalies.map(a => (
                <div key={a.id} className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <p className="text-rose-400 text-xs font-bold">{a.studentName}</p>
                  <p className="text-slate-300 text-xs mt-0.5">{a.reason}</p>
                  <p className="text-slate-500 text-[10px] mt-1">
                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && chatTarget && (
        <div className="fixed right-4 top-16 bottom-24 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm">Chat — {chatTarget.name}</h3>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(chatMessages[chatTarget.socketId] || []).length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No messages yet</p>
            ) : (
              (chatMessages[chatTarget.socketId] || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.self ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                    msg.self
                      ? 'bg-violet-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}>
                    {!msg.self && <p className="font-bold text-violet-400 text-[10px] mb-0.5">{msg.from}</p>}
                    <p>{msg.text}</p>
                    {msg.time && <p className="text-[10px] opacity-60 mt-0.5 text-right">{msg.time}</p>}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder={`Message ${chatTarget.name}…`}
              className="flex-1 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={sendChat}
              className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-4">
        {/* Participants */}
        <button
          onClick={() => { setShowParticipants(p => !p); setShowChat(false); setShowAnomalies(false); }}
          title="Participants"
          className={`relative flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showParticipants
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Users size={22} />
          <span className="text-[10px] font-semibold">People</span>
          {participants.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] flex items-center justify-center">
              {participants.length}
            </span>
          )}
        </button>

        {/* Chat */}
        <button
          onClick={() => { setShowChat(c => !c); setShowParticipants(false); setShowAnomalies(false); }}
          title="Chat"
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showChat
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <MessageSquare size={22} />
          <span className="text-[10px] font-semibold">Chat</span>
        </button>

        {/* Anomaly History */}
        <button
          onClick={() => { setShowAnomalies(a => !a); setShowParticipants(false); setShowChat(false); }}
          title="Anomaly History"
          className={`relative flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showAnomalies
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <AlertTriangle size={22} />
          <span className="text-[10px] font-semibold">Alerts</span>
          {anomalies.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center animate-pulse">
              {anomalies.length}
            </span>
          )}
        </button>

        {/* End Session */}
        <button
          onClick={endSession}
          title="End Session"
          className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 transition-all"
        >
          <PhoneOff size={22} />
          <span className="text-[10px] font-semibold">End</span>
        </button>
      </div>
    </div>
  );
}
