import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateUser from './pages/CreateUser';
import EditUser from './pages/EditUser';
import UploadAttendance from './pages/UploadAttendance';
import SalaryReport from './pages/SalaryReport';
import NavBar from './components/NavBar';
import { AuthContext } from './components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios
        .get(`${process.env.REACT_APP_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          setUser(res.data.user);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching user:', err);
          localStorage.removeItem('token');
          setLoading(false);
          navigate('/login');
        });
    } else {
      setLoading(false);
      navigate('/login');
    }
  }, [navigate]);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('token', token);
    navigate('/dashboard');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <AnimatePresence>
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center z-50"
            dir="rtl"
          >
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full"
              ></motion.div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="mt-4 text-blue-500 text-lg font-noto-sans-arabic font-semibold"
              >
                جاري التحميل...
              </motion.p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="min-h-screen bg-gradient-to-b from-white to-blue-50 font-noto-sans-arabic"
            dir="rtl"
          >
            {user && <NavBar />}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create-user" element={<CreateUser />} />
              <Route path="/edit-user" element={<EditUser />} />
              <Route path="/upload-attendance" element={<UploadAttendance />} />
              <Route path="/salary-report" element={<SalaryReport />} />
              <Route path="*" element={<Login />} />
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};

export default App;
