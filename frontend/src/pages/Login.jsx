import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';

const Login = () => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
        code,
        password,
      });
      login(res.data.user, res.data.token);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(`خطأ أثناء تسجيل الدخول: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-amiri">
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 w-full max-w-md"
      >
        <h2 className="text-2xl font-bold text-blue-600 mb-6 text-right">تسجيل الدخول</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
        <div className="space-y-6">
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              required
              disabled={loading}
            />
          </div>
          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-full bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'جارٍ التحميل...' : 'تسجيل الدخول'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
