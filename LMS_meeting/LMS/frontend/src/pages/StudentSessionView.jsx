import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Monitor, MonitorOff, LogOut, Users, MessageSquare,
  X, Send, AlertCircle, Wifi, WifiOff, Clock, Shield
} from 'lucide-react';

const TARGET_FPS = 5; // 5 frames per second — low bandwidth
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export default function StudentSessionView() {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Session state
  const [sessionInfo, setSessionInfo] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | joined | ended | error
  const [errorMsg, setErrorMsg] = useState('');

  // Biometric gatekeeper state
  const [verified, setVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyText, setVerifyText] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const tdnaRef = useRef(null);
  const VERIFY_PHRASE = "I agree to academic integrity rules.";

  // Screen sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  // Participants
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);

  // Chat (teacher only)
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [teacherSocketId, setTeacherSocketId] = useState(null);

  // Refs
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  // --- Load session info from localStorage (set during join) ---
  useEffect(() => {
    const stored = localStorage.getItem(`session_${sessionId}`);
    if (!stored) {
      setErrorMsg('Session data not found. Please join again from the dashboard.');
      setStatus('error');
      return;
    }
    const info = JSON.parse(stored);
    setSessionInfo(info);
    
    // Initialize TypingDNA for gatekeeper
    if (window.TypingDNA) {
      tdnaRef.current = new window.TypingDNA();
      tdnaRef.current.addTarget('verify-input');
    }
  }, [sessionId]);

  // Connect socket ONLY AFTER verification
  useEffect(() => {
    if (verified && sessionInfo) {
      connectSocket(sessionInfo);
    }
  }, [verified, sessionInfo]);

  const handleVerify = async () => {
    if (verifyText !== VERIFY_PHRASE) {
      setVerifyError('Please type the phrase exactly as shown.');
      return;
    }
    if (!tdnaRef.current) {
      setVerifyError('Biometric engine loading...');
      return;
    }

    setVerifyLoading(true);
    setVerifyError('');

    try {
      const pattern = tdnaRef.current.getTypingPattern({ type: 1, text: VERIFY_PHRASE });
      const res = await axios.post('/api/auth/biometrics/verify', { typingPattern: pattern });
      
      // Verification successful
      setVerified(true);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Biometric verification failed.');
      setVerifyText('');
      tdnaRef.current.reset();
    } finally {
      setVerifyLoading(false);
    }
  };

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- Socket connection ---
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
        role: 'student',
      });
    });

    socket.on('connect_error', () => {
      setErrorMsg('Cannot connect to session server. Is the backend running?');
      setStatus('error');
    });

    socket.on('participants-update', (list) => {
      setParticipants(list);
    });

    // Teacher's socket ID sent from teacher view for private chat routing
    socket.on('teacher-socket-id', ({ socketId }) => {
      setTeacherSocketId(socketId);
    });

    socket.on('chat-message', ({ fromSocketId, senderName, message, timestamp }) => {
      setChatMessages(prev => [...prev, {
        from: senderName,
        text: message,
        time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        self: false,
      }]);
      if (!showChat) setShowChat(true);
    });

    socket.on('session-ended', () => {
      setStatus('ended');
      stopScreenShare();
      localStorage.removeItem(`session_${sessionId}`);
    });

    socket.on('disconnect', () => {
      if (status !== 'ended') setStatus('error');
    });
  };

  // --- Behavioral Biometrics Telemetry Engine ---
  useEffect(() => {
    if (status !== 'joined' || !socketRef.current) return;

    let lastKeyTime = Date.now();
    let keystrokeCount = 0;
    let hasPasted = false;
    let isFocused = true;
    
    const handleKeyDown = (e) => {
      lastKeyTime = Date.now();
      keystrokeCount++;
    };

    const handlePaste = (e) => {
      hasPasted = true;
      if (socketRef.current?.connected) {
        socketRef.current.emit('behavioral-status', { status: 'red' });
      }
    };

    const handleFocus = () => {
      isFocused = true;
      lastKeyTime = Date.now(); // Instantly reset idle timer
      if (socketRef.current?.connected) {
        socketRef.current.emit('behavioral-status', { status: 'green' });
      }
    };

    const handleBlur = () => {
      isFocused = false;
      if (socketRef.current?.connected) {
        // Instantly mark as away/paused when they click on another app
        socketRef.current.emit('behavioral-status', { status: 'yellow' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    const telemetryInterval = setInterval(() => {
      const now = Date.now();
      const idleTimeSeconds = (now - lastKeyTime) / 1000;
      
      let currentStatus = 'green';

      if (hasPasted || keystrokeCount > 80) {
        currentStatus = 'red'; // Unusually high burst or paste detected
        hasPasted = false;     // Reset the paste flag for the next interval
      } else if (idleTimeSeconds > 60) {
        currentStatus = 'gray'; // Idle for 1 min (whether focused or not)
      } else if (!isFocused) {
        currentStatus = 'yellow'; // Away / Working in another app
      } else if (idleTimeSeconds > 15 && idleTimeSeconds <= 60) {
        currentStatus = 'yellow'; // Paused / Thinking in LMS
      }

      // Reset count for next interval window (evaluated every 3 seconds)
      keystrokeCount = 0;

      if (socketRef.current?.connected) {
        socketRef.current.emit('behavioral-status', { status: currentStatus });
      }
    }, 3000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      clearInterval(telemetryInterval);
    };
  }, [status]);

  // --- Screen capture: getDisplayMedia → canvas → binary blob → socket ---
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: TARGET_FPS, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setIsSharing(true);
      setScreenWarning(false);

      // Draw stream to hidden canvas and emit at TARGET_FPS
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
      };

      captureIntervalRef.current = setInterval(() => {
        if (video.readyState >= 2) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Binary blob — NO base64, avoids 33% overhead
          canvas.toBlob(
            (blob) => {
              if (!blob || !socketRef.current?.connected) return;
              blob.arrayBuffer().then((buffer) => {
                socketRef.current.emit('screen-frame', buffer);
              });
            },
            'image/jpeg',
            0.5  // JPEG quality 50% — good balance for low FPS streaming
          );
        }
      }, FRAME_INTERVAL);

      // Auto-stop if user cancels share via browser chrome
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
        setScreenWarning(true);
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setScreenWarning(true);
      }
      console.error('Screen share error:', err);
    }
  }, [sessionId]);

  const stopScreenShare = useCallback(() => {
    clearInterval(captureIntervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsSharing(false);
  }, []);

  // Auto-prompt screen share when joined
  useEffect(() => {
    if (status === 'joined') {
      setScreenWarning(true); // show warning first, let user click
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScreenShare();
      socketRef.current?.disconnect();
    };
  }, []);

  const sendChat = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    const socket = socketRef.current;

    // Find teacher's socket ID — teacher broadcasts their socket id on join
    if (!teacherSocketId) {
      setChatMessages(prev => [...prev, {
        from: 'System',
        text: 'Teacher is not connected yet.',
        time: '',
        self: false,
      }]);
      return;
    }

    socket.emit('chat-message', {
      sessionId,
      toSocketId: teacherSocketId,
      message: chatInput.trim(),
      senderName: user.name,
    });

    setChatMessages(prev => [...prev, {
      from: 'You',
      text: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      self: true,
    }]);
    setChatInput('');
  };

  const leaveSession = () => {
    stopScreenShare();
    socketRef.current?.disconnect();
    localStorage.removeItem(`session_${sessionId}`);
    navigate('/dashboard');
  };

  // --- Render helpers ---
  if (!verified && status !== 'error' && status !== 'ended') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-xl max-w-md w-full p-8 space-y-6 text-center">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 mx-auto rounded-full flex items-center justify-center">
            <Shield size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Identity Verification</h2>
            <p className="text-slate-500 text-sm mt-2">Type the phrase below to verify your identity and enter the session.</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <p className="font-mono text-slate-700 dark:text-slate-300 font-bold select-none">{VERIFY_PHRASE}</p>
          </div>

          <div className="text-left space-y-2">
            <input
              id="verify-input"
              type="text"
              value={verifyText}
              onChange={(e) => {
                setVerifyText(e.target.value);
                setVerifyError('');
              }}
              onPaste={(e) => e.preventDefault()}
              disabled={verifyLoading}
              className="w-full bg-white dark:bg-slate-950 border-2 border-indigo-100 dark:border-indigo-900 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none font-mono"
              placeholder="Type phrase here..."
            />
          </div>

          {verifyError && (
            <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-50 dark:bg-rose-950/30 px-4 py-2 rounded-lg text-left">
              <AlertCircle size={16} className="shrink-0" />
              {verifyError}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={verifyLoading || verifyText.length < VERIFY_PHRASE.length}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2"
          >
            {verifyLoading ? 'Verifying...' : 'Enter Session'}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-white">Connection Error</h2>
          <p className="text-slate-400 text-sm">{errorMsg}</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-semibold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'ended') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md text-center space-y-4">
          <Shield size={40} className="mx-auto text-violet-500" />
          <h2 className="text-xl font-bold text-white">Session Ended</h2>
          <p className="text-slate-400 text-sm">The teacher has ended this monitoring session.</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">{sessionInfo?.title || 'Monitoring Session'}</h1>
            <p className="text-slate-400 text-xs">{sessionInfo?.course?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {socketRef.current?.connected ? (
            <span className="flex items-center gap-1 text-emerald-400"><Wifi size={12} /> Connected</span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400"><WifiOff size={12} /> Reconnecting…</span>
          )}
          <Clock size={12} />
          <span>{sessionInfo?.durationMinutes}m exam</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center relative">

        {/* Screen share warning banner */}
        {screenWarning && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-8 max-w-sm text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                <MonitorOff size={32} className="text-amber-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Please Share Your Screen</h2>
              <p className="text-slate-400 text-sm">
                This monitoring session requires you to share your screen. Your teacher will be able to view your screen during the exam.
              </p>
              <button
                onClick={startScreenShare}
                className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Monitor size={18} />
                Share My Screen
              </button>
            </div>
          </div>
        )}

        {/* Screen sharing active status */}
        {isSharing && !screenWarning && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto animate-pulse">
              <Monitor size={36} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">Screen Sharing Active</p>
              <p className="text-slate-400 text-sm mt-1">Your screen is visible to the teacher at 5 FPS</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>
        )}

        {/* Not sharing, no warning — connecting state */}
        {!isSharing && !screenWarning && status === 'connecting' && (
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Connecting to session…</p>
          </div>
        )}

        {/* Participants Panel */}
        {showParticipants && (
          <div className="absolute right-4 top-4 bottom-20 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-white font-bold text-sm">Participants ({participants.length + 1})</h3>
              <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Teacher */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                  T
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{sessionInfo?.teacher?.name}</p>
                  <p className="text-violet-400 text-[10px]">Teacher</p>
                </div>
              </div>
              {/* Other students (display only, no chat) */}
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
                    {p.name?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-slate-300 text-xs font-medium">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Panel (teacher only) */}
        {showChat && (
          <div className="absolute right-4 top-4 bottom-20 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-white font-bold text-sm">Chat — {sessionInfo?.teacher?.name}</h3>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-slate-500 text-xs text-center py-6">No messages yet. Say hello to your teacher!</p>
              )}
              {chatMessages.map((msg, i) => (
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
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Message teacher…"
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
      </div>

      {/* Bottom toolbar — Google Meet style */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-4">
        {/* Screen Share Toggle */}
        <button
          onClick={isSharing ? stopScreenShare : startScreenShare}
          title={isSharing ? 'Stop Sharing' : 'Share Screen'}
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl transition-all ${
            isSharing
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isSharing ? <Monitor size={22} /> : <MonitorOff size={22} />}
          <span className="text-[10px] font-semibold">{isSharing ? 'Stop' : 'Share'}</span>
        </button>

        {/* Participants */}
        <button
          onClick={() => { setShowParticipants(p => !p); setShowChat(false); }}
          title="Participants"
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
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
          onClick={() => { setShowChat(c => !c); setShowParticipants(false); }}
          title="Chat with Teacher"
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showChat
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <MessageSquare size={22} />
          <span className="text-[10px] font-semibold">Chat</span>
        </button>

        {/* Leave */}
        <button
          onClick={leaveSession}
          title="Leave Session"
          className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-semibold">Leave</span>
        </button>
      </div>
    </div>
  );
}
