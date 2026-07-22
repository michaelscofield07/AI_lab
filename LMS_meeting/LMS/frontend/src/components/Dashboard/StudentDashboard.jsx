import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  FileCode, 
  HelpCircle, 
  Award, 
  ChevronRight, 
  CheckCircle, 
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  LogIn,
  Clock,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [stats, setStats] = useState({
    enrolledCount: 0,
    assignmentsCount: 0,
    quizzesCount: 0,
    avgScore: 0
  });
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Sessions state
  const [liveSessions, setLiveSessions] = useState([]);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/courses');
      const allCourses = res.data;
      setCourses(allCourses);

      // Filter enrolled vs available
      const enrolled = allCourses.filter(c => 
        c.studentsEnrolled?.some(s => (s._id || s).toString() === user._id.toString())
      );
      const available = allCourses.filter(c => 
        !c.studentsEnrolled?.some(s => (s._id || s).toString() === user._id.toString())
      );

      setEnrolledCourses(enrolled);
      setAvailableCourses(available);

      // Fetch live sessions for enrolled courses
      try {
        const sessRes = await axios.get('/api/sessions/student');
        setLiveSessions(sessRes.data);
      } catch (_) {
        // sessions endpoint may not be available
      }

      setEnrolledCourses(enrolled);
      setAvailableCourses(available);

      // Aggregations from enrolled courses
      let totalAssignments = 0;
      let totalQuizzes = 0;
      let scoreSum = 0;
      let gradedItemsCount = 0;
      const historyData = [];

      for (const course of enrolled) {
        const detailRes = await axios.get(`/api/courses/${course._id}`);
        const { assignments, quizzes, studentData } = detailRes.data;

        totalAssignments += assignments?.length || 0;
        totalQuizzes += quizzes?.length || 0;

        // Process quiz scores
        if (studentData?.results) {
          studentData.results.forEach(res => {
            scoreSum += res.percentage;
            gradedItemsCount++;
            historyData.push({
              name: res.quiz?.title || 'Quiz',
              score: res.percentage,
              type: 'Quiz'
            });
          });
        }

        // Process coding assignment scores
        if (studentData?.submissions) {
          studentData.submissions.forEach(sub => {
            if (sub.status === 'pass') {
              scoreSum += 100;
              gradedItemsCount++;
              historyData.push({
                name: sub.assignment?.title || 'Coding',
                score: 100,
                type: 'Coding'
              });
            } else if (sub.status === 'fail') {
              const passPct = Math.round((sub.testCasesPassed / sub.testCasesTotal) * 100) || 0;
              scoreSum += passPct;
              gradedItemsCount++;
              historyData.push({
                name: sub.assignment?.title || 'Coding',
                score: passPct,
                type: 'Coding'
              });
            }
          });
        }
      }

      setStats({
        enrolledCount: enrolled.length,
        assignmentsCount: totalAssignments,
        quizzesCount: totalQuizzes,
        avgScore: gradedItemsCount > 0 ? Math.round(scoreSum / gradedItemsCount) : 0
      });

      // Default mock history data for premium look if student has no attempts yet
      if (historyData.length === 0) {
        setChartData([
          { name: 'Week 1', score: 60 },
          { name: 'Week 2', score: 75 },
          { name: 'Week 3', score: 70 },
          { name: 'Week 4', score: 85 },
          { name: 'Week 5', score: 90 },
        ]);
      } else {
        setChartData(historyData.slice(-6)); // last 6 items
      }

    } catch (err) {
      console.error('Error fetching student dashboard details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleEnroll = async (courseId) => {
    try {
      await axios.post(`/api/courses/${courseId}/enroll`);
      setMessage('Successfully enrolled in course!');
      setTimeout(() => setMessage(''), 3000);
      fetchDashboardData();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Enrollment failed');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleJoinSession = async (e) => {
    e.preventDefault();
    if (!joinSessionId.trim()) { setJoinError('Please enter a Session ID'); return; }
    setJoinLoading(true);
    setJoinError('');
    try {
      const res = await axios.post(`/api/sessions/${joinSessionId.trim()}/join`, {
        password: joinPassword,
      });
      // Store session info so StudentSessionView can use it without re-fetching
      localStorage.setItem(`session_${joinSessionId.trim()}`, JSON.stringify(res.data));
      navigate(`/session/student/${joinSessionId.trim()}`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to join session');
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Heading */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Student Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Track your courses, programming progress, and test scores.</p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
          {message}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Enrolled Courses */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Enrolled Courses</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.enrolledCount}</h3>
          </div>
        </div>

        {/* Coding Tasks */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <FileCode size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Coding Tasks</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.assignmentsCount}</h3>
          </div>
        </div>

        {/* Available Quizzes */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <HelpCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quiz Assignments</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.quizzesCount}</h3>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Average Grade</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.avgScore}%</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={20} className="text-brand-600" />
                Performance Metrics
              </h3>
              <p className="text-xs text-slate-400">Score progress across quizzes and coding submissions</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: 'none', 
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Info - Quick Status */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Active Courses</h3>
          {enrolledCourses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm">You are not enrolled in any courses.</p>
              <p className="text-xs text-slate-400 mt-1">Enroll in available courses below.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {enrolledCourses.map(c => (
                <Link 
                  key={c._id} 
                  to={`/courses/${c._id}`}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-brand-500 hover:bg-brand-50/10 dark:hover:bg-brand-950/10 transition-all group"
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {c.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">Taught by {c.teacher?.name}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Sessions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-violet-500" />
            Live Sessions
            {liveSessions.some(s => s.status === 'active') && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold animate-pulse">LIVE</span>
            )}
          </h3>
        </div>

        {liveSessions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <ShieldCheck size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No active sessions for your enrolled courses.</p>
            <p className="text-slate-400 text-xs mt-1">Your teacher will start a session before the exam.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveSessions.map(s => (
              <div key={s._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 hover:shadow-md transition-all space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{s.title}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{s.course?.title}</p>
                  </div>
                  <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-bold ${
                    s.status === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-100 dark:border-emerald-900/30'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 border border-amber-100 dark:border-amber-900/30'
                  }`}>
                    {s.status === 'active' ? '● LIVE' : '○ Upcoming'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Clock size={12} /> {s.durationMinutes}m</span>
                  <span>By {s.teacher?.name}</span>
                </div>
                <button
                  onClick={() => {
                    setJoinSessionId(s._id);
                    setShowJoinModal(true);
                    setJoinError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <LogIn size={14} /> Join Session
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Join Session</h3>
                <p className="text-xs text-slate-400">Enter the session password to join</p>
              </div>
              <button onClick={() => setShowJoinModal(false)} className="ml-auto text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {joinError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 text-rose-600 text-xs rounded-lg">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinSession} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Session Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={joinPassword}
                    onChange={e => setJoinPassword(e.target.value)}
                    placeholder="Enter password (if required)"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {joinLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><LogIn size={14} /> Join Now</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courses Catalog Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Course Catalog</h3>
        {availableCourses.length === 0 ? (
          <p className="text-slate-400 text-sm bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
            No new courses available for enrollment.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {availableCourses.map(c => (
              <div key={c._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div className="p-6 space-y-3">
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white">{c.title}</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-3">{c.description}</p>
                  <p className="text-xs font-semibold text-slate-400">Teacher: {c.teacher?.name}</p>
                </div>
                <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Self-Paced</span>
                  <button
                    onClick={() => handleEnroll(c._id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-3.5 py-2 rounded-lg transition-all"
                  >
                    <span>Enroll Now</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentDashboard;
