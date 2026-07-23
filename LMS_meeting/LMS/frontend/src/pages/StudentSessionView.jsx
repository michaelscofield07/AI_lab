import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Monitor, MonitorOff, LogOut, Users, MessageSquare,
  X, Send, AlertCircle, Wifi, WifiOff, Clock, Shield,
  FileText, CheckCircle2, ChevronRight, ChevronLeft, Award
} from 'lucide-react';
import { analyze3sSlotFrame, compressCanvasFrame480p } from '../utils/screenshotAnalyzer';
import BehavioralCalibrationModal from '../components/BehavioralCalibrationModal';

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

  // Behavioral DNA Profile State
  const [behavioralProfile, setBehavioralProfile] = useState(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);

  // Screen sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [screenWarning, setScreenWarning] = useState(false);

  // Embedded Assessment / Quiz state
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Participants & Chat
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [teacherSocketId, setTeacherSocketId] = useState(null);

  // Behavioral tracking
  const [behavioralScore, setBehavioralScore] = useState(25.0);

  // Load/Check One-Time Behavioral Profile per user ID
  useEffect(() => {
    if (user?._id || user?.id) {
      const uId = user._id || user.id;
      const saved = localStorage.getItem(`behavioral_profile_${uId}`);
      if (saved) {
        try {
          setBehavioralProfile(JSON.parse(saved));
        } catch (e) {
          setShowCalibrationModal(true);
        }
      } else {
        setShowCalibrationModal(true);
      }
    }
  }, [user]);

  // Refs
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const slot5sIntervalRef = useRef(null);
  const chatEndRef = useRef(null);

  const lastKeyTimeRef = useRef(null);
  const keystrokeCountRef = useRef(0);

  const handleParagraphKeyUp = (e) => {
    const now = performance.now();
    if (lastKeyTimeRef.current) {
      const flightMs = now - lastKeyTimeRef.current;
      keystrokeCountRef.current += 1;

      if (behavioralProfile && keystrokeCountRef.current > 6) {
        const baselineFlight = behavioralProfile.avgFlightMs || 120;
        // Relaxed partial check: emit yellow log if typing flight varies significantly from baseline
        if (flightMs < baselineFlight * 0.35) {
          if (socketRef.current?.connected) {
            socketRef.current.emit('anomaly-event', {
              sessionId,
              studentId: user?._id || user?.id,
              studentName: user?.name,
              eventType: 'BEHAVIORAL_ANOMALY',
              level: 'yellow',
              isRed: false,
              score: 38,
              outputCode: 'y38',
              reason: 'Typing Dynamics Cadence Variation (Yellow Log)',
            });
          }
        }
      }
    }
    lastKeyTimeRef.current = now;
  };

  // --- Load session info ---
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const stored = localStorage.getItem(`session_${sessionId}`);
        let info = stored ? JSON.parse(stored) : null;

        // Fetch fresh session details from backend
        const res = await axios.get(`/api/sessions/${sessionId}`).catch(() => null);
        if (res?.data) {
          info = res.data;
        }

        if (!info) {
          setErrorMsg('Session data not found. Please join from the dashboard.');
          setStatus('error');
          return;
        }

        setSessionInfo(info);
        if (info.quiz?.questions) {
          setQuizQuestions(info.quiz.questions);
        }

        connectSocket(info);
      } catch (err) {
        setErrorMsg('Error loading monitoring session.');
        setStatus('error');
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- Socket connection ---
  const connectSocket = (info) => {
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

    socket.on('teacher-socket-id', ({ socketId }) => {
      setTeacherSocketId(socketId);
    });

    socket.on('chat-message', ({ senderName, message, timestamp }) => {
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

  // --- Continuous Behavioral Telemetry (Paste & Tab Switch = Red + 480p Screenshot, Mouse & Typing = Yellow) ---
  useEffect(() => {
    if (status !== 'joined' || !user) return;

    let lastMouseTime = performance.now();
    let lastMousePos = { x: 0, y: 0 };
    let mouseThrottled = false;

    const handleMouseMove = (e) => {
      const now = performance.now();
      const dt = (now - lastMouseTime) / 1000;
      if (dt > 0.1) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const speed = dist / dt;
        lastMouseTime = now;
        lastMousePos = { x: e.clientX, y: e.clientY };

        if (behavioralProfile && speed > 2200 && !mouseThrottled) {
          mouseThrottled = true;
          setTimeout(() => { mouseThrottled = false; }, 8000);

          if (socketRef.current?.connected) {
            socketRef.current.emit('anomaly-event', {
              sessionId,
              studentId: user?._id || user?.id,
              studentName: user?.name,
              eventType: 'BEHAVIORAL_ANOMALY',
              level: 'yellow',
              isRed: false,
              score: 32,
              outputCode: 'y32',
              reason: 'Mouse Cursor Velocity Variation (Yellow Log)',
            });
          }
        }
      }
    };

    const handleCopyPaste = (e) => {
      let evidenceFrame = null;
      if (canvasRef.current) {
        evidenceFrame = compressCanvasFrame480p(canvasRef.current, 0.5);
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('anomaly-event', {
          sessionId,
          studentId: user._id,
          studentName: user.name,
          eventType: 'BEHAVIORAL_ANOMALY',
          level: 'red',
          isRed: true,
          score: 85,
          reason: 'Copy/Paste Detected (Ctrl+V)',
          evidenceFrame,
        });
      }
    };

    const handleWindowBlur = () => {
      let evidenceFrame = null;
      if (canvasRef.current) {
        evidenceFrame = compressCanvasFrame480p(canvasRef.current, 0.5);
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('anomaly-event', {
          sessionId,
          studentId: user._id,
          studentName: user.name,
          eventType: 'BEHAVIORAL_ANOMALY',
          level: 'red',
          isRed: true,
          score: 80,
          reason: 'Tab Switch / Window Focus Lost',
          evidenceFrame,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('paste', handleCopyPaste);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('paste', handleCopyPaste);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [status, sessionId, user, behavioralProfile]);

  // --- Screen capture & 5s slot frame diff engine ---
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: TARGET_FPS, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setIsSharing(true);
      setScreenWarning(false);

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
          canvas.toBlob(
            (blob) => {
              if (!blob || !socketRef.current?.connected) return;
              blob.arrayBuffer().then((buffer) => {
                socketRef.current.emit('screen-frame', buffer);
              });
            },
            'image/jpeg',
            0.5
          );
        }
      }, FRAME_INTERVAL);

      // 3-Second Screenshot Frame Difference Analysis
      slot5sIntervalRef.current = setInterval(() => {
        if (canvasRef.current && socketRef.current?.connected) {
          const res = analyze3sSlotFrame(canvasRef.current, behavioralScore);
          if (res && res.outputCode) {
            socketRef.current.emit('screenshot-analysis-result', {
              sessionId,
              studentId: user._id,
              studentName: user.name,
              eventType: res.eventType,
              score: res.score,
              combinedRisk: res.combinedRisk,
              outputCode: res.outputCode,
              evidenceFrame: res.evidenceFrame,
              reason: res.popupTriggered
                ? 'Large visual change detected (3s slot)'
                : `Noteworthy visual change (${res.outputCode})`,
              popupTriggered: res.popupTriggered,
            });
            // Note: Logs & Red popups are processed by server.js and sent EXCLUSIVELY to Teacher UI.
          }
        }
      }, 3000);

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
  }, [sessionId, behavioralScore, user]);

  const stopScreenShare = useCallback(() => {
    clearInterval(captureIntervalRef.current);
    clearInterval(slot5sIntervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsSharing(false);
  }, []);

  useEffect(() => {
    if (status === 'joined') {
      setScreenWarning(true);
    }
  }, [status]);

  useEffect(() => {
    return () => {
      stopScreenShare();
      socketRef.current?.disconnect();
    };
  }, []);

  // --- Fail-Safe Quiz Submission Handler ---
  const handleQuizSubmit = async () => {
    try {
      setSubmittingQuiz(true);
      const answersPayload = quizQuestions.map((q, idx) => {
        const ans = selectedAnswers[idx];
        if (q.questionType === 'paragraph') {
          return {
            questionIndex: idx,
            paragraphText: typeof ans === 'string' ? ans : '',
          };
        }
        return {
          questionIndex: idx,
          selectedOptionIndex: typeof ans === 'number' ? ans : -1,
        };
      });

      let gradeResult = null;
      if (sessionInfo?.quiz?._id) {
        try {
          const res = await axios.post(`/api/quizzes/${sessionInfo.quiz._id}/grade`, { answers: answersPayload });
          gradeResult = res.data.result || res.data;
        } catch (err) {
          console.warn('Backend grade API fallback (will still emit live to teacher):', err);
        }
      }

      // Compile complete answer list (Choice + Paragraph responses) for live Teacher Dashboard
      const chooseAnswers = quizQuestions.map((q, idx) => {
        const ans = selectedAnswers[idx];
        if (q.questionType === 'paragraph') {
          return {
            questionIndex: idx,
            questionText: q.questionText,
            questionType: 'paragraph',
            paragraphText: typeof ans === 'string' ? ans : '',
          };
        }
        const selectedIdx = typeof ans === 'number' ? ans : -1;
        const isCorrect = selectedIdx === q.correctAnswerIndex;
        return {
          questionIndex: idx,
          questionText: q.questionText,
          questionType: 'choice',
          selectedOptionIndex: selectedIdx,
          selectedOption: q.options?.[selectedIdx] ?? 'No Answer',
          correctAnswerIndex: q.correctAnswerIndex,
          correctOption: q.options?.[q.correctAnswerIndex] ?? '',
          isCorrect,
        };
      });

      // Emit live submission payload to teacher socket
      if (socketRef.current) {
        socketRef.current.emit('quiz-submitted', {
          sessionId,
          studentId: user?._id || user?.id,
          studentName: user?.name,
          quizId: sessionInfo?.quiz?._id,
          percentage: gradeResult?.percentage ?? 0,
          score: gradeResult?.score ?? 0,
          totalMarks: gradeResult?.totalMarks ?? quizQuestions.filter(q => q.questionType !== 'paragraph').length,
          chooseAnswers,
        });
      }

      setQuizResult(gradeResult);
      setQuizSubmitted(true);

      // Brief delay to allow UI to render completed state, then auto end student session & return to dashboard
      setTimeout(() => {
        stopScreenShare();
        socketRef.current?.disconnect();
        localStorage.removeItem(`session_${sessionId}`);
        setStatus('ended');
        navigate('/dashboard');
      }, 1800);

    } catch (err) {
      console.error('Quiz submission error:', err);
      setQuizSubmitted(true);
      setTimeout(() => {
        stopScreenShare();
        socketRef.current?.disconnect();
        localStorage.removeItem(`session_${sessionId}`);
        setStatus('ended');
        navigate('/dashboard');
      }, 1800);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const sendChat = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    if (!teacherSocketId) {
      setChatMessages(prev => [...prev, { from: 'System', text: 'Teacher is not connected yet.', self: false }]);
      return;
    }

    socketRef.current.emit('chat-message', {
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

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-white">Connection Error</h2>
          <p className="text-slate-400 text-sm">{errorMsg}</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">
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
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm">{sessionInfo?.title || 'Live Assessment Session'}</h1>
            <p className="text-slate-400 text-xs">{sessionInfo?.course?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {socketRef.current?.connected ? (
            <span className="flex items-center gap-1 text-emerald-400"><Wifi size={12} /> Live Connected</span>
          ) : (
            <span className="flex items-center gap-1 text-rose-400"><WifiOff size={12} /> Reconnecting…</span>
          )}
          <Clock size={12} />
          <span>{sessionInfo?.durationMinutes || 60}m session</span>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex items-center justify-center relative p-6">
        {/* Screen Share Warning Modal */}
        {screenWarning && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-8 max-w-sm text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                <MonitorOff size={32} className="text-amber-400" />
              </div>
              <h2 className="text-white font-bold text-lg">Screen Sharing Required</h2>
              <p className="text-slate-400 text-sm">
                Please share your screen to proceed with the live monitored assessment.
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

        {/* Embedded Assessment UI (Quiz linked to Session) */}
        {sessionInfo?.quiz && quizQuestions.length > 0 ? (
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold rounded-full">
                  Live Assessment
                </span>
                <h2 className="text-xl font-bold text-white mt-1">{sessionInfo.quiz.title}</h2>
              </div>
              {!quizSubmitted && (
                <div className="text-xs text-slate-400 font-mono">
                  Question {currentQIndex + 1} of {quizQuestions.length}
                </div>
              )}
            </div>

            {/* Quiz Submitted View */}
            {quizSubmitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <Award size={36} />
                </div>
                <h3 className="text-2xl font-bold text-white">Assessment Submitted Successfully!</h3>
                <p className="text-slate-400 text-sm">
                  Your responses have been submitted to your instructor for evaluation.
                </p>
                <p className="text-slate-500 text-xs mt-2">Exiting live session room...</p>
              </div>
            ) : (
              /* Question View */
              <div className="space-y-6">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-white font-medium text-base space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] uppercase font-bold rounded">
                      {quizQuestions[currentQIndex]?.questionType === 'paragraph' ? 'Paragraph Response' : 'Multiple Choice'}
                    </span>
                  </div>
                  <p>{quizQuestions[currentQIndex]?.questionText}</p>
                </div>

                {/* Choose (Multiple Choice) vs Paragraph (Textarea) */}
                {quizQuestions[currentQIndex]?.questionType === 'paragraph' ? (
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold">Your Answer / Essay Response:</label>
                    <textarea
                      rows={5}
                      value={selectedAnswers[currentQIndex] || ''}
                      onChange={(e) => setSelectedAnswers(prev => ({ ...prev, [currentQIndex]: e.target.value }))}
                      onKeyUp={handleParagraphKeyUp}
                      placeholder="Type your response here... (Keystroke behavioral rhythm recorded)"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-violet-500 font-sans"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {quizQuestions[currentQIndex]?.options?.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQIndex] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQIndex]: optIdx }))}
                          className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-violet-600/20 border-violet-500 text-white shadow-lg'
                              : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <CheckCircle2 size={18} className="text-violet-400" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Navigation Toolbar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex(prev => prev - 1)}
                    className="px-4 py-2 bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-slate-700"
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  {currentQIndex === quizQuestions.length - 1 ? (
                    <button
                      onClick={handleQuizSubmit}
                      disabled={submittingQuiz}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                    >
                      {submittingQuiz ? 'Submitting…' : 'Submit Assessment'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentQIndex(prev => prev + 1)}
                      className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Default Active Session State (No Quiz attached) */
          isSharing && !screenWarning && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto animate-pulse">
                <Monitor size={36} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Active Monitoring Session</p>
                <p className="text-slate-400 text-sm mt-1">Screen streaming at 5 FPS</p>
              </div>
            </div>
          )
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
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">
                  T
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{sessionInfo?.teacher?.name}</p>
                  <p className="text-violet-400 text-[10px]">Teacher</p>
                </div>
              </div>
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

        {/* Chat Panel */}
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
                <p className="text-slate-500 text-xs text-center py-6">No messages yet.</p>
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
              <button onClick={sendChat} className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-4">
        <button
          onClick={isSharing ? stopScreenShare : startScreenShare}
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl transition-all ${
            isSharing
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isSharing ? <Monitor size={22} /> : <MonitorOff size={22} />}
          <span className="text-[10px] font-semibold">{isSharing ? 'Stop Share' : 'Share Screen'}</span>
        </button>

        <button
          onClick={() => { setShowParticipants(p => !p); setShowChat(false); }}
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showParticipants
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Users size={22} />
          <span className="text-[10px] font-semibold">People</span>
        </button>

        <button
          onClick={() => { setShowChat(c => !c); setShowParticipants(false); }}
          className={`flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showChat
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <MessageSquare size={22} />
          <span className="text-[10px] font-semibold">Chat</span>
        </button>

        <button
          onClick={leaveSession}
          className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-semibold">Leave</span>
        </button>
      </div>

      {/* Behavioral Calibration Modal Gate */}
      {showCalibrationModal && user && (
        <BehavioralCalibrationModal
          userId={user._id || user.id}
          userName={user.name}
          onComplete={(profile) => {
            setBehavioralProfile(profile);
            setShowCalibrationModal(false);
          }}
        />
      )}
    </div>
  );
}
