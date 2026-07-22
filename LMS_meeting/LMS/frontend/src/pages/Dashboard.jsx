import React from 'react';
import { useAuth } from '../context/AuthContext';
import StudentDashboard from '../components/Dashboard/StudentDashboard';
import TeacherDashboard from '../components/Dashboard/TeacherDashboard';
import AdminDashboard from '../components/Dashboard/AdminDashboard';
import Layout from '../components/Common/Layout';

const Dashboard = () => {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.role) {
      case 'student':
        return <StudentDashboard />;
      case 'teacher':
        return <TeacherDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-slate-500">Loading your profile dashboard...</p>
          </div>
        );
    }
  };

  return <Layout>{renderDashboard()}</Layout>;
};

export default Dashboard;
