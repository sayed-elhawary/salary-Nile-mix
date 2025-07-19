import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import { Trash2, Edit2, Search, Plus } from 'lucide-react';

const EditUser = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchCode, setSearchCode] = useState('');
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [bulkUpdateType, setBulkUpdateType] = useState(null);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    percentage: '',
    monthlyLateAllowance: '',
    annualLeaveBalance: '',
    baseBonus: '',
    medicalInsurance: '',
    socialInsurance: '',
    shiftType: '',
    excludedUsers: [],
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    handleShowAll();
  }, [user, navigate]);

  const handleSearch = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/users${searchCode ? `?code=${searchCode}` : ''}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      setUsers(response.data.users);
      setFilteredUsers(response.data.users);
    } catch (err) {
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    setSearchCode('');
    setError('');
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers(response.data.users);
      setFilteredUsers(response.data.users);
    } catch (err) {
      setError(`خطأ أثناء جلب جميع المستخدمين: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setForm({
      code: user.code,
      password: '',
      employeeName: user.employeeName,
      department: user.department,
      baseSalary: user.baseSalary.toFixed(2),
      baseBonus: user.baseBonus.toFixed(2),
      bonusPercentage: user.bonusPercentage.toFixed(2),
      medicalInsurance: user.medicalInsurance.toFixed(2),
      socialInsurance: user.socialInsurance.toFixed(2),
      mealAllowance: user.mealAllowance.toFixed(2),
      workingDays: user.workingDays,
      shiftType: user.shiftType,
      annualLeaveBalance: user.annualLeaveBalance.toString(),
      monthlyLateAllowance: user.monthlyLateAllowance.toString(),
      netSalary: user.netSalary.toFixed(2),
    });
  };

  const handleDelete = async (userId) => {
    setError('');
    setLoading(true);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setUsers(users.filter((u) => u._id !== userId));
      setFilteredUsers(filteredUsers.filter((u) => u._id !== userId));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(`خطأ أثناء الحذف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(null);
    }
  };

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

    const token = localStorage.getItem('token');
    if (!token) {
      setError('التوكن غير موجود. يرجى تسجيل الدخول مرة أخرى');
      setLoading(false);
      navigate('/login');
      return;
    }

    if (!selectedUser?._id) {
      setError('لم يتم تحديد مستخدم للتعديل');
      setLoading(false);
      return;
    }

    if (form.password && form.password.length < 6) {
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
      const updateData = {
        ...form,
        baseSalary: parseFloat(form.baseSalary),
        baseBonus: parseFloat(form.baseBonus),
        bonusPercentage: parseFloat(form.bonusPercentage),
        medicalInsurance: parseFloat(form.medicalInsurance),
        socialInsurance: parseFloat(form.socialInsurance),
        mealAllowance: parseFloat(form.mealAllowance),
        annualLeaveBalance: parseInt(form.annualLeaveBalance),
        monthlyDelayAllowance: parseInt(form.monthlyDelayAllowance),
        netSalary: parseFloat(form.netSalary),
        updatedBy: user._id,
      };

      if (!form.password) {
        delete updateData.password;
      }

      await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/users/${selectedUser._id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedUser(null);
        handleShowAll();
      }, 2000);
    } catch (err) {
      console.error('PATCH Error:', err);
      setError(`خطأ أثناء تحديث الحساب: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateChange = (e) => {
    const { name, value } = e.target;
    setBulkUpdateData((prev) => ({ ...prev, [name]: value }));
  };

  const handleExcludeUser = (userId) => {
    setBulkUpdateData((prev) => ({
      ...prev,
      excludedUsers: prev.excludedUsers.includes(userId)
        ? prev.excludedUsers.filter((id) => id !== userId)
        : [...prev.excludedUsers, userId],
    }));
  };

  const handleBulkUpdateSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    if (!token) {
      setError('التوكن غير موجود. يرجى تسجيل الدخول مرة أخرى');
      setLoading(false);
      navigate('/login');
      return;
    }

    try {
      const payload = {
        type: bulkUpdateType,
        percentage: parseFloat(bulkUpdateData.percentage) || 0,
        monthlyLateAllowance: parseInt(bulkUpdateData.monthlyLateAllowance) || 0,
        annualLeaveBalance: parseInt(bulkUpdateData.annualLeaveBalance) || 0,
        baseBonus: parseFloat(bulkUpdateData.baseBonus) || 0,
        medicalInsurance: parseFloat(bulkUpdateData.medicalInsurance) || 0,
        socialInsurance: parseFloat(bulkUpdateData.socialInsurance) || 0,
        shiftType: bulkUpdateData.shiftType || '',
        excludedUsers: bulkUpdateData.excludedUsers,
      };

      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/users/bulk-update`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setBulkUpdateType(null);
        setBulkUpdateData({
          percentage: '',
          monthlyLateAllowance: '',
          annualLeaveBalance: '',
          baseBonus: '',
          medicalInsurance: '',
          socialInsurance: '',
          shiftType: '',
          excludedUsers: [],
        });
        handleShowAll();
      }, 2000);
    } catch (err) {
      console.error('Bulk Update Error:', err);
      setError(`خطأ أثناء التعديل الجماعي: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          >
            <div className="bg-white p-8 rounded-full shadow-lg border border-blue-100">
              <div className="relative flex flex-col items-center justify-center">
                <svg className="w-12 h-12" viewBox="0 0 50 50">
                  <motion.circle
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    stroke="#60A5FA"
                    strokeWidth="4"
                    strokeDasharray="80 200"
                    strokeLinecap="round"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                </svg>
                <span className="mt-4 text-sm font-semibold text-blue-400">
                  جارٍ التحميل...
                </span>
              </div>
            </div>
          </motion.div>
        )}
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-4 right-4 bg-green-100 text-green-600 p-4 rounded-xl shadow-lg flex items-center gap-2 z-50 font-cairo"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            تمت العملية بنجاح
          </motion.div>
        )}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-6 rounded-xl shadow-lg border border-purple-100 text-right max-w-md w-full font-cairo"
            >
              <h3 className="text-xl font-bold text-purple-600 mb-4">
                تأكيد الحذف
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                هل أنت متأكد من حذف المستخدم {showDeleteConfirm.employeeName}؟
              </p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(showDeleteConfirm._id)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200 text-sm font-semibold"
                >
                  حذف
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold"
                >
                  إلغاء
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {bulkUpdateType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-8 rounded-xl shadow-lg border border-purple-100 text-right max-w-4xl w-full font-cairo"
            >
              <h3 className="text-xl font-bold text-purple-600 mb-6">
                {bulkUpdateType === 'baseSalary' && 'زيادة نسبة الراتب الأساسي'}
                {bulkUpdateType === 'monthlyLateAllowance' && 'تعديل دقائق التأخير الشهري'}
                {bulkUpdateType === 'annualLeaveBalance' && 'تعديل رصيد الإجازة السنوية'}
                {bulkUpdateType === 'baseBonus' && 'تعديل الحافز الأساسي'}
                {bulkUpdateType === 'medicalInsurance' && 'تعديل التأمين الطبي'}
                {bulkUpdateType === 'socialInsurance' && 'تعديل التأمين الاجتماعي'}
              </h3>
              <form onSubmit={handleBulkUpdateSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  {bulkUpdateType === 'baseSalary' && (
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                        النسبة المئوية (%)
                      </label>
                      <input
                        type="number"
                        name="percentage"
                        value={bulkUpdateData.percentage}
                        onChange={handleBulkUpdateChange}
                        className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                        min="0"
                        step="0.01"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  {['monthlyLateAllowance', 'annualLeaveBalance', 'baseBonus', 'medicalInsurance', 'socialInsurance'].includes(bulkUpdateType) && (
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                        القيمة الجديدة
                      </label>
                      <input
                        type="number"
                        name={bulkUpdateType}
                        value={bulkUpdateData[bulkUpdateType]}
                        onChange={handleBulkUpdateChange}
                        className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                        min="0"
                        step={['baseBonus', 'medicalInsurance', 'socialInsurance'].includes(bulkUpdateType) ? '0.01' : '1'}
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      نوع الشيفت (اختياري)
                    </label>
                    <select
                      name="shiftType"
                      value={bulkUpdateData.shiftType}
                      onChange={handleBulkUpdateChange}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                      disabled={loading}
                    >
                      <option value="">الجميع</option>
                      <option value="administrative">إداري</option>
                      <option value="dayStation">محطة نهارًا</option>
                      <option value="nightStation">محطة ليلًا</option>
                      <option value="24/24">24/24</option>
                    </select>
                  </div>
                </div>
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 text-right">
                    استثناء الموظفين
                  </h4>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-blue-100 bg-white">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-purple-100 sticky top-0">
                          <th className="p-4 text-sm font-semibold">استثناء</th>
                          <th className="p-4 text-sm font-semibold">كود الموظف</th>
                          <th className="p-4 text-sm font-semibold">الاسم</th>
                          <th className="p-4 text-sm font-semibold">القسم</th>
                          <th className="p-4 text-sm font-semibold">نوع الشيفت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u._id} className="border-b hover:bg-blue-50">
                            <td className="p-4">
                              <input
                                type="checkbox"
                                checked={bulkUpdateData.excludedUsers.includes(u._id)}
                                onChange={() => handleExcludeUser(u._id)}
                                className="h-4 w-4 text-blue-400 rounded focus:ring-blue-400"
                              />
                            </td>
                            <td className="p-4 text-sm">{u.code}</td>
                            <td className="p-4 text-sm">{u.employeeName}</td>
                            <td className="p-4 text-sm">{u.department}</td>
                            <td className="p-4 text-sm">
                              {u.shiftType === 'administrative' ? 'إداري' :
                               u.shiftType === 'dayStation' ? 'محطة نهارًا' :
                               u.shiftType === 'nightStation' ? 'محطة ليلًا' : '24/24'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    تطبيق التعديلات
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setBulkUpdateType(null)}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-lg border border-blue-100 max-w-7xl mx-auto font-cairo"
      >
        <h2 className="text-3xl font-bold text-blue-400 mb-8 text-right">
          إدارة الموظفين
        </h2>
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
        <div className="flex flex-wrap gap-4 mb-8">
          {[
            { type: 'baseSalary', label: 'زيادة نسبة الراتب الأساسي' },
            { type: 'monthlyLateAllowance', label: 'تعديل دقائق التأخير الشهري' },
            { type: 'annualLeaveBalance', label: 'تعديل رصيد الإجازة السنوية' },
            { type: 'baseBonus', label: 'تعديل الحافز الأساسي' },
            { type: 'medicalInsurance', label: 'تعديل التأمين الطبي' },
            { type: 'socialInsurance', label: 'تعديل التأمين الاجتماعي' },
          ].map(({ type, label }) => (
            <motion.button
              key={type}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setBulkUpdateType(type)}
              className="bg-blue-400 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold flex items-center gap-2 shadow-md"
            >
              <Plus className="h-4 w-4" />
              {label}
            </motion.button>
          ))}
        </div>
        {!selectedUser ? (
          <div>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex-1">
                <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                  كود الموظف
                </label>
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                  placeholder="أدخل كود الموظف"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-3 items-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearch}
                  className="bg-blue-400 text-white px-4 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold flex items-center gap-2 shadow-md"
                  disabled={loading}
                >
                  <Search className="h-4 w-4" />
                  بحث
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShowAll}
                  className="bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold shadow-md"
                  disabled={loading}
                >
                  عرض الكل
                </motion.button>
              </div>
            </div>
            {filteredUsers.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-purple-100">
                      <th className="p-4 text-sm font-semibold">كود الموظف</th>
                      <th className="p-4 text-sm font-semibold">الاسم</th>
                      <th className="p-4 text-sm font-semibold">القسم</th>
                      <th className="p-4 text-sm font-semibold">الراتب الأساسي</th>
                      <th className="p-4 text-sm font-semibold">الحافز الأساسي</th>
                      <th className="p-4 text-sm font-semibold">نسبة الحافز (%)</th>
                      <th className="p-4 text-sm font-semibold">التأمين الطبي</th>
                      <th className="p-4 text-sm font-semibold">التأمين الاجتماعي</th>
                      <th className="p-4 text-sm font-semibold">بدل وجبة</th>
                      <th className="p-4 text-sm font-semibold">أيام العمل</th>
                      <th className="p-4 text-sm font-semibold">نوع الشيفت</th>
                      <th className="p-4 text-sm font-semibold">رصيد الإجازة</th>
                      <th className="p-4 text-sm font-semibold">دقائق التأخير</th>
                      <th className="p-4 text-sm font-semibold">الصافي</th>
                      <th className="p-4 text-sm font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="border-b hover:bg-blue-50">
                        <td className="p-4 text-sm">{u.code}</td>
                        <td className="p-4 text-sm">{u.employeeName}</td>
                        <td className="p-4 text-sm">{u.department}</td>
                        <td className="p-4 text-sm">{u.baseSalary.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.baseBonus.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.bonusPercentage.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.medicalInsurance.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.socialInsurance.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.mealAllowance.toFixed(2)}</td>
                        <td className="p-4 text-sm">{u.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
                        <td className="p-4 text-sm">
                          {u.shiftType === 'administrative' ? 'إداري' :
                           u.shiftType === 'dayStation' ? 'محطة نهارًا' :
                           u.shiftType === 'nightStation' ? 'محطة ليلًا' : '24/24'}
                        </td>
                        <td className="p-4 text-sm">{u.annualLeaveBalance}</td>
                        <td className="p-4 text-sm">{u.monthlyLateAllowance}</td>
                        <td className="p-4 text-sm">{u.netSalary.toFixed(2)}</td>
                        <td className="p-4 text-sm flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleEdit(u)}
                            className="bg-blue-400 text-white px-3 py-2 rounded-lg hover:bg-blue-500 transition-all duration-200"
                          >
                            <Edit2 className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowDeleteConfirm(u)}
                            className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'code', label: 'كود الموظف', type: 'text', required: true },
              { name: 'password', label: 'كلمة المرور (اتركها فارغة لعدم التغيير)', type: 'password' },
              { name: 'employeeName', label: 'الاسم الكامل', type: 'text', required: true },
              { name: 'department', label: 'القسم', type: 'text', required: true },
              { name: 'baseSalary', label: 'الراتب الأساسي', type: 'number', min: '0', step: '0.01', required: true },
              { name: 'baseBonus', label: 'الحافز الأساسي', type: 'number', min: '0', step: '0.01' },
              { name: 'bonusPercentage', label: 'نسبة الحافز (%)', type: 'number', min: '0', max: '100', step: '0.01' },
              { name: 'medicalInsurance', label: 'التأمين الطبي', type: 'number', min: '0', step: '0.01' },
              { name: 'socialInsurance', label: 'التأمين الاجتماعي', type: 'number', min: '0', step: '0.01' },
              { name: 'mealAllowance', label: 'بدل وجبة', type: 'number', min: '0', step: '0.01' },
              { name: 'workingDays', label: 'عدد أيام العمل', type: 'select', options: [
                { value: '5', label: '5 أيام (الجمعة والسبت إجازة)' },
                { value: '6', label: '6 أيام (الجمعة إجازة)' },
              ]},
              { name: 'shiftType', label: 'نوع الشيفت', type: 'select', options: [
                { value: 'administrative', label: 'إداري' },
                { value: 'dayStation', label: 'محطة نهارًا' },
                { value: 'nightStation', label: 'محطة ليلًا' },
                { value: '24/24', label: '24/24' },
              ]},
              { name: 'annualLeaveBalance', label: 'رصيد الإجازة السنوية', type: 'number', min: '0' },
              { name: 'monthlyLateAllowance', label: 'رصيد دقائق التأخير الشهري', type: 'number', min: '0' },
              { name: 'netSalary', label: 'الصافي', type: 'text', readOnly: true },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                    disabled={loading}
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 ${field.readOnly ? 'cursor-not-allowed bg-gray-100' : 'hover:bg-blue-50'}`}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    required={field.required}
                    readOnly={field.readOnly}
                    disabled={loading}
                  />
                )}
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                إلغاء
              </motion.button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default EditUser;
