import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  PlusCircle, 
  BookOpen, 
  FileCode, 
  HelpCircle, 
  Users, 
  FolderPlus, 
  CheckCircle,
  Eye,
  AlertCircle,
  Award,
  ShieldCheck,
  Copy,
  CheckCheck,
  Play,
  Square
} from 'lucide-react';

const TeacherDashboard = () => {
  const [courses, setCourses] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses');

  // Modal / Form state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);

  // Session state
  const [sessions, setSessions] = useState([]);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionCourseId, setSessionCourseId] = useState('');
  const [sessionDuration, setSessionDuration] = useState(60);
  const [sessionPassword, setSessionPassword] = useState('');
  const [sessionMaxViolations, setSessionMaxViolations] = useState(5);
  const [sessionBehavioral, setSessionBehavioral] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  // Form inputs
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  // Coding Assignment Inputs
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [starterCode, setStarterCode] = useState('// Write your solution here\nfunction solution(input) {\n  \n}');
  const [language, setLanguage] = useState('javascript');
  const [testCases, setTestCases] = useState([{ input: '', expectedOutput: '' }]);

  // Quiz Inputs
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState([
    { questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }
  ]);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const courseRes = await axios.get('/api/courses');
      setCourses(courseRes.data);
      if (courseRes.data.length > 0) {
        setSelectedCourseId(courseRes.data[0]._id);
        setSessionCourseId(courseRes.data[0]._id);
      }

      // Fetch monitoring sessions
      try {
        const sessionRes = await axios.get('/api/sessions');
        setSessions(sessionRes.data);
      } catch (_) {
        // sessions may not exist yet
      }

      // Fetch submissions for all teacher's courses
      const allSubmissions = [];
      const allQuizResults = [];

      for (const course of courseRes.data) {
        const detailRes = await axios.get(`/api/courses/${course._id}`);
        const { assignments, quizzes } = detailRes.data;

        // Fetch submissions for each assignment
        if (assignments) {
          for (const assignment of assignments) {
            const subRes = await axios.get(`/api/assignments/${assignment._id}/submissions`);
            subRes.data.forEach(sub => {
              allSubmissions.push({
                ...sub,
                assignmentTitle: assignment.title,
                courseTitle: course.title
              });
            });
          }
        }

        // Fetch results for each quiz
        if (quizzes) {
          for (const quiz of quizzes) {
            const resultRes = await axios.get(`/api/quizzes/${quiz._id}/results`);
            resultRes.data.forEach(res => {
              allQuizResults.push({
                ...res,
                quizTitle: quiz.title,
                courseTitle: course.title
              });
            });
          }
        }
      }

      setSubmissions(allSubmissions);
      setQuizResults(allQuizResults);

    } catch (err) {
      console.error('Error fetching teacher data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseTitle || !courseDesc) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await axios.post('/api/courses', { title: courseTitle, description: courseDesc });
      setMessage('Course created successfully!');
      setCourseTitle('');
      setCourseDesc('');
      setShowCourseForm(false);
      fetchTeacherData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create course');
    }
  };

  // Coding Assignment Test Case Helpers
  const addTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '' }]);
  };

  const removeTestCase = (index) => {
    setTestCases(testCases.filter((_, idx) => idx !== index));
  };

  const updateTestCase = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !assignmentTitle || !assignmentDesc || testCases.some(tc => !tc.expectedOutput)) {
      setError('Please provide title, description, and expected outputs for all test cases.');
      return;
    }

    try {
      await axios.post('/api/assignments', {
        course: selectedCourseId,
        title: assignmentTitle,
        description: assignmentDesc,
        starterCode,
        language,
        testCases
      });

      setMessage('Coding Assignment created successfully!');
      setAssignmentTitle('');
      setAssignmentDesc('');
      setTestCases([{ input: '', expectedOutput: '' }]);
      setShowAssignmentForm(false);
      fetchTeacherData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create assignment');
    }
  };

  // Quiz Question Helpers
  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, idx) => idx !== index));
  };

  const updateQuestionText = (index, val) => {
    const updated = [...questions];
    updated[index].questionText = val;
    setQuestions(updated);
  };

  const updateQuestionOption = (qIdx, oIdx, val) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = val;
    setQuestions(updated);
  };

  const updateQuestionCorrect = (qIdx, val) => {
    const updated = [...questions];
    updated[qIdx].correctAnswerIndex = Number(val);
    setQuestions(updated);
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !quizTitle || !quizDesc || questions.some(q => !q.questionText || q.options.some(o => !o))) {
      setError('Please complete all questions and their choices.');
      return;
    }

    try {
      await axios.post('/api/quizzes', {
        course: selectedCourseId,
        title: quizTitle,
        description: quizDesc,
        durationMinutes: duration,
        questions
      });

      setMessage('Quiz created successfully!');
      setQuizTitle('');
      setQuizDesc('');
      setDuration(30);
      setQuestions([{ questionText: '', options: ['', '', '', ''], correctAnswerIndex: 0 }]);
      setShowQuizForm(false);
      fetchTeacherData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quiz');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionTitle || !sessionCourseId) {
      setError('Please provide a session title and select a course.');
      return;
    }
    try {
      await axios.post('/api/sessions', {
        title: sessionTitle,
        course: sessionCourseId,
        durationMinutes: sessionDuration,
        sessionPassword: sessionPassword,
        maxViolations: sessionMaxViolations,
        behavioralMonitoring: sessionBehavioral,
      });
      setMessage('Monitoring session created successfully!');
      setSessionTitle('');
      setSessionDuration(60);
      setSessionPassword('');
      setSessionBlacklistedApps('chrome, discord, vscode');
      setSessionBlacklistedKeywords('chatgpt, stackoverflow, solution');
      setSessionBehavioral(true);
      setShowSessionForm(false);
      fetchTeacherData();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUpdateStatus = async (sessionId, newStatus) => {
    try {
      await axios.patch(`/api/sessions/${sessionId}/status`, { status: newStatus });
      fetchTeacherData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update session status');
    }
  };

  // Calculate stats
  const totalStudents = courses.reduce((sum, c) => sum + (c.studentsEnrolled?.length || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Teacher Panel</h1>
          <p className="text-slate-500 dark:text-slate-400">Create content, manage your classrooms, and monitor submissions.</p>
        </div>
        
        {/* Creator shortcuts */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => { setShowCourseForm(true); setError(''); }}
            className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 hover:bg-brand-100 dark:hover:bg-brand-900/50 px-4 py-2.5 rounded-xl border border-brand-100 dark:border-brand-900/30 transition-all"
          >
            <FolderPlus size={16} />
            <span>New Course</span>
          </button>
          
          <button
            onClick={() => { setShowAssignmentForm(true); setError(''); }}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 transition-all"
            disabled={courses.length === 0}
          >
            <FileCode size={16} />
            <span>New Assignment</span>
          </button>

          <button
            onClick={() => { setShowQuizForm(true); setError(''); }}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-4 py-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30 transition-all"
            disabled={courses.length === 0}
          >
            <HelpCircle size={16} />
            <span>New Quiz</span>
          </button>

          <button
            onClick={() => { setShowSessionForm(true); setError(''); }}
            className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 px-4 py-2.5 rounded-xl border border-violet-100 dark:border-violet-900/30 transition-all"
            disabled={courses.length === 0}
          >
            <ShieldCheck size={16} />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
          {message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Courses</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{courses.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Enrolled</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{totalStudents}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <FileCode size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Coding Solutions</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{submissions.length}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Quiz Attempts</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{quizResults.length}</h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
        {['courses', 'coding-submissions', 'quiz-grades', 'sessions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-bold capitalize transition-all border-b-2 px-1 ${
              activeTab === tab
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'sessions' ? (
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} />
                Monitoring Sessions
                {sessions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 rounded-full text-[10px] font-black">
                    {sessions.length}
                  </span>
                )}
              </span>
            ) : tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Course List Tab */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Managed Classrooms</h3>
          {courses.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <p className="text-slate-400 text-sm">You haven't created any courses yet.</p>
              <button 
                onClick={() => setShowCourseForm(true)}
                className="mt-3 text-xs font-bold text-brand-600 hover:underline"
              >
                Create your first course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courses.map(c => (
                <div key={c._id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:shadow-md transition-all">
                  <div>
                    <h4 className="font-extrabold text-lg text-slate-900 dark:text-white">{c.title}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 line-clamp-2">{c.description}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      <Users size={14} />
                      {c.studentsEnrolled?.length || 0} Students
                    </span>
                    <Link 
                      to={`/courses/${c._id}`} 
                      className="text-brand-600 dark:text-brand-400 hover:underline font-bold"
                    >
                      View Classroom &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'coding-submissions' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Coding Assignment Submissions</h3>
          </div>
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No code submissions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Assignment</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions.map(sub => (
                    <tr key={sub._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{sub.student?.name}</td>
                      <td className="px-6 py-4 text-slate-500">{sub.courseTitle}</td>
                      <td className="px-6 py-4 text-slate-500">{sub.assignmentTitle}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          sub.status === 'pass' 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {sub.testCasesPassed} / {sub.testCasesTotal}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quiz Grades Tab */}
      {activeTab === 'quiz-grades' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">Quiz Attempt Scores</h3>
          </div>
          {quizResults.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No quiz attempts yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Course</th>
                    <th className="px-6 py-3">Quiz</th>
                    <th className="px-6 py-3">Score</th>
                    <th className="px-6 py-3">Percentage</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quizResults.map(res => (
                    <tr key={res._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{res.student?.name}</td>
                      <td className="px-6 py-4 text-slate-500">{res.courseTitle}</td>
                      <td className="px-6 py-4 text-slate-500">{res.quizTitle}</td>
                      <td className="px-6 py-4 font-medium">{res.score} / {res.totalQuestions}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          res.percentage >= 70 
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                        }`}>
                          {res.percentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(res.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Monitoring Sessions</h3>
            <button
              onClick={() => { setShowSessionForm(true); setError(''); }}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 px-3 py-2 rounded-xl border border-violet-100 dark:border-violet-900/30 transition-all"
              disabled={courses.length === 0}
            >
              <ShieldCheck size={14} />
              New Session
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <ShieldCheck size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm">No monitoring sessions yet.</p>
              <button
                onClick={() => setShowSessionForm(true)}
                className="mt-3 text-xs font-bold text-violet-600 hover:underline"
              >
                Create your first session
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map(s => (
                <div key={s._id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 hover:shadow-md transition-all">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white">{s.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{s.course?.title}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      s.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                        : s.status === 'ended'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                    }`}>
                      {s.status === 'active' ? '● LIVE' : s.status === 'ended' ? 'Ended' : '○ Pending'}
                    </span>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2">
                      <p className="text-xs font-bold text-slate-400">Students</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white">{s.enrolledStudents?.length || 0}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2">
                      <p className="text-xs font-bold text-slate-400">Duration</p>
                      <p className="text-lg font-black text-slate-800 dark:text-white">{s.durationMinutes}m</p>
                    </div>
                    <div className={`rounded-xl p-2 ${
                      s.behavioralMonitoring
                        ? 'bg-violet-50 dark:bg-violet-950/30'
                        : 'bg-slate-50 dark:bg-slate-800/50'
                    }`}>
                      <p className="text-xs font-bold text-slate-400">Biometrics</p>
                      <p className={`text-xs font-black mt-1 ${
                        s.behavioralMonitoring
                          ? 'text-violet-600 dark:text-violet-400'
                          : 'text-slate-500'
                      }`}>{s.behavioralMonitoring ? '✓ ON' : '✗ OFF'}</p>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    {/* Copy Session ID */}
                    <button
                      onClick={() => handleCopyId(s._id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      title="Copy Session ID for SentryClass agent"
                    >
                      {copiedId === s._id ? <CheckCheck size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      {copiedId === s._id ? 'Copied!' : 'Copy Session ID'}
                    </button>

                    {/* Status controls */}
                    <div className="flex gap-2">
                      {s.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(s._id, 'active')}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                        >
                          <Play size={12} /> Start
                        </button>
                      )}
                      {s.status === 'active' && (
                        <>
                          <button
                            onClick={() => navigate(`/session/teacher/${s._id}`)}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                          >
                            <Eye size={12} /> Watch Live
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(s._id, 'ended')}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors"
                          >
                            <Square size={12} /> End
                          </button>
                        </>
                      )}
                      {s.status === 'ended' && (
                        <span className="text-xs text-slate-400 font-semibold">Session completed</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Course */}
      {showCourseForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">Create New Course</h3>
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Course Title</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="Introduction to Programming"
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Description</label>
                <textarea
                  required
                  rows={4}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="Provide an overview of the curriculum and learning goals..."
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseForm(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Coding Assignment */}
      {showAssignmentForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 max-w-2xl w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4 my-8">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">Create Coding Assignment</h3>
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Course Link</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                  >
                    {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                  >
                    <option value="javascript">JavaScript (Node VM)</option>
                    <option value="python">Python</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Assignment Title</label>
                <input
                  type="text"
                  required
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  placeholder="Sum two numbers"
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Instructions / Description</label>
                <textarea
                  required
                  rows={3}
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                  placeholder="Write a solution that sums two inputs..."
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Starter Code Template</label>
                <textarea
                  rows={4}
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  className="w-full font-mono bg-slate-900 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {/* Test Cases */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Test Cases (Arguments & Expected Outputs)</label>
                  <button
                    type="button"
                    onClick={addTestCase}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    + Add Test Case
                  </button>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {testCases.map((tc, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        required
                        value={tc.input}
                        onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                        placeholder="Args: 5, 10"
                        className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                      />
                      <input
                        type="text"
                        required
                        value={tc.expectedOutput}
                        onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)}
                        placeholder="Expected Return: 15"
                        className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none dark:text-white"
                      />
                      {testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTestCase(idx)}
                          className="text-rose-500 text-xs font-bold px-2 py-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignmentForm(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Quiz */}
      {showQuizForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 max-w-3xl w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4 my-8">
            <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">Create Quiz</h3>
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Course Link</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                  >
                    {courses.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Duration (Minutes)</label>
                  <input
                    type="number"
                    required
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Quiz Title</label>
                <input
                  type="text"
                  required
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="Midterm Quiz"
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Instructions</label>
                <textarea
                  required
                  rows={2}
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                  placeholder="No calculators allowed..."
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:text-white"
                />
              </div>

              {/* Questions Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Questions & Answer Options</label>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    + Add Question
                  </button>
                </div>

                <div className="space-y-4 max-h-56 overflow-y-auto pr-1">
                  {questions.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-850 space-y-2 relative bg-slate-50/20 dark:bg-slate-800/10">
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="absolute right-3 top-2.5 text-rose-500 text-xs font-bold hover:underline"
                        >
                          Remove
                        </button>
                      )}
                      
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400">Question {qIdx + 1}</span>
                        <input
                          type="text"
                          required
                          value={q.questionText}
                          onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                          placeholder="What is the result of typeof NaN?"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <input
                            key={oIdx}
                            type="text"
                            required
                            value={opt}
                            onChange={(e) => updateQuestionOption(qIdx, oIdx, e.target.value)}
                            placeholder={`Choice ${oIdx + 1}`}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none dark:text-white"
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-slate-500">Correct Choice Key:</label>
                        <select
                          value={q.correctAnswerIndex}
                          onChange={(e) => updateQuestionCorrect(qIdx, e.target.value)}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none dark:text-white"
                        >
                          <option value={0}>Choice 1</option>
                          <option value={1}>Choice 2</option>
                          <option value={2}>Choice 3</option>
                          <option value={3}>Choice 4</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuizForm(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-650 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
                >
                  Publish Quiz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Monitoring Session */}
      {showSessionForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">Create Monitoring Session</h3>
                <p className="text-xs text-slate-400 mt-0.5">SentryClass will use this session's ID to connect</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              {/* Session Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Session Name</label>
                <input
                  type="text"
                  required
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="Midterm Practical Exam — Batch A"
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Course + Duration row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Link to Course</label>
                  <select
                    value={sessionCourseId}
                    onChange={(e) => setSessionCourseId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    {courses.map(c => <option key={c._id} value={c._id}>{c.title} ({c.studentsEnrolled?.length || 0} students)</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Duration (Minutes)</label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={300}
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Session Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Session Password <span className="font-normal normal-case text-slate-300">(leave blank for no password)</span></label>
                <input
                  type="password"
                  value={sessionPassword}
                  onChange={(e) => setSessionPassword(e.target.value)}
                  placeholder="e.g. exam2025"
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Max Violations */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Max Allowed Violations</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sessionMaxViolations}
                  onChange={(e) => setSessionMaxViolations(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Auto-enrolled students hint */}
              {sessionCourseId && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <Users size={13} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{courses.find(c => c._id === sessionCourseId)?.studentsEnrolled?.length || 0} students</strong> enrolled in this course will be automatically authorized for this session.
                  </span>
                </div>
              )}

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSessionForm(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <ShieldCheck size={14} />
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;
