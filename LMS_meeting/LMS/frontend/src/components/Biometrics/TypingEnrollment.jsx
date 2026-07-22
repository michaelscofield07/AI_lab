import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Fingerprint, CheckCircle, AlertTriangle } from 'lucide-react';

const ENROLLMENT_PHRASE = "I agree to academic integrity rules.";
const MAX_ENROLLMENTS = 3;

export default function TypingEnrollment({ onComplete }) {
  const [typedText, setTypedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrollments, setEnrollments] = useState(0);
  const tdnaRef = useRef(null);

  useEffect(() => {
    // Initialize TypingDNA
    if (window.TypingDNA) {
      tdnaRef.current = new window.TypingDNA();
      tdnaRef.current.addTarget('enrollment-input');
    }
    
    // Check initial status
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/auth/profile');
      setEnrollments(res.data.typingDnaEnrollmentsCount || 0);
      if (res.data.typingDnaEnrolled && onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Failed to fetch typingdna status', err);
    }
  };

  const handleSubmit = async () => {
    if (typedText !== ENROLLMENT_PHRASE) {
      setError('Please type the exact phrase correctly.');
      return;
    }
    if (!tdnaRef.current) {
      setError('Biometric capturing engine not loaded yet. Please wait a second.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get the typing pattern for the input
      const pattern = tdnaRef.current.getTypingPattern({ type: 1, text: ENROLLMENT_PHRASE });
      
      const res = await axios.post('/api/auth/biometrics/enroll', { typingPattern: pattern });
      
      if (res.data.typingDnaEnrolled) {
        setEnrollments(MAX_ENROLLMENTS);
        if (onComplete) onComplete();
      } else {
        // Enrolled once, but need more
        setEnrollments(res.data.enrollmentsCount || enrollments + 1);
        setTypedText('');
        tdnaRef.current.reset(); // clear pattern for next attempt
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Biometric capturing failed');
    } finally {
      setLoading(false);
    }
  };

  if (enrollments >= MAX_ENROLLMENTS) {
    return (
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 max-w-xl mx-auto shadow-2xl text-center space-y-4">
        <CheckCircle size={48} className="mx-auto text-emerald-500" />
        <h3 className="text-xl font-bold text-white">Enrollment Complete</h3>
        <p className="text-slate-400">Your typing pattern has been successfully recorded.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-lg p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <Fingerprint size={200} />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
          <Fingerprint size={32} />
        </div>
        
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Biometric Verification</h3>
          <p className="text-slate-400 text-sm">
            Please type the phrase below to record your typing pattern. 
            ({enrollments}/{MAX_ENROLLMENTS} completed)
          </p>
        </div>

        <div className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <p className="font-mono text-slate-700 dark:text-slate-300 font-bold select-none">{ENROLLMENT_PHRASE}</p>
        </div>

        <div className="w-full space-y-2 text-left">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Type here</label>
          <input
            id="enrollment-input"
            type="text"
            value={typedText}
            onChange={(e) => {
              setTypedText(e.target.value);
              setError('');
            }}
            onPaste={(e) => {
              e.preventDefault();
              setError("Please don't paste. You must type the phrase.");
            }}
            disabled={loading}
            className="w-full bg-white dark:bg-slate-950 border-2 border-indigo-100 dark:border-indigo-900 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none transition-colors font-mono"
            placeholder="Start typing..."
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-rose-500 text-sm bg-rose-50 dark:bg-rose-950/30 px-4 py-2 rounded-lg w-full">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <div className="w-full flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-400">
            Progress: {enrollments} / {MAX_ENROLLMENTS} completed
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || typedText.length < ENROLLMENT_PHRASE.length}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-xl transition-all flex items-center gap-2"
          >
            {loading ? 'Analyzing Rhythm...' : 'Submit Pattern'}
            {!loading && <CheckCircle size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
