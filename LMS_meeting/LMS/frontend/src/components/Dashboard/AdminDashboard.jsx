import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  BookOpen, 
  ShieldAlert, 
  Trash2, 
  Search,
  Filter,
  AlertTriangle,
  FileText
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    teachersCount: 0,
    adminsCount: 0,
    coursesCount: 0,
    assignmentsCount: 0,
    quizzesCount: 0
  });
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        axios.get('/api/admin/stats'),
        axios.get('/api/admin/users')
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setFilteredUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to load admin panel details', err);
      setError('Failed to fetch administrative data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Filter application
  useEffect(() => {
    let result = users;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(result);
  }, [searchQuery, roleFilter, users]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await axios.put(`/api/admin/users/${userId}/role`, { role: newRole });
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 3000);
      
      // Update local state
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: newRole } : u));
      // Re-fetch stats in background
      const statsRes = await axios.get('/api/admin/stats');
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you absolutely sure you want to delete this user? All their enrollments and grades will be cleared.')) {
      return;
    }

    try {
      const res = await axios.delete(`/api/admin/users/${userId}`);
      setMessage(res.data.message);
      setTimeout(() => setMessage(''), 3000);

      setUsers(prev => prev.filter(u => u._id !== userId));
      
      // Re-fetch stats in background
      const statsRes = await axios.get('/api/admin/stats');
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
      setTimeout(() => setError(''), 3000);
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">Monitor system integrity, manage roles, and review LMS statistics.</p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Accounts</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.totalUsers}</h3>
          </div>
        </div>

        {/* Teachers count */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Teachers</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.teachersCount}</h3>
          </div>
        </div>

        {/* Students count */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Students</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.studentsCount}</h3>
          </div>
        </div>

        {/* Courses count */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Courses</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{stats.coursesCount}</h3>
          </div>
        </div>
      </div>

      {/* User Accounts Manager */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">User Accounts Directory</h3>
            <p className="text-xs text-slate-400 mt-0.5">Change client roles or delete credentials from the system.</p>
          </div>

          {/* Search / Filter Actions */}
          <div className="flex gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or email..."
                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none dark:text-white"
              />
            </div>
            
            {/* Role Select Filter */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-xs focus:outline-none dark:text-white font-medium"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No matching accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/80 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-150 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3">User Profile</th>
                  <th className="px-6 py-3">Email Address</th>
                  <th className="px-6 py-3">System Role</th>
                  <th className="px-6 py-3">Registered On</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{u.name}</td>
                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                    <td className="px-6 py-4">
                      {/* Role Selector dropdown */}
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-xs focus:outline-none dark:text-white capitalize font-semibold"
                      >
                        <option value="student">student</option>
                        <option value="teacher">teacher</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteUser(u._id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AdminDashboard;
