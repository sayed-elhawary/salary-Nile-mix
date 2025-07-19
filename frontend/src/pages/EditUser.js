import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';
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

  // التحقق من صلاحيات المستخدم وجلب جميع الموظفين عند التحميل
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    handleShowAll();
  }, [user, navigate]);

  // دالة البحث عن موظف باستخدام الكود
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

  // دالة جلب جميع الموظفين
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

  // دالة تحديد موظف للتعديل
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

  // دالة حذف موظف
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

  // دالة التعامل مع تغييرات النموذج الفردي
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

  // دالة التعامل مع إرسال نموذج تعديل الموظف الفردي
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
        monthlyLateAllowance: parseInt(form.monthlyLateAllowance),
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

  // دالة التعامل مع تغييرات التعديل الجماعي
  const handleBulkUpdateChange = (e) => {
    const { name, value } = e.target;
    setBulkUpdateData((prev) => ({ ...prev, [name]: value }));
  };

  // دالة استثناء موظف من التعديل الجماعي
  const handleExcludeUser = (userId) => {
    setBulkUpdateData((prev) => ({
      ...prev,
      excludedUsers: prev.excludedUsers.includes(userId)
        ? prev.excludedUsers.filter((id) => id !== userId)
        : [...prev.excludedUsers, userId],
    }));
  };

  // دالة إرسال التعديل الجماعي
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
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl font-amiri">
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <LoadingSpinner />
          </motion.div>
        )}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 text-right max-w-md w-full"
            >
              <h3 className="text-lg font-semibold text-blue-600 mb-4">
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
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium"
                >
                  حذف
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(null)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium"
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
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white p-6 rounded-lg shadow-xl border border-gray-200 text-right max-w-4xl w-full"
            >
              <h3 className="text-lg font-semibold text-blue-600 mb-4">
                {bulkUpdateType === 'baseSalary' && 'زيادة نسبة الراتب الأساسي'}
                {bulkUpdateType === 'monthlyLateAllowance' && 'تعديل دقائق السماح الشهري'}
                {bulkUpdateType === 'annualLeaveBalance' && 'تعديل رصيد الإجازة السنوية'}
                {bulkUpdateType === 'baseBonus' && 'تعديل الحافز الأساسي'}
                {bulkUpdateType === 'medicalInsurance' && 'تعديل التأمين الطبي'}
                {bulkUpdateType === 'socialInsurance' && 'تعديل التأمين الاجتماعي'}
              </h3>
              <form onSubmit={handleBulkUpdateSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {bulkUpdateType === 'baseSalary' && (
                    <div>
                      <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                        النسبة المئوية (%)
                      </label>
                      <input
                        type="number"
                        name="percentage"
                        value={bulkUpdateData.percentage}
                        onChange={handleBulkUpdateChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                        min="0"
                        step="0.01"
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  {['monthlyLateAllowance', 'annualLeaveBalance', 'baseBonus', 'medicalInsurance', 'socialInsurance'].includes(bulkUpdateType) && (
                    <div>
                      <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                        القيمة الجديدة
                      </label>
                      <input
                        type="number"
                        name={bulkUpdateType}
                        value={bulkUpdateData[bulkUpdateType]}
                        onChange={handleBulkUpdateChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
                        min="0"
                        step={['baseBonus', 'medicalInsurance', 'socialInsurance'].includes(bulkUpdateType) ? '0.01' : '1'}
                        required
                        disabled={loading}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                      نوع الشيفت (اختياري)
                    </label>
                    <select
                      name="shiftType"
                      value={bulkUpdateData.shiftType}
                      onChange={handleBulkUpdateChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50"
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
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2 text-right">
                    استثناء الموظفين
                  </h4>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-blue-50 sticky top-0">
                          <th className="p-3 text-sm font-medium">استثناء</th>
                          <th className="p-3 text-sm font-medium">كود الموظف</th>
                          <th className="p-3 text-sm font-medium">الاسم</th>
                          <th className="p-3 text-sm font-medium">القسم</th>
                          <th className="p-3 text-sm font-medium">نوع الشيفت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u._id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={bulkUpdateData.excludedUsers.includes(u._id)}
                                onChange={() => handleExcludeUser(u._id)}
                                className="h-4 w-4 text-blue-600"
                              />
                            </td>
                            <td className="p-3 text-sm">{u.code}</td>
                            <td className="p-3 text-sm">{u.employeeName}</td>
                            <td className="p-3 text-sm">{u.department}</td>
                            <td className="p-3 text-sm">
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
                    className={`bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    تطبيق التعديلات
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setBulkUpdateType(null)}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`bg-gray-500 text-white px-5 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-blue-600 mb-6 sm:mb-8 text-right">
          إدارة الموظفين
        </h2>
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
        <div className="flex flex-wrap gap-3 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('baseSalary')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            زيادة نسبة الراتب الأساسي
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('monthlyLateAllowance')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            تعديل دقائق السماح الشهري
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('annualLeaveBalance')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            تعديل رصيد الإجازة السنوية
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('baseBonus')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            تعديل الحافز الأساسي
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('medicalInsurance')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            تعديل التأمين الطبي
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setBulkUpdateType('socialInsurance')}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all duration-200 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            تعديل التأمين الاجتماعي
          </motion.button>
        </div>
        {!selectedUser ? (
          <div>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                  كود الموظف
                </label>
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                  placeholder="أدخل كود الموظف"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-3 items-end">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearch}
                  className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium flex items-center gap-2"
                  disabled={loading}
                >
                  <Search className="h-4 w-4" />
                  بحث
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleShowAll}
                  className="bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium"
                  disabled={loading}
                >
                  عرض الكل
                </motion.button>
              </div>
            </div>
            {filteredUsers.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="p-3 text-sm font-medium">كود الموظف</th>
                      <th className="p-3 text-sm font-medium">الاسم</th>
                      <th className="p-3 text-sm font-medium">القسم</th>
                      <th className="p-3 text-sm font-medium">الراتب الأساسي</th>
                      <th className="p-3 text-sm font-medium">الحافز الأساسي</th>
                      <th className="p-3 text-sm font-medium">نسبة الحافز (%)</th>
                      <th className="p-3 text-sm font-medium">التأمين الطبي</th>
                      <th className="p-3 text-sm font-medium">التأمين الاجتماعي</th>
                      <th className="p-3 text-sm font-medium">بدل وجبة</th>
                      <th className="p-3 text-sm font-medium">أيام العمل</th>
                      <th className="p-3 text-sm font-medium">نوع الشيفت</th>
                      <th className="p-3 text-sm font-medium">رصيد الإجازة</th>
                      <th className="p-3 text-sm font-medium">دقائق السماح</th>
                      <th className="p-3 text-sm font-medium">الصافي</th>
                      <th className="p-3 text-sm font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{u.code}</td>
                        <td className="p-3 text-sm">{u.employeeName}</td>
                        <td className="p-3 text-sm">{u.department}</td>
                        <td className="p-3 text-sm">{u.baseSalary.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.baseBonus.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.bonusPercentage.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.medicalInsurance.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.socialInsurance.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.mealAllowance.toFixed(2)}</td>
                        <td className="p-3 text-sm">{u.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
                        <td className="p-3 text-sm">
                          {u.shiftType === 'administrative' ? 'إداري' :
                           u.shiftType === 'dayStation' ? 'محطة نهارًا' :
                           u.shiftType === 'nightStation' ? 'محطة ليلًا' : '24/24'}
                        </td>
                        <td className="p-3 text-sm">{u.annualLeaveBalance}</td>
                        <td className="p-3 text-sm">{u.monthlyLateAllowance}</td>
                        <td className="p-3 text-sm">{u.netSalary.toFixed(2)}</td>
                        <td className="p-3 text-sm flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleEdit(u)}
                            className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-all duration-200"
                          >
                            <Edit2 className="h-4 w-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowDeleteConfirm(u)}
                            className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-all duration-200"
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
                كلمة المرور (اتركها فارغة لعدم التغيير)
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-gray-500 text-white px-5 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
