import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, UserCheck, AlertCircle, ShieldAlert, GraduationCap, Users } from 'lucide-react';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setError('');
    setLoading(true);
    const result = await register(name, email, password, role);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50 dark:from-slate-950 dark:to-slate-900 px-4 py-8 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-8 space-y-6">
        
        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-brand-500/20">
            L
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Create Account
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Join LuminaLMS to start learning or teaching
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-lg text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500 transition-all dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500 transition-all dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/35 focus:border-brand-500 transition-all dark:text-white"
              />
            </div>
          </div>

          {/* Role Choice Cards */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              I want to join as a:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Student */}
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  role === 'student'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <GraduationCap size={20} />
                <span className="text-xs font-semibold">Student</span>
              </button>

              {/* Teacher */}
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  role === 'teacher'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Users size={20} />
                <span className="text-xs font-semibold">Teacher</span>
              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                  role === 'admin'
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <ShieldAlert size={20} />
                <span className="text-xs font-semibold">Admin</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <UserCheck size={18} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
};

export default Register;
