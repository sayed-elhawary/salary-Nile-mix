import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

const NavBar = () => {
  const { logout } = useContext(AuthContext);

  return (
    <nav className="bg-teal-500 p-4 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex gap-4">
          <Link to="/dashboard" className="text-white font-medium text-sm hover:underline">
            الرئية
          </Link>
          <Link to="/create-user" className="text-white font-medium text-sm hover:underline">
            إنشاء حساب جديد
          </Link>
        </div>
        <motion.button
          onClick={logout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-all duration-200 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </motion.button>
      </div>
    </nav>
  );
};

export default NavBar;
