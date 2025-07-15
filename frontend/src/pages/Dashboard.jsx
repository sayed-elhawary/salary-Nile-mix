import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Fingerprint } from 'lucide-react';
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
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-blue-600 mb-6 sm:mb-8 text-right">
          مرحبًا، {user.employeeName}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Link to="/create-user">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm hover:bg-blue-100 transition-all duration-200 flex items-center gap-4"
            >
              <UserPlus className="h-8 w-8 text-blue-600" />
              <div className="text-right">
                <h3 className="text-lg font-semibold text-blue-600">إنشاء حساب جديد</h3>
                <p className="text-sm text-gray-600">إضافة موظف جديد إلى النظام</p>
              </div>
            </motion.div>
          </Link>
          <Link to="/upload-attendance">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm hover:bg-blue-100 transition-all duration-200 flex items-center gap-4"
            >
              <Fingerprint className="h-8 w-8 text-blue-600" />
              <div className="text-right">
                <h3 className="text-lg font-semibold text-blue-600">رفع البصمات</h3>
                <p className="text-sm text-gray-600">تحميل بيانات الحضور والانصراف</p>
              </div>
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
