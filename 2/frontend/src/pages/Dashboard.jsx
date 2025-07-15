import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';

const Dashboard = () => {
  const { user } = useContext(AuthContext);

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl font-amiri">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-6 text-right">
          مرحبًا، {user.employeeName}
        </h2>
        <div className="text-right">
          <Link
            to="/create-user"
            className="inline-block bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm"
          >
            إنشاء حساب جديد
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
