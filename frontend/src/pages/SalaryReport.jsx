import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';
import { Edit } from 'lucide-react';

const SalaryReport = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summaries, setSummaries] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editFinance, setEditFinance] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleSearch = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const params = {
      code: employeeCode,
      startDate,
      endDate,
    };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/salary-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setSummaries(response.data.summaries);
      if (Object.keys(response.data.summaries).length === 0) {
        setError('لا توجد سجلات مطابقة لمعايير البحث.');
      }
    } catch (err) {
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const params = { startDate, endDate };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/salary-report`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setSummaries(response.data.summaries);
    } catch (err) {
      setError(`خطأ أثناء عرض جميع السجلات: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditFinance = (summary) => {
    setEditFinance({
      id: Object.keys(summaries).find((key) => summaries[key].employeeCode === summary.employeeCode),
      employeeCode: summary.employeeCode,
      violationsTotal: summary.violationsTotal || 0,
      violationsDeduction: summary.violationsDeduction || 0,
      advancesTotal: summary.advancesTotal || 0,
      advancesDeduction: summary.advancesDeduction || 0,
    });
    setShowEditModal(true);
  };

  const handleEditFinanceChange = (e) => {
    const { name, value } = e.target;
    setEditFinance((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditFinanceSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      await axios.patch(
        `${process.env.REACT_APP_API_URL}/api/users/${editFinance.id}/update-finance`,
        {
          violationsTotal: parseFloat(editFinance.violationsTotal),
          violationsDeduction: parseFloat(editFinance.violationsDeduction),
          advancesTotal: parseFloat(editFinance.advancesTotal),
          advancesDeduction: parseFloat(editFinance.advancesDeduction),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setEditFinance(null);
        setShowEditModal(false);
        handleSearch();
      }, 2000);
    } catch (err) {
      setError(`خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  // دالة مساعدة لتحويل القيم الرقمية مع قيمة افتراضية
  const formatNumber = (value) => {
    return typeof value === 'number' ? value.toFixed(2) : '0.00';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-lg border border-blue-100 max-w-7xl mx-auto font-cairo"
      >
        <h2 className="text-3xl font-bold text-blue-400 mb-8 text-right">تقرير الراتب</h2>
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
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                disabled={loading}
                placeholder="مثال: 123"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                من التاريخ
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                إلى التاريخ
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-4 mb-8">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              بحث
            </motion.button>
            <motion.button
              onClick={handleShowAll}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              عرض الكل
            </motion.button>
          </div>
          {Object.keys(summaries).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="overflow-x-auto bg-white rounded-xl shadow-lg border border-blue-100"
            >
              <h3 className="text-lg font-bold text-blue-400 mb-4 text-right px-4 pt-4">ملخص تقرير الراتب</h3>
              <table className="w-full table-auto border-collapse text-right text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-100 to-purple-100">
                    <th className="px-4 py-3 font-semibold text-blue-400">كود الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">اسم الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">الراتب الأساسي</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام العمل الأسبوعية</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">بدل الوجبة</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">نوع الشيفت</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">التأمين الطبي</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">التأمين الاجتماعي</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الغياب</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الإجازة الأسبوعية</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الإجازة الرسمية</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">أيام الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي الخصومات</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي بدل الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي خصم الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي أيام العمل</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي ساعات العمل</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي تعويض الساعات الإضافية</th>
                    {Object.values(summaries).some(summary => !['dayStation', 'nightStation'].includes(summary.shiftType)) && (
                      <th className="px-4 py-3 font-semibold text-blue-400">إجمالي بدل الجمعة</th>
                    )}
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي خصم الساعات</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي خصم الغياب</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي خصم بدل الوجبة</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي المخالفات</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">خصم المخالفات</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">إجمالي السلف</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">استقطاع السلف</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">صافي الراتب</th>
                    <th className="px-4 py-3 font-semibold text-blue-400">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaries).map(([userId, summary], index) => (
                    <motion.tr
                      key={userId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.3 }}
                      className="border-b border-blue-100 hover:bg-blue-50"
                    >
                      <td className="px-4 py-3">{summary.employeeCode}</td>
                      <td className="px-4 py-3">{summary.employeeName}</td>
                      <td className="px-4 py-3">{formatNumber(summary.baseSalary)}</td>
                      <td className="px-4 py-3">{summary.workingDays}</td>
                      <td className="px-4 py-3">{formatNumber(summary.mealAllowance)}</td>
                      <td className="px-4 py-3">{summary.shiftType}</td>
                      <td className="px-4 py-3">{formatNumber(summary.medicalInsurance)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.socialInsurance)}</td>
                      <td className="px-4 py-3">{summary.presentDays}</td>
                      <td className="px-4 py-3">{summary.absentDays}</td>
                      <td className="px-4 py-3">{summary.weeklyOffDays}</td>
                      <td className="px-4 py-3">{summary.leaveDays}</td>
                      <td className="px-4 py-3">{summary.officialLeaveDays}</td>
                      <td className="px-4 py-3">{summary.medicalLeaveDays}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalDeductions)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalLeaveCompensation)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalMedicalLeaveDeduction)}</td>
                      <td className="px-4 py-3">{summary.totalWorkDays}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalWorkHours)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalExtraHoursCompensation)}</td>
                      {!['dayStation', 'nightStation'].includes(summary.shiftType) && (
                        <td className="px-4 py-3">{formatNumber(summary.totalFridayBonus)}</td>
                      )}
                      <td className="px-4 py-3">{formatNumber(summary.totalHoursDeduction)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalAbsentDeduction)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.totalMealAllowanceDeduction)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.violationsTotal)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.violationsDeduction)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.advancesTotal)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.advancesDeduction)}</td>
                      <td className="px-4 py-3">{formatNumber(summary.netSalary)}</td>
                      <td className="px-4 py-3">
                        <motion.button
                          onClick={() => handleEditFinance(summary)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-purple-600 hover:text-purple-700"
                        >
                          <Edit className="h-4 w-4" />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
          {showEditModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-blue-100 w-full max-w-lg font-cairo"
              >
                <h3 className="text-lg font-bold text-blue-400 mb-4 text-right">تعديل البيانات المالية</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      value={editFinance.employeeCode}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm bg-purple-50 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      إجمالي المخالفات
                    </label>
                    <input
                      type="number"
                      name="violationsTotal"
                      value={editFinance.violationsTotal}
                      onChange={handleEditFinanceChange}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      خصم المخالفات
                    </label>
                    <input
                      type="number"
                      name="violationsDeduction"
                      value={editFinance.violationsDeduction}
                      onChange={handleEditFinanceChange}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      إجمالي السلف
                    </label>
                    <input
                      type="number"
                      name="advancesTotal"
                      value={editFinance.advancesTotal}
                      onChange={handleEditFinanceChange}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      استقطاع السلف
                    </label>
                    <input
                      type="number"
                      name="advancesDeduction"
                      value={editFinance.advancesDeduction}
                      onChange={handleEditFinanceChange}
                      className="w-full px-4 py-3 border border-blue-100 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-purple-50 hover:bg-blue-50"
                      disabled={loading}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-4">
                    <motion.button
                      type="button"
                      onClick={handleEditFinanceSubmit}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-all duration-200 text-sm font-semibold shadow-md ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      حفظ
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold shadow-md ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      إلغاء
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SalaryReport;
