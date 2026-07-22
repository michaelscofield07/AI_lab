import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Common/Layout';
import { 
  Timer, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  Flag,
  AlertCircle,
  Award,
  CheckCircle,
  XCircle,
  ArrowLeft
} from 'lucide-react';

const QuizPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Quiz taking state
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { questionIndex: selectedOptionIndex }
  const [flaggedQuestions, setFlaggedQuestions] = useState({}); // { questionIndex: Boolean }
  const [timeRemaining, setTimeRemaining] = useState(0); // in seconds
  
  // Result state
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [gradedResult, setGradedResult] = useState(null);
  const [correctAnswersList, setCorrectAnswersList] = useState([]); // from grading endpoint

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const timerRef = useRef(null);

  const fetchQuizData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/quizzes/${id}`);
      setQuiz(res.data);
      setQuestions(res.data.questions || []);
      setTimeRemaining((res.data.durationMinutes || 30) * 60);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // Timer loop
  useEffect(() => {
    if (loading || quizCompleted || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, quizCompleted, timeRemaining]);

  const handleOptionSelect = (optionIdx) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentIndex]: optionIdx
    }));
  };

  const toggleFlagQuestion = () => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [currentIndex]: !prev[currentIndex]
    }));
  };

  const getQuestionStatus = (idx) => {
    if (flaggedQuestions[idx]) return 'flagged';
    if (selectedAnswers[idx] !== undefined) return 'answered';
    return 'unanswered';
  };

  // Convert timer seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleAutoSubmit = () => {
    alert('Time has expired! Your quiz will be automatically submitted.');
    submitAnswers();
  };

  const submitAnswers = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    
    // Map selectedAnswers state to the backend format: [{ questionIndex, selectedAnswerIndex }]
    const formattedAnswers = Object.entries(selectedAnswers).map(([qIdx, optIdx]) => ({
      questionIndex: parseInt(qIdx),
      selectedAnswerIndex: optIdx
    }));

    // Ensure unanswered questions are represented
    questions.forEach((_, idx) => {
      if (selectedAnswers[idx] === undefined) {
        formattedAnswers.push({
          questionIndex: idx,
          selectedAnswerIndex: -1
        });
      }
    });

    try {
      const res = await axios.post(`/api/quizzes/${id}/submit`, { answers: formattedAnswers });
      setGradedResult(res.data.result);
      setCorrectAnswersList(res.data.correctAnswers || []);
      setQuizCompleted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      console.error(err);
      alert('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  // Render Post-Submission results screen
  if (quizCompleted && gradedResult) {
    return (
      <Layout>
        <div className="space-y-6 max-w-3xl mx-auto">
          
          {/* Grade Summary header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <Award size={48} className="text-brand-600 mx-auto" />
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Quiz Completed!</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Classroom: {quiz?.title}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto pt-4 border-t">
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                  {gradedResult.score} / {gradedResult.totalQuestions}
                </p>
              </div>

              <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Percentage</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                  {gradedResult.percentage}%
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Link 
                to={`/courses/${quiz?.course}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-xl transition-all"
              >
                <ArrowLeft size={16} />
                <span>Return to Classroom</span>
              </Link>
            </div>
          </div>

          {/* Graded Question Review */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Graded Answer Review</h3>
            {questions.map((question, qIdx) => {
              const studentAnswer = gradedResult.answers.find(ans => ans.questionIndex === qIdx);
              const selectedIdx = studentAnswer ? studentAnswer.selectedAnswerIndex : -1;
              const correctIdx = correctAnswersList[qIdx];
              const isCorrect = studentAnswer ? studentAnswer.isCorrect : false;

              return (
                <div 
                  key={qIdx} 
                  className={`p-6 rounded-2xl border bg-white dark:bg-slate-900 shadow-sm space-y-4 ${
                    isCorrect 
                      ? 'border-emerald-200 dark:border-emerald-950' 
                      : 'border-rose-205 dark:border-rose-950'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="font-bold text-slate-950 dark:text-white text-sm">
                      Question {qIdx + 1}: {question.questionText}
                    </h4>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${
                      isCorrect 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' 
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'
                    }`}>
                      {isCorrect ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {question.options.map((opt, optIdx) => {
                      const isSelected = optIdx === selectedIdx;
                      const isAnswerKey = optIdx === correctIdx;
                      
                      let choiceStyle = 'border-slate-200 dark:border-slate-800 text-slate-650';
                      if (isSelected) {
                        choiceStyle = 'border-rose-500 bg-rose-50/20 text-rose-700 dark:text-rose-400';
                      }
                      if (isAnswerKey) {
                        choiceStyle = 'border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20';
                      }

                      return (
                        <div 
                          key={optIdx} 
                          className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${choiceStyle}`}
                        >
                          <span>{opt}</span>
                          {isSelected && !isCorrect && <span className="text-[10px] font-bold text-rose-500 uppercase">Your Choice</span>}
                          {isAnswerKey && <span className="text-[10px] font-bold text-emerald-500 uppercase">Correct Answer</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </Layout>
    );
  }

  // Active quiz question display
  const currentQuestion = questions[currentIndex];

  return (
    <Layout>
      <div className="space-y-4 flex flex-col h-[calc(100vh-10rem)]">
        
        {/* Top Header: Quiz Info & Timer */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm">
          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-white">{quiz?.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{quiz?.description}</p>
          </div>
          
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 px-4 py-2.5 rounded-2xl font-mono font-bold text-sm shadow-sm">
            <Timer size={18} className="animate-pulse" />
            <span>Time Left: {formatTime(timeRemaining)}</span>
          </div>
        </div>

        {/* Workspace: Side Navigator + MCQ Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
          
          {/* Left Sidebar Matrix */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border p-5 rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs border-b pb-2">Questions Status</h3>
              
              <div className="grid grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {questions.map((_, idx) => {
                  const status = getQuestionStatus(idx);
                  let badgeStyle = 'bg-slate-50 dark:bg-slate-800 text-slate-400';
                  if (status === 'flagged') badgeStyle = 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 border border-amber-300';
                  if (status === 'answered') badgeStyle = 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-300';
                  if (currentIndex === idx) badgeStyle += ' ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900';

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${badgeStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend summary */}
            <div className="space-y-2 pt-4 border-t text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span> Answered</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span> Flagged for Review</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-slate-800 inline-block"></span> Unanswered</div>
            </div>
          </div>

          {/* Center MCQ Panel */}
          <div className="lg:col-span-9 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm flex flex-col justify-between overflow-hidden">
            
            {/* Question Header */}
            <div className="px-8 py-5 border-b flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <button
                onClick={toggleFlagQuestion}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  flaggedQuestions[currentIndex]
                    ? 'border-amber-400 text-amber-500 bg-amber-50/30'
                    : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-650'
                }`}
              >
                <Flag size={14} />
                <span>{flaggedQuestions[currentIndex] ? 'Unflag Review' : 'Flag Review'}</span>
              </button>
            </div>

            {/* Question Choices Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-relaxed">
                {currentQuestion?.questionText}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion?.options.map((option, optIdx) => {
                  const isSelected = selectedAnswers[currentIndex] === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleOptionSelect(optIdx)}
                      className={`p-5 rounded-2xl border text-left text-xs font-semibold flex items-center justify-between transition-all hover:shadow-sm ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/40 text-brand-700 dark:text-brand-350 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                      }`}
                    >
                      <span className="flex-1">{option}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected 
                          ? 'border-brand-500 bg-brand-500 text-white' 
                          : 'border-slate-350'
                      }`}>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-8 py-5 border-t bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="flex items-center gap-1 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex items-center gap-1.5 text-xs font-bold bg-brand-650 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-brand-500/10 transition-all cursor-pointer"
                >
                  <CheckSquare size={16} />
                  <span>Submit Quiz</span>
                </button>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 max-w-sm w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4 text-center">
            <AlertCircle size={36} className="text-amber-500 mx-auto" />
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Submit Your Quiz?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">
                You have answered {Object.keys(selectedAnswers).length} of {questions.length} questions. You cannot change your choices once submitted.
              </p>
            </div>
            
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                Go Back
              </button>
              <button
                onClick={submitAnswers}
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
};

export default QuizPage;
