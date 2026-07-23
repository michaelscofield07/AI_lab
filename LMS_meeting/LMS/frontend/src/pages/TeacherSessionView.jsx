import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  PhoneOff, Users, MessageSquare, X, Send,
  AlertTriangle, Shield, Wifi, WifiOff,
  LayoutGrid, ChevronDown, Eye, Maximize2, Award, FileText
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
  const [studentFrames, setStudentFrames] = useState({});
  const [participants, setParticipants] = useState([]);

  // Big Screen Focus View (Clicked student)
  const [focusedStudent, setFocusedStudent] = useState(null); // { sId, name, imageUrl }
  const [studentTab, setStudentTab] = useState('anomalies'); // 'anomalies' | 'marks'
  const [studentAnswers, setStudentAnswers] = useState({}); // studentId -> results

  // Panels & Anomaly logs
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAnomalies, setShowAnomalies] = useState(false);
  const [anomalies, setAnomalies] = useState([]);
  
  // High-Priority Red Anomaly Alert Toast (Teacher Only)
  const [redPopupAlert, setRedPopupAlert] = useState(null);
  const [selectedEvidenceFrame, setSelectedEvidenceFrame] = useState(null);

  // Chat — teacher clicks a participant
  const [showChat, setShowChat] = useState(false);
  const [chatTarget, setChatTarget] = useState(null);
  const [chatMessages, setChatMessages] = useState({});
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Refs
  const socketRef = useRef(null);
  const prevBlobUrls = useRef({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatTarget]);

  // --- Load session info & past audit logs ---
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get(`/api/sessions/${sessionId}`);
        setSessionInfo(res.data);
        connectSocket(res.data);

        // Fetch existing audit logs for this session
        try {
          const logRes = await axios.get(`/api/sessions/${sessionId}/audit-logs`);
          if (logRes.data) {
            setAnomalies(logRes.data.map(l => ({
              id: l._id,
              studentId: l.student?._id || l.student,
              studentName: l.studentName || l.student?.name || 'Student',
              reason: `${l.eventType} (${l.outputCode}): ${l.reason}`,
              score: l.score,
              combinedRisk: l.combinedRisk,
              outputCode: l.outputCode,
              evidenceFrame: l.evidenceFrame,
              popupTriggered: l.popupTriggered,
              timestamp: new Date(l.createdAt).toLocaleTimeString(),
            })));
          }
        } catch (_) {}

        // Fetch quiz results for marks & paragraph answers
        if (res.data?.quiz?._id) {
          try {
            const qRes = await axios.get(`/api/quizzes/${res.data.quiz._id}/results`);
            if (qRes.data) {
              const answersMap = {};
              qRes.data.forEach(r => {
                const sId = r.student?._id || r.student;
                answersMap[sId] = r;
              });
              setStudentAnswers(answersMap);
            }
          } catch (_) {}
        }
      } catch (err) {
        setStatus('error');
      }
    };
    fetchSession();

    return () => {
      Object.values(prevBlobUrls.current).forEach(URL.revokeObjectURL);
      socketRef.current?.disconnect();
    };
  }, [sessionId]);

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
        role: 'teacher',
      });
      socket.emit('broadcast-teacher-socket', { sessionId, socketId: socket.id });
    });

    socket.on('connect_error', () => setStatus('error'));

    socket.on('participants-update', (list) => {
      setParticipants(list);
    });

    socket.on('student-frame', ({ studentId, studentName, frame }) => {
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

      // Update focused student frame if active
      setFocusedStudent(prev => {
        if (prev && prev.sId === studentId) {
          return { ...prev, imageUrl: url };
        }
        return prev;
      });
    });

    socket.on('student-disconnected', ({ studentId }) => {
      setStudentFrames(prev => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    });

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
      if (!chatTarget || chatTarget.socketId !== fromSocketId) {
        setChatTarget({ socketId: fromSocketId, name: senderName });
        setShowChat(true);
      }
    });

    socket.on('screenshot-audit-event', (data) => {
      setAnomalies(prev => [{
        id: data.logId || Date.now(),
        studentId: data.studentId,
        studentName: data.studentName,
        reason: `${data.eventType} (${data.outputCode}): ${data.reason}`,
        score: data.score,
        combinedRisk: data.combinedRisk,
        outputCode: data.outputCode,
        evidenceFrame: data.evidenceFrame,
        popupTriggered: data.popupTriggered,
        timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
      }, ...prev]);
    });

    socket.on('teacher-red-popup', (data) => {
      setRedPopupAlert(data);
    });

    // Student submitted quiz — show live toast + save answers in state
    socket.on('student-quiz-submitted', (data) => {
      // Save their auto-graded choose answers into studentAnswers map
      setStudentAnswers(prev => ({
        ...prev,
        [data.studentId]: {
          percentage: data.percentage,
          score: data.score,
          totalMarks: data.totalMarks,
          chooseAnswers: data.chooseAnswers || [],
          submittedAt: data.timestamp,
        },
      }));

      // Show a green toast notification to the teacher
      setRedPopupAlert({
        isSubmission: true,
        studentId: data.studentId,
        studentName: data.studentName,
        title: `✅ ${data.studentName} submitted the assessment`,
        message: `Score: ${data.score}/${data.totalMarks} (${data.percentage?.toFixed(1)}%)`,
        outputCode: 'submitted',
        timestamp: data.timestamp,
      });
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

  const focusOnStudent = (studentId, studentName) => {
    const frameObj = studentFrames[studentId];
    setFocusedStudent({
      sId: studentId,
      name: studentName || frameObj?.name || 'Student',
      imageUrl: frameObj?.imageUrl || '',
    });
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

  const studentEntries = Object.entries(studentFrames);

  const gridCols = gridSize === 10
    ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
    : 'grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7';

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 max-w-md text-center space-y-4">
          <AlertTriangle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold text-white">Connection Error</h2>
          <p className="text-slate-400 text-sm">Cannot connect to monitoring server.</p>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-sm">{sessionInfo?.title || 'Monitoring Session'}</h1>
              {sessionInfo?.quiz && (
                <span className="px-2 py-0.5 bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] rounded-full">
                  Quiz Linked: {sessionInfo.quiz.title}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs">{sessionInfo?.course?.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowGridMenu(m => !m)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              <LayoutGrid size={14} />
              <span>{gridSize} Tiles</span>
              <ChevronDown size={12} />
            </button>
            {showGridMenu && (
              <div className="absolute right-0 mt-1 w-32 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-50">
                {GRID_OPTIONS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setGridSize(n); setShowGridMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-800 ${gridSize === n ? 'text-violet-400 font-bold' : 'text-slate-300'}`}
                  >
                    {n} Tiles Grid
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {status === 'joined' ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Wifi size={12} /> Live ({studentEntries.length} Active)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-400 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                <WifiOff size={12} /> Connecting…
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="flex-1 p-6 overflow-y-auto relative">
        {studentEntries.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
                <Users size={28} className="text-slate-500" />
              </div>
              <p className="text-white font-semibold">Waiting for students to join…</p>
              <p className="text-slate-500 text-xs">Click any student tile when active to open Big Screen & Logs view</p>
            </div>
          </div>
        ) : (
          <div className={`grid ${gridCols} gap-4`}>
            {studentEntries.map(([sId, { name, imageUrl }]) => (
              <div
                key={sId}
                onClick={() => setFocusedStudent({ sId, name, imageUrl })}
                className="bg-slate-900 border border-slate-800 hover:border-violet-500/60 cursor-pointer rounded-2xl overflow-hidden shadow-lg flex flex-col group relative transition-all"
              >
                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                  <img src={imageUrl} alt={name} className="w-full h-full object-contain" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    5 FPS
                  </span>
                  <div className="absolute inset-0 bg-violet-600/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="px-3 py-1.5 bg-slate-900/90 text-violet-300 text-xs font-bold rounded-xl border border-violet-500/40 shadow-xl flex items-center gap-1.5">
                      <Maximize2 size={14} /> Open Big Screen & Logs
                    </span>
                  </div>
                </div>
                <div className="px-3 py-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-white font-semibold truncate">{name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const p = participants.find(part => part.userId === sId);
                      if (p) openChatWith(p);
                    }}
                    className="p-1 bg-slate-800 hover:bg-violet-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    <MessageSquare size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STUDENT BIG SCREEN FOCUS MODAL WITH PARTITIONED LOGS */}
      {focusedStudent && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-sm">
                  {focusedStudent.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">{focusedStudent.name}</h2>
                  <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Live 5 FPS Stream • Individual Proctoring Focus
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const p = participants.find(part => part.userId === focusedStudent.sId);
                    if (p) openChatWith(p);
                  }}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <MessageSquare size={14} /> Message Student
                </button>
                <button onClick={() => setFocusedStudent(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Left Big Screen Stream, Right Partitioned Student Logs */}
            <div className="flex-1 flex overflow-hidden">
              {/* Big Screen Stream */}
              <div className="flex-1 bg-black p-4 flex items-center justify-center relative">
                <img src={focusedStudent.imageUrl} alt={focusedStudent.name} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" />
                <span className="absolute top-6 left-6 px-3 py-1 bg-slate-900/80 backdrop-blur-md border border-slate-800 text-emerald-400 text-xs font-mono font-bold rounded-full">
                  LIVE BIG SCREEN VIEW
                </span>
              </div>

              {/* Individual Student Audit Logs & Marks Drawer */}
              <div className="w-96 bg-slate-900/90 border-l border-slate-800 flex flex-col">
                {/* Partition Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/50">
                  <button
                    onClick={() => setStudentTab('anomalies')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                      studentTab === 'anomalies'
                        ? 'border-violet-500 text-violet-400 bg-violet-500/10'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle size={14} /> Anomaly Logs
                  </button>
                  <button
                    onClick={() => setStudentTab('marks')}
                    className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                      studentTab === 'marks'
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Award size={14} /> Marks & Answers
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {studentTab === 'anomalies' ? (
                    anomalies.filter(a => a.studentId === focusedStudent.sId).length === 0 ? (
                      <div className="text-center py-12 space-y-2">
                        <Shield size={28} className="mx-auto text-emerald-500/40" />
                        <p className="text-slate-400 text-xs font-medium">Clean Session Log</p>
                        <p className="text-slate-600 text-[10px]">No behavioral anomalies detected for this student yet.</p>
                      </div>
                    ) : (
                      anomalies.filter(a => a.studentId === focusedStudent.sId).map(a => (
                        <div key={a.id} className={`p-3 rounded-xl border ${
                          a.outputCode?.startsWith('r') 
                            ? 'bg-rose-500/10 border-rose-500/30' 
                            : 'bg-amber-500/10 border-amber-500/30'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md ${
                              a.outputCode?.startsWith('r')
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {a.outputCode}
                            </span>
                            <span className="text-[10px] text-slate-500">{a.timestamp}</span>
                          </div>
                          <p className="text-slate-200 text-xs font-medium mt-1.5">{a.reason}</p>

                          {a.evidenceFrame && (
                            <button
                              onClick={() => setSelectedEvidenceFrame(a.evidenceFrame)}
                              className="mt-2 text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                            >
                              <Eye size={12} /> View 480p Evidence Snapshot
                            </button>
                          )}
                        </div>
                      ))
                    )
                  ) : (
                    /* Tab 2: Marks & Answers */
                    !studentAnswers[focusedStudent.sId] ? (
                      <div className="text-center py-12 space-y-2">
                        <FileText size={28} className="mx-auto text-slate-600" />
                        <p className="text-slate-400 text-xs font-medium">No Submitted Answers Yet</p>
                        <p className="text-slate-600 text-[10px]">Student has not submitted the assessment response yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Multiple Choice Score</p>
                            <h4 className="text-xl font-extrabold text-emerald-400">
                              {Number(studentAnswers[focusedStudent.sId].percentage ?? 0).toFixed(1)}%
                            </h4>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30">
                            {studentAnswers[focusedStudent.sId].score} / {studentAnswers[focusedStudent.sId].totalMarks} Correct
                          </span>
                        </div>

                        {/* Answers Breakdown (Multiple Choice + Paragraph Responses) */}
                        {studentAnswers[focusedStudent.sId].chooseAnswers?.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Submitted Answers & Responses:</h4>
                            {studentAnswers[focusedStudent.sId].chooseAnswers.map((ans, idx) => {
                              if (ans.questionType === 'paragraph') {
                                return (
                                  <div key={idx} className="p-3 rounded-xl border border-slate-700 bg-slate-800/40 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-violet-400">Q{ans.questionIndex + 1} (Paragraph Response)</span>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                        Keystroke Logged
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-200 font-medium">{ans.questionText}</p>
                                    <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-xs text-slate-300 font-sans italic">
                                      "{ans.paragraphText || '(No paragraph text submitted)'}"
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={idx} className={`p-3 rounded-xl border space-y-1 ${
                                  ans.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-violet-400">Q{ans.questionIndex + 1}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      ans.isCorrect
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                    }`}>
                                      {ans.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-200 font-medium">{ans.questionText}</p>
                                  <p className="text-[11px] text-slate-400">
                                    Selected: <span className="font-bold text-white">{ans.selectedOption || 'No Answer'}</span>
                                  </p>
                                  {!ans.isCorrect && (
                                    <p className="text-[11px] text-emerald-400">
                                      Correct: <span className="font-bold">{ans.correctOption}</span>
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NON-BLOCKING BOTTOM-RIGHT TOAST NOTIFICATION (Teacher Only) */}
      {redPopupAlert && (
        <div className={`fixed right-6 bottom-24 z-50 animate-in slide-in-from-bottom-5 duration-300 w-96 bg-slate-900 border p-5 rounded-2xl shadow-2xl space-y-3 ${
          redPopupAlert.isSubmission
            ? 'border-emerald-500/50'
            : 'border-rose-500/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{redPopupAlert.isSubmission ? '✅' : '🚨'}</span>
              <h3 className="text-sm font-bold text-white">{redPopupAlert.title}</h3>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md border ${
              redPopupAlert.isSubmission
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {redPopupAlert.outputCode || 'RED_ALERT'}
            </span>
          </div>

          <p className="text-slate-300 text-xs">{redPopupAlert.message}</p>

          {!redPopupAlert.isSubmission && redPopupAlert.evidenceFrame && (
            <div className="rounded-lg overflow-hidden border border-slate-800 bg-black">
              <img src={redPopupAlert.evidenceFrame} alt="480p Screenshot Evidence" className="w-full h-32 object-cover" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {!redPopupAlert.isSubmission && (
              <button
                onClick={() => {
                  focusOnStudent(redPopupAlert.studentId, redPopupAlert.studentName);
                  setRedPopupAlert(null);
                }}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-violet-900/40"
              >
                <Maximize2 size={13} /> Focus Student Big Screen
              </button>
            )}
            {redPopupAlert.isSubmission && (
              <button
                onClick={() => {
                  focusOnStudent(redPopupAlert.studentId, redPopupAlert.studentName);
                  setRedPopupAlert(null);
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-900/40"
              >
                <Eye size={13} /> View Marks & Answers
              </button>
            )}
            <button
              onClick={() => setRedPopupAlert(null)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Evidence Frame Preview Modal */}
      {selectedEvidenceFrame && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-white font-bold text-sm">Screenshot Evidence (480p Compressed JPEG)</h3>
              <button onClick={() => setSelectedEvidenceFrame(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-black">
              <img src={selectedEvidenceFrame} alt="Evidence Frame" className="w-full h-auto max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Anomaly History panel (Grouped by Student ID — 1 box per user) */}
      {showAnomalies && (
        <div className="fixed right-4 top-16 bottom-24 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-white font-bold text-sm">Session Anomaly Summary</h3>
            <button onClick={() => setShowAnomalies(false)} className="text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {anomalies.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-6">No anomalies logged yet</p>
            ) : (
              (() => {
                const groupMap = {};
                anomalies.forEach((a) => {
                  const sId = a.studentId || 'unknown';
                  if (!groupMap[sId]) {
                    groupMap[sId] = {
                      studentId: sId,
                      studentName: a.studentName || 'Student',
                      logs: [],
                      redCount: 0,
                      yellowCount: 0,
                      latestLog: a,
                    };
                  }
                  groupMap[sId].logs.push(a);
                  if (a.outputCode?.startsWith('r')) groupMap[sId].redCount += 1;
                  else groupMap[sId].yellowCount += 1;
                  groupMap[sId].latestLog = a;
                });

                const groupedList = Object.values(groupMap);

                return groupedList.map(group => (
                  <div
                    key={group.studentId}
                    onClick={() => {
                      focusOnStudent(group.studentId, group.studentName);
                      setStudentTab('anomalies');
                    }}
                    className="p-3.5 bg-slate-950/60 border border-slate-800 hover:border-violet-500/60 rounded-2xl cursor-pointer transition-all space-y-2 group shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-white text-xs font-bold flex items-center gap-1.5 group-hover:text-violet-300">
                        <Maximize2 size={12} className="text-violet-400" />
                        {group.studentName}
                      </p>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        {group.logs.length} Log{group.logs.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {group.redCount > 0 && (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold rounded-md">
                          {group.redCount} RED
                        </span>
                      )}
                      {group.yellowCount > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded-md">
                          {group.yellowCount} YELLOW
                        </span>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                      <span className="truncate max-w-[170px] text-slate-300">Latest: {group.latestLog.reason}</span>
                      <span className="text-[10px] text-violet-400 font-semibold group-hover:underline">Logs →</span>
                    </div>
                  </div>
                ));
              })()
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
            <button onClick={sendChat} className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-center gap-4">
        <button
          onClick={() => { setShowParticipants(p => !p); setShowChat(false); setShowAnomalies(false); }}
          className={`relative flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl border transition-all ${
            showParticipants
              ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <Users size={22} />
          <span className="text-[10px] font-semibold">People</span>
        </button>

        <button
          onClick={() => { setShowChat(c => !c); setShowParticipants(false); setShowAnomalies(false); }}
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
          onClick={() => { setShowAnomalies(a => !a); setShowParticipants(false); setShowChat(false); }}
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

        <button
          onClick={endSession}
          className="flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border border-rose-500 transition-all"
        >
          <PhoneOff size={22} />
          <span className="text-[10px] font-semibold">End</span>
        </button>
      </div>
    </div>
  );
}
