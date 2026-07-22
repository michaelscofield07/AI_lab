import React from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Common/Layout';
import { User, Mail, Calendar, Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user } = useAuth();

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

              {user?.createdAt && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Created</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs text-slate-500 border border-slate-100 dark:border-slate-800/60 mt-4">
              <strong>Demo Note:</strong> This application serves as a client simulation client for biometric telemetry security platform SDK integrations. Events such as page navigation, editing, and form submission track metrics for profiling.
            </div>

          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Profile;
