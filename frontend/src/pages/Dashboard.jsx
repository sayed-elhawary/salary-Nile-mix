import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Fingerprint, Users, FileText } from 'lucide-react';
import { AuthContext } from '../components/AuthProvider';

const Dashboard = () => {
  const { user } = useContext(AuthContext);

  if (!user) return null;

  // Variants for card animations
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 },
    }),
    hover: { scale: 1.05, boxShadow: "0 8px 24px rgba(59, 130, 246, 0.2)" },
    tap: { scale: 0.98 },
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-b from-white to-purple-50 p-8 rounded-2xl shadow-lg border border-blue-100 max-w-6xl mx-auto font-cairo"
      >
        <h2 className="text-3xl font-bold text-blue-400 mb-8 text-right">
          مرحبًا، {user.employeeName}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              to: "/create-user",
              icon: <UserPlus className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />,
              title: "إنشاء حساب جديد",
              description: "إضافة موظف جديد إلى النظام",
            },
            {
              to: "/upload-attendance",
              icon: <Fingerprint className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />,
              title: "رفع البصمات",
              description: "تحميل بيانات الحضور والانصراف",
            },
            {
              to: "/edit-user",
              icon: <Users className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />,
              title: "إدارة الموظفين",
              description: "تعديل أو حذف بيانات الموظفين",
            },
            {
              to: "/salary-report",
              icon: <FileText className="h-8 w-8 text-purple-600 group-hover:text-purple-700" />,
              title: "تقرير الراتب",
              description: "عرض تقارير الرواتب للموظفين",
            },
          ].map((item, index) => (
            <Link key={item.to} to={item.to} className="group">
              <motion.div
                custom={index}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                whileHover="hover"
                whileTap="tap"
                className="bg-purple-100 p-6 rounded-xl shadow-md border border-blue-100 hover:bg-blue-50 transition-all duration-300 flex items-center gap-4"
              >
                {item.icon}
                <div className="text-right">
                  <h3 className="text-lg font-semibold text-blue-400 group-hover:text-blue-500">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
