import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  User,
  LogOut,
  Settings,
  PlusCircle,
  FileCode,
  HelpCircle,
  Users,
  Award
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const getNavLinks = () => {
    const commonLinks = [
      { path: '/profile', name: 'My Profile', icon: User },
    ];

    const studentLinks = [
      { path: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
      { path: '/courses', name: 'Explore Courses', icon: BookOpen },
    ];

    const teacherLinks = [
      { path: '/dashboard', name: 'Teacher Panel', icon: LayoutDashboard },
      { path: '/courses', name: 'My Courses', icon: BookOpen },
    ];

    const adminLinks = [
      { path: '/dashboard', name: 'Admin Control', icon: LayoutDashboard },
      { path: '/courses', name: 'Manage Courses', icon: BookOpen },
    ];

    let roleLinks = [];
    if (user?.role === 'student') roleLinks = studentLinks;
    if (user?.role === 'teacher') roleLinks = teacherLinks;
    if (user?.role === 'admin') roleLinks = adminLinks;

    return [...roleLinks, ...commonLinks];
  };

  const navLinks = getNavLinks();

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full transition-colors duration-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-500/25">
            L
          </div>
          <span className="font-extrabold text-xl bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">
            LuminaLMS
          </span>
        </div>
      </div>

      {/* User Info Capsule */}
      <div className="p-4 mx-4 my-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 flex items-center justify-center font-semibold text-sm">
            {user?.name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{user?.name}</h4>
            <span className="text-xs text-brand-600 dark:text-brand-400 capitalize font-medium px-2 py-0.5 bg-brand-50 dark:bg-brand-950/50 rounded-full border border-brand-100 dark:border-brand-900/40 mt-1 inline-block">
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon size={18} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-200"
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
