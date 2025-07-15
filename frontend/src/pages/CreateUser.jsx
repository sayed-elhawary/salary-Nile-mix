import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';

const CreateUser = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    code: '',
    password: '',
    employeeName: '',
    department: '',
    baseSalary: '0.00',
    baseBonus: '0.00',
    bonusPercentage: '0.00',
    medicalInsurance: '0.00',
    socialInsurance: '0.00',
    mealAllowance: '0.00',
    workingDays: '5',
    shiftType: 'administrative',
    annualLeaveBalance: '21',
    monthlyLateAllowance: '120',
    netSalary: '0.00',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updatedForm = { ...prev, [name]: value };
      const baseSalary = parseFloat(updatedForm.baseSalary || 0);
      const baseBonus = parseFloat(updatedForm.baseBonus || 0);
      const bonusPercentage = parseFloat(updatedForm.bonusPercentage || 0);
      const mealAllowance = parseFloat(updatedForm.mealAllowance || 0);
      const medicalInsurance = parseFloat(updatedForm.medicalInsurance || 0);
      const socialInsurance = parseFloat(updatedForm.socialInsurance || 0);
      updatedForm.netSalary = (
        baseSalary +
        (baseBonus * bonusPercentage) / 100 +
        mealAllowance -
        medicalInsurance -
        socialInsurance
      ).toFixed(2);
      return updatedForm;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (form.password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      setLoading(false);
      return;
    }

    if (parseFloat(form.baseSalary) < 0) {
      setError('الراتب الأساسي لا يمكن أن يكون سالبًا');
      setLoading(false);
      return;
    }

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users`,
        {
          ...form,
          baseSalary: parseFloat(form.baseSalary),
          baseBonus: parseFloat(form.baseBonus),
          bonusPercentage: parseFloat(form.bonusPercentage),
          medicalInsurance: parseFloat(form.medicalInsurance),
          socialInsurance: parseFloat(form.socialInsurance),
          mealAllowance: parseFloat(form.mealAllowance),
          annualLeaveBalance: parseInt(form.annualLeaveBalance),
          monthlyLateAllowance: parseInt(form.monthlyLateAllowance),
          netSalary: parseFloat(form.netSalary),
          createdBy: user._id,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(`خطأ أثناء إنشاء الحساب: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl font-amiri">
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-blue-600 mb-6 sm:mb-8 text-right">إنشاء حساب جديد</h2>
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
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
              name="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              الاسم الكامل
            </label>
            <input
              type="text"
              name="employeeName"
              value={form.employeeName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              القسم
            </label>
            <input
              type="text"
              name="department"
              value={form.department}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              الراتب الأساسي
            </label>
            <input
              type="number"
              name="baseSalary"
              value={form.baseSalary}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              step="0.01"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              الحافز الأساسي
            </label>
            <input
              type="number"
              name="baseBonus"
              value={form.baseBonus}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              نسبة الحافز (%)
            </label>
            <input
              type="number"
              name="bonusPercentage"
              value={form.bonusPercentage}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              max="100"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              التأمين الطبي
            </label>
            <input
              type="number"
              name="medicalInsurance"
              value={form.medicalInsurance}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              التأمين الاجتماعي
            </label>
            <input
              type="number"
              name="socialInsurance"
              value={form.socialInsurance}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              بدل وجبة
            </label>
            <input
              type="number"
              name="mealAllowance"
              value={form.mealAllowance}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              عدد أيام العمل
            </label>
            <select
              name="workingDays"
              value={form.workingDays}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              disabled={loading}
            >
              <option value="5">5 أيام (الجمعة والسبت إجازة)</option>
              <option value="6">6 أيام (الجمعة إجازة)</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              نوع الشيفت
            </label>
            <select
              name="shiftType"
              value={form.shiftType}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              disabled={loading}
            >
              <option value="administrative">إداري</option>
              <option value="dayStation">محطة نهارًا</option>
              <option value="nightStation">محطة ليلًا</option>
              <option value="24/24">24/24</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              رصيد الإجازة السنوية
            </label>
            <input
              type="number"
              name="annualLeaveBalance"
              value={form.annualLeaveBalance}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              رصيد دقائق السماح الشهري
            </label>
            <input
              type="number"
              name="monthlyLateAllowance"
              value={form.monthlyLateAllowance}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
              min="0"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              الصافي
            </label>
            <input
              type="text"
              value={form.netSalary}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm bg-gray-50 cursor-not-allowed"
              readOnly
            />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-3">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </motion.button>
            <motion.button
              type="button"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-gray-500 text-white px-5 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إلغاء
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateUser;
