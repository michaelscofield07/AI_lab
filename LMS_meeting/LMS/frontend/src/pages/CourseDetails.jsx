import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Common/Layout';
import { 
  BookOpen, 
  FileCode, 
  HelpCircle, 
  CheckCircle2, 
  Play, 
  Users, 
  ArrowLeft,
  Calendar,
  Award
} from 'lucide-react';

const CourseDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/courses/${id}`);
      setCourse(res.data.course);
      setAssignments(res.data.assignments || []);
      setQuizzes(res.data.quizzes || []);
      
      if (user.role === 'student' && res.data.studentData) {
        setStudentSubmissions(res.data.studentData.submissions || []);
        setStudentResults(res.data.studentData.results || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseDetails();
  }, [id]);

  // Student completion helpers
  const getAssignmentStatus = (assignmentId) => {
    const subs = studentSubmissions.filter(s => s.assignment === assignmentId);
    if (subs.length === 0) return { completed: false };
    
    const passed = subs.some(s => s.status === 'pass');
    const bestScore = Math.max(...subs.map(s => Math.round((s.testCasesPassed / s.testCasesTotal) * 100) || 0));
    
    return {
      completed: true,
      passed,
      bestScore,
      attemptsCount: subs.length
    };
  };

  const getQuizStatus = (quizId) => {
    const result = studentResults.find(r => r.quiz === quizId);
    if (!result) return { completed: false };
    return {
      completed: true,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage
    };
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-96">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (error || !course) {
    return (
      <Layout>
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 p-6 rounded-2xl text-rose-600 text-sm max-w-lg mx-auto text-center space-y-4">
          <p>{error || 'Course not found'}</p>
          <Link to="/dashboard" className="inline-block text-xs font-bold bg-rose-600 text-white px-4 py-2 rounded-lg">
            Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        
        {/* Back navigation */}
        <Link 
          to="/dashboard" 
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </Link>

        {/* Hero banner card */}
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-8 rounded-3xl text-white shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="bg-white/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Course Classroom
              </span>
              <h1 className="text-3xl font-black mt-2">{course.title}</h1>
              <p className="text-indigo-100 mt-2 max-w-2xl">{course.description}</p>
            </div>
            <div className="flex items-center gap-2 bg-black/10 px-4 py-2.5 rounded-2xl border border-white/10 text-sm">
              <Calendar size={16} />
              <span>Created {new Date(course.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="flex gap-6 pt-4 border-t border-white/10 text-xs font-semibold text-indigo-100">
            <span>Instructor: <strong className="text-white">{course.teacher?.name}</strong></span>
            <span>Email: <strong className="text-white">{course.teacher?.email}</strong></span>
            {user.role !== 'student' && (
              <span className="flex items-center gap-1">
                <Users size={14} />
                {course.studentsEnrolled?.length || 0} Registered Students
              </span>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Coding & Quizzes Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Coding Assignments */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode size={20} className="text-emerald-600" />
                Coding Assignments
              </h3>

              {assignments.length === 0 ? (
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
                  No coding exercises published for this course yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map(assignment => {
                    const status = getAssignmentStatus(assignment._id);
                    return (
                      <div 
                        key={assignment._id} 
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white">{assignment.title}</h4>
                            <span className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded capitalize">
                              {assignment.language}
                            </span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2">{assignment.description}</p>
                          
                          {/* Student Attempts Status */}
                          {user.role === 'student' && status.completed && (
                            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 size={14} />
                                {status.passed ? 'Passed all test cases' : 'Submitted'}
                              </span>
                              <span>Best Score: <strong className="text-slate-700 dark:text-slate-300">{status.bestScore}%</strong></span>
                              <span>Attempts: {status.attemptsCount}</span>
                            </div>
                          )}
                        </div>

                        <div>
                          {user.role === 'student' ? (
                            <Link 
                              to={`/assignments/${assignment._id}/coding`}
                              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl transition-all ${
                                status.completed && status.passed
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10'
                              }`}
                            >
                              <Play size={14} />
                              <span>{status.completed ? 'Code Again' : 'Solve Challenge'}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400 font-semibold italic">
                              {assignment.testCases?.length || 0} test cases
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quizzes */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle size={20} className="text-amber-600" />
                Available Quizzes
              </h3>

              {quizzes.length === 0 ? (
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-400 text-sm">
                  No multiple-choice tests published for this course yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {quizzes.map(quiz => {
                    const status = getQuizStatus(quiz._id);
                    return (
                      <div 
                        key={quiz._id} 
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-all"
                      >
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-900 dark:text-white">{quiz.title}</h4>
                          <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2">{quiz.description}</p>
                          
                          {/* Student Result Details */}
                          {user.role === 'student' && status.completed && (
                            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                              <span className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 size={14} />
                                Completed
                              </span>
                              <span>Score: <strong className="text-slate-700 dark:text-slate-300">{status.score} / {status.totalQuestions}</strong></span>
                              <span>Percentage: <strong className="text-slate-700 dark:text-slate-300">{status.percentage}%</strong></span>
                            </div>
                          )}
                        </div>

                        <div>
                          {user.role === 'student' ? (
                            status.completed ? (
                              <span className="flex items-center gap-1 text-xs text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 rounded-xl">
                                <Award size={14} />
                                <span>Graded</span>
                              </span>
                            ) : (
                              <Link 
                                to={`/quizzes/${quiz._id}`}
                                className="flex items-center gap-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl shadow-md shadow-amber-500/10 transition-all"
                              >
                                <Play size={14} />
                                <span>Start Quiz ({quiz.durationMinutes}m)</span>
                              </Link>
                            )
                          ) : (
                            <span className="text-xs text-slate-400 font-semibold italic">
                              {quiz.questions?.length || 0} questions
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Roster / Sidebar Column (Teachers/Admins see enrolled student list) */}
          {user.role !== 'student' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit space-y-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b pb-2">
                <Users size={18} className="text-brand-600" />
                Enrolled Roster
              </h3>
              
              {course.studentsEnrolled?.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No students registered in this course yet.</p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {course.studentsEnrolled?.map(student => (
                    <div 
                      key={student._id} 
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs uppercase">
                        {student.name?.slice(0,2)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-xs text-slate-800 dark:text-slate-250 truncate">{student.name}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{student.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </Layout>
  );
};

export default CourseDetails;
