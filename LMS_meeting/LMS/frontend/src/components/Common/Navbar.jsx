import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Sun, Moon, Bell } from 'lucide-react';

const Navbar = () => {
  const { user, theme, toggleTheme } = useAuth();

  // Helper to format date
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 transition-colors duration-300">
      {/* Page Context Details */}
      <div>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Learning Management System
        </span>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Welcome back, <span className="text-slate-800 dark:text-slate-200 font-bold">{user?.name}</span>
        </h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Date Display */}
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden md:inline-block">
          {getFormattedDate()}
        </span>

        {/* Notification Icon */}
        <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <Bell size={18} />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-amber-500" />
          ) : (
            <Moon size={18} className="text-indigo-600" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
