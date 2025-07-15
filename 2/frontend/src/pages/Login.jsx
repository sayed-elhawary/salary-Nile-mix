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
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 w-full max-w-md"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-6 text-right">تسجيل الدخول</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
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
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              required
              disabled={loading}
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'جارٍ التحميل...' : 'تسجيل الدخول'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
