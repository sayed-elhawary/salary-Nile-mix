import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import { AuthContext } from './AuthProvider';

const NavBar = () => {
  const { logout } = useContext(AuthContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const menuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        damping: 20,
        when: 'beforeChildren',
        staggerChildren: 0.1 
      }
    },
    exit: { 
      opacity: 0, 
      y: -20,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  };

  return (
    <nav className="bg-white p-4 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo or Brand */}
        <div className="text-blue-600 text-lg font-bold">إدارة الموظفين</div>

        {/* Desktop Menu */}
        <div className="hidden md:flex gap-6 items-center">
          <Link to="/dashboard" className="text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200">
            الرئيسية
          </Link>
          <Link to="/create-user" className="text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200">
            إنشاء حساب جديد
          </Link>
          <Link to="/upload-attendance" className="text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200">
            رفع البصمات
          </Link>
          <motion.button
            onClick={logout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </motion.button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-blue-600 focus:outline-none"
          onClick={toggleMenu}
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="md:hidden bg-white shadow-lg mt-2 rounded-lg overflow-hidden"
          >
            <motion.div variants={itemVariants} className="px-4 py-2">
              <Link
                to="/dashboard"
                className="block text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200"
                onClick={toggleMenu}
              >
                الرئيسية
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="px-4 py-2">
              <Link
                to="/create-user"
                className="block text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200"
                onClick={toggleMenu}
              >
                إنشاء حساب جديد
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="px-4 py-2">
              <Link
                to="/upload-attendance"
                className="block text-blue-600 font-medium text-sm hover:bg-blue-100 px-3 py-2 rounded-md transition-all duration-200"
                onClick={toggleMenu}
              >
                رفع البصمات
              </Link>
            </motion.div>
            <motion.div variants={itemVariants} className="px-4 py-2">
              <button
                onClick={() => {
                  logout();
                  toggleMenu();
                }}
                className="w-full flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all duration-200 text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                تسجيل الخروج
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default NavBar;
