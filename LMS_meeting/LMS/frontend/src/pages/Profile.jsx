import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Common/Layout';
import { User, Mail, Calendar, Shield, ArrowLeft, KeyRound, CheckCircle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const AGREEMENT_PHRASE = 'I agree to academic integrity rules.';

const Profile = () => {
  const { user } = useAuth();

  // Biometric Enrollment State
  const [enrollStep, setEnrollStep] = useState(1);
  const [inputPhrase, setInputPhrase] = useState('');
  const [keystrokes, setKeystrokes] = useState([]);
  const [lastKeyTime, setLastKeyTime] = useState(null);
  const [enrolled, setEnrolled] = useState(() => {
    return localStorage.getItem(`biometric_enrolled_${user?._id}`) === 'true';
  });
  const [enrollMsg, setEnrollMsg] = useState('');

  const handleKeyDown = (e) => {
    const now = performance.now();
    if (lastKeyTime) {
      const flightTime = now - lastKeyTime;
      setKeystrokes(prev => [...prev, Math.round(flightTime)]);
    }
    setLastKeyTime(now);
  };

  const handlePhraseSubmit = (e) => {
    e.preventDefault();
    if (inputPhrase.trim() !== AGREEMENT_PHRASE) {
      setEnrollMsg('Phrase does not match exact agreement text. Please try again.');
      return;
    }

    setEnrollMsg('');
    if (enrollStep < 3) {
      setEnrollStep(prev => prev + 1);
      setInputPhrase('');
      setLastKeyTime(null);
    } else {
      // 3-step completion
      const avgFlightTime = keystrokes.length > 0
        ? Math.round(keystrokes.reduce((a, b) => a + b, 0) / keystrokes.length)
        : 120;

      const profile = {
        avgFlightTime,
        sampleCount: keystrokes.length,
        enrolledAt: new Date().toISOString(),
      };

      localStorage.setItem(`biometric_profile_${user?._id}`, JSON.stringify(profile));
      localStorage.setItem(`biometric_enrolled_${user?._id}`, 'true');
      setEnrolled(true);
    }
  };

  const resetEnrollment = () => {
    localStorage.removeItem(`biometric_enrolled_${user?._id}`);
    localStorage.removeItem(`biometric_profile_${user?._id}`);
    setEnrolled(false);
    setEnrollStep(1);
    setInputPhrase('');
    setKeystrokes([]);
    setLastKeyTime(null);
    setEnrollMsg('');
  };

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

        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm max-w-2xl mx-auto overflow-hidden">
          {/* Header Accent */}
          <div className="h-32 bg-gradient-to-r from-brand-650 to-indigo-650 relative">
            <div className="absolute -bottom-10 left-8">
              <div className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-3xl shadow-md uppercase">
                {user?.name?.slice(0, 2)}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-8 pt-14 space-y-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{user?.name}</h2>
              <span className="text-xs text-brand-600 dark:text-brand-400 font-bold px-2.5 py-0.5 bg-brand-50 dark:bg-brand-950/40 border border-brand-100 dark:border-brand-900/30 rounded-full inline-block capitalize mt-1.5">
                {user?.role} Role
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{user?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Shield size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Permissions Role</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 capitalize">{user?.role}</p>
                </div>
              </div>
            </div>

            {/* Behavioral Biometric Enrollment Section (Students Only) */}
            {user?.role === 'student' && (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound size={20} className="text-violet-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Behavioral Biometrics (Keystroke Enrollment)
                    </h3>
                  </div>
                  {enrolled && (
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full flex items-center gap-1">
                      <CheckCircle size={14} /> Baseline Enrolled
                    </span>
                  )}
                </div>

                {enrolled ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-xl space-y-2">
                    <p className="text-xs text-slate-300">
                      Your keystroke dynamics baseline signature has been recorded and verified.
                    </p>
                    <button
                      onClick={resetEnrollment}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold pt-1"
                    >
                      <RefreshCw size={12} /> Re-enroll Typing Signature
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-400">3-Step Phrase Baseline</span>
                      <span className="text-violet-400">Step {enrollStep} of 3</span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Type the agreement phrase below exactly to record your typing rhythm:
                    </p>

                    <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-emerald-400 border border-slate-800">
                      "{AGREEMENT_PHRASE}"
                    </div>

                    {enrollMsg && (
                      <p className="text-xs text-rose-400 font-semibold">{enrollMsg}</p>
                    )}

                    <form onSubmit={handlePhraseSubmit} className="space-y-3">
                      <input
                        type="text"
                        value={inputPhrase}
                        onChange={e => setInputPhrase(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type phrase here..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg transition-colors"
                      >
                        {enrollStep < 3 ? `Submit & Next (Step ${enrollStep + 1})` : 'Complete Enrollment'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs text-slate-500 border border-slate-100 dark:border-slate-800/60 mt-4">
              <strong>Demo Note:</strong> LuminaLMS uses keystroke dynamics telemetry and continuous proctoring anomaly detection during exam sessions.
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Profile;
