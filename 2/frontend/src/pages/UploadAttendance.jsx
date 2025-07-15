import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';
import moment from 'moment';

const UploadAttendance = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendances, setAttendances] = useState([]);
  const [totals, setTotals] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ checkIn: '', checkOut: '' });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('يرجى اختيار ملف');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/upload`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setFile(null);
      handleSearch();
    } catch (err) {
      setError(`خطأ أثناء رفع الملف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        params: { employeeCode, startDate, endDate },
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setAttendances(response.data.attendances);
      setTotals(response.data.totals);
    } catch (err) {
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (attendance) => {
    setEditing(attendance._id);
    setEditForm({ checkIn: attendance.checkIn || '', checkOut: attendance.checkOut || '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/attendance/${editing}`, editForm, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setEditing(null);
      handleSearch();
    } catch (err) {
      setError(`خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع البصمات؟')) return;
    setLoading(true);
    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      setAttendances([]);
      setTotals({});
    } catch (err) {
      setError(`خطأ أثناء الحذف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl font-amiri">
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
      >
        <h2 className="text-lg font-bold text-gray-900 mb-6 text-right">رفع بيانات البصمة</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              رفع ملف (Excel/CSV)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              رفع الملف
            </motion.button>
          </div>
          <div className="flex items-end">
            <motion.button
              type="button"
              onClick={handleDeleteAll}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full bg-red-500 text-white px-5 py-2.5 rounded-md hover:bg-red-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              حذف جميع البصمات
            </motion.button>
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              كود الموظف
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              من تاريخ
            </label>
            <input
              type="text"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="مثال: 1/5/2025"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
              إلى تاريخ
            </label>
            <input
              type="text"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="مثال: 31/5/2025"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-md text-right text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-gray-50 hover:bg-gray-100"
              disabled={loading}
            />
          </div>
          <div className="flex items-end">
            <motion.button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full bg-teal-500 text-white px-5 py-2.5 rounded-md hover:bg-teal-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              بحث
            </motion.button>
          </div>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">كود الموظف</th>
                <th className="px-4 py-3 font-medium text-gray-600">اسم الموظف</th>
                <th className="px-4 py-3 font-medium text-gray-600">التاريخ</th>
                <th className="px-4 py-3 font-medium text-gray-600">الحضور</th>
                <th className="px-4 py-3 font-medium text-gray-600">الانصراف</th>
                <th className="px-4 py-3 font-medium text-gray-600">نوع الشيفت</th>
                <th className="px-4 py-3 font-medium text-gray-600">عدد أيام العمل</th>
                <th className="px-4 py-3 font-medium text-gray-600">دقائق التأخير</th>
                <th className="px-4 py-3 font-medium text-gray-600">رصيد الإجازة</th>
                <th className="px-4 py-3 font-medium text-gray-600">سماح التأخير</th>
                <th className="px-4 py-3 font-medium text-gray-600">الحالة</th>
                <th className="px-4 py-3 font-medium text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((attendance) => (
                <tr key={attendance._id} className="border-b border-gray-200">
                  <td className="px-4 py-3">{attendance.employeeCode}</td>
                  <td className="px-4 py-3">{attendance.employeeName}</td>
                  <td className="px-4 py-3">{moment(attendance.date).format('D/M/YYYY')}</td>
                  <td className="px-4 py-3">
                    {editing === attendance._id ? (
                      <input
                        type="text"
                        value={editForm.checkIn}
                        onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-200 rounded-md text-right text-sm"
                        placeholder="HH:mm"
                      />
                    ) : (
                      attendance.checkIn || '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === attendance._id ? (
                      <input
                        type="text"
                        value={editForm.checkOut}
                        onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-200 rounded-md text-right text-sm"
                        placeholder="HH:mm"
                      />
                    ) : (
                      attendance.checkOut || '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {
                      {
                        administrative: 'إداري',
                        dayStation: 'محطة نهارًا',
                        nightStation: 'محطة ليلًا',
                        '24/24': '24/24',
                      }[attendance.shiftType]
                    }
                  </td>
                  <td className="px-4 py-3">{attendance.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
                  <td className="px-4 py-3">{attendance.lateMinutes}</td>
                  <td className="px-4 py-3">{attendance.annualLeaveBalance}</td>
                  <td className="px-4 py-3">{attendance.monthlyLateAllowance}</td>
                  <td className="px-4 py-3">
                    {
                      {
                        present: 'حاضر',
                        absent: 'غائب',
                        weekly_off: 'إجازة أسبوعية',
                        leave: 'إجازة',
                      }[attendance.status]
                    }
                  </td>
                  <td className="px-4 py-3">
                    {editing === attendance._id ? (
                      <div className="flex gap-2">
                        <motion.button
                          type="button"
                          onClick={handleEditSubmit}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-teal-500 text-white px-3 py-1 rounded-md text-sm"
                        >
                          حفظ
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={() => setEditing(null)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="bg-gray-500 text-white px-3 py-1 rounded-md text-sm"
                        >
                          إلغاء
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        type="button"
                        onClick={() => handleEdit(attendance)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm"
                      >
                        تعديل
                      </motion.button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Object.keys(totals).length > 0 && (
            <div className="mt-6 text-right">
              <h3 className="text-lg font-bold text-gray-900 mb-2">الإجماليات</h3>
              <p>أيام الحضور: {totals.present}</p>
              <p>أيام الغياب: {totals.absent}</p>
              <p>أيام الإجازة الأسبوعية: {totals.weeklyOff}</p>
              <p>أيام الإجازات: {totals.leave}</p>
              <p>إجمالي دقائق التأخير: {totals.totalLateMinutes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UploadAttendance;
