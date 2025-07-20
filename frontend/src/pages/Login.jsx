import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

    // تنظيف كلمة المرور وكود الموظف
    const trimmedCode = code.trim();
    const cleanedPassword = password.trim().replace(/[^\w\s@#$%^&*()]/g, '');

    // تحقق من صلاحية كلمة المرور
    if (!/^[a-zA-Z0-9@#$%^&*()]+$/.test(cleanedPassword)) {
      setError('كلمة المرور تحتوي على أحرف غير صالحة');
      setLoading(false);
      return;
    }

    console.log('Sending login request:', { code: trimmedCode, password: cleanedPassword });

    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/auth/login`, {
        code: trimmedCode,
        password: cleanedPassword,
      });
      login(res.data.user, res.data.token);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(`خطأ أثناء تسجيل الدخول: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50 flex items-center justify-center p-4 font-noto-sans-arabic">
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-lg border border-blue-100 w-full max-w-md"
      >
        <h2 className="text-3xl font-bold text-blue-400 mb-6 text-right">تسجيل الدخول</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-purple-50 text-gray-600 p-4 rounded-lg mb-6 text-right text-sm font-semibold"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
              required
              disabled={loading}
              placeholder="أدخل كود الموظف"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
              required
              disabled={loading}
              placeholder="أدخل كلمة المرور"
            />
          </div>
          <div className="text-right">
            <Link
              to="/forgot-password"
              className="text-blue-400 text-sm font-medium hover:text-blue-500 transition-all duration-200"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`w-full bg-blue-400 text-white px-5 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'جارٍ التحميل...' : 'تسجيل الدخول'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
