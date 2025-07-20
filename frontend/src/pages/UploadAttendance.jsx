import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';
import { Trash2, Edit } from 'lucide-react';

const UploadAttendance = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPresent, setFilterPresent] = useState(false);
  const [filterAbsent, setFilterAbsent] = useState(false);
  const [filterSingleCheckIn, setFilterSingleCheckIn] = useState(false);
  const [shiftType, setShiftType] = useState('all');
  const [records, setRecords] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [showOfficialLeaveForm, setShowOfficialLeaveForm] = useState(false);
  const [officialLeaveData, setOfficialLeaveData] = useState({
    employeeCode: '',
    startDate: '',
    endDate: '',
    applyToAll: false,
  });
  const [showAnnualLeaveForm, setShowAnnualLeaveForm] = useState(false);
  const [annualLeaveData, setAnnualLeaveData] = useState({
    employeeCode: '',
    startDate: '',
    endDate: '',
    applyToAll: false,
    isMedicalLeave: false,
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // التحقق من صلاحية المستخدم
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop().toLowerCase();
      if (fileExt !== 'csv' && fileExt !== 'xlsx') {
        setError('يرجى اختيار ملف بصيغة .csv أو .xlsx');
        setFile(null);
        return;
      }
      setError('');
      setFile(selectedFile);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('يرجى اختيار ملف للرفع');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/attendance/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setSuccessMessage('تم رفع الملف بنجاح');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
        setFile(null);
        handleSearch();
      }, 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء رفع الملف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const params = {
      employeeCode: employeeCode.trim(),
      startDate,
      endDate,
      filterPresent,
      filterAbsent,
      filterSingleCheckIn,
      shiftType: shiftType === 'all' ? undefined : shiftType,
    };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRecords(response.data.records || []);
      setSummaries(response.data.summaries || {});
      if (response.data.records.length === 0) {
        setError('لا توجد سجلات مطابقة لمعايير البحث.');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء البحث: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowAll = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const params = {
      startDate,
      endDate,
      shiftType: shiftType === 'all' ? undefined : shiftType,
    };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRecords(response.data.records || []);
      setSummaries(response.data.summaries || {});
      if (response.data.records.length === 0) {
        setError('لا توجد سجلات متاحة.');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء عرض جميع السجلات: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAll = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords([]);
      setSummaries({});
      setSuccessMessage('تم حذف جميع البصمات بنجاح');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء الحذف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEdit = (record) => {
    if (!record._id) {
      setError('خطأ: السجل لا يحتوي على معرف صالح');
      return;
    }
    setEditRecord({
      id: record._id,
      employeeCode: record.employeeCode,
      date: new Date(record.date).toISOString().split('T')[0],
      checkIn: record.checkIn || '',
      checkOut: record.checkOut || '',
      status: record.status,
      isAnnualLeave: record.status === 'leave' && record.leaveCompensation === 0 && record.medicalLeaveDeduction === 0,
      isLeaveCompensation: record.status === 'leave' && record.leaveCompensation > 0,
      isMedicalLeave: record.status === 'medical_leave',
      calculatedWorkDays: record.calculatedWorkDays || 0,
      extraHours: record.extraHours || 0,
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditRecord((prev) => {
      const newRecord = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'isAnnualLeave' && checked) {
        newRecord.isLeaveCompensation = false;
        newRecord.isMedicalLeave = false;
        newRecord.status = 'leave';
        newRecord.checkIn = '';
        newRecord.checkOut = '';
        newRecord.calculatedWorkDays = 0;
        newRecord.extraHours = 0;
      } else if (name === 'isLeaveCompensation' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isMedicalLeave = false;
        newRecord.status = 'leave';
        newRecord.checkIn = '';
        newRecord.checkOut = '';
        newRecord.calculatedWorkDays = 0;
        newRecord.extraHours = 0;
      } else if (name === 'isMedicalLeave' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isLeaveCompensation = false;
        newRecord.status = 'medical_leave';
        newRecord.checkIn = '';
        newRecord.checkOut = '';
        newRecord.calculatedWorkDays = 0;
        newRecord.extraHours = 0;
      } else if (name === 'status' && value !== 'leave' && value !== 'medical_leave') {
        newRecord.isAnnualLeave = false;
        newRecord.isLeaveCompensation = false;
        newRecord.isMedicalLeave = false;
      }
      return newRecord;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!editRecord.id) {
      setError('خطأ: معرف السجل غير موجود');
      setLoading(false);
      return;
    }

    const token = localStorage.getItem('token');

    try {
      await axios.put(`${process.env.REACT_APP_API_URL}/api/attendance/${editRecord.id}`, editRecord, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccessMessage('تم تعديل السجل بنجاح');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
        setEditRecord(null);
        setShowEditModal(false);
        handleSearch();
      }, 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء التعديل: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOfficialLeaveChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOfficialLeaveData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleOfficialLeaveSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/attendance/official_leave`,
        { ...officialLeaveData, employeeCode: officialLeaveData.employeeCode.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccessMessage('تم تحديد الإجازة الرسمية بنجاح');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
        setShowOfficialLeaveForm(false);
        setOfficialLeaveData({ employeeCode: '', startDate: '', endDate: '', applyToAll: false });
        handleSearch();
      }, 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء تحديد الإجازة الرسمية: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnualLeaveChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAnnualLeaveData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAnnualLeaveSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/attendance/annual_leave`,
        { ...annualLeaveData, employeeCode: annualLeaveData.employeeCode.trim() },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccessMessage('تم تحديد الإجازة السنوية بنجاح');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
        setShowAnnualLeaveForm(false);
        setAnnualLeaveData({ employeeCode: '', startDate: '', endDate: '', applyToAll: false, isMedicalLeave: false });
        handleSearch();
      }, 2000);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
      }
      setError(`خطأ أثناء تحديد الإجازة السنوية: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    return typeof value === 'number' ? value.toFixed(2) : '0.00';
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8 font-cairo">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 text-right"
          >
            {successMessage}
          </motion.div>
        )}
        {showDeleteConfirm && (
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
              className="bg-white p-6 rounded-xl shadow-lg border border-purple-200 text-right max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-purple-600 mb-4">تأكيد الحذف</h3>
              <p className="text-sm text-gray-600 mb-6">هل أنت متأكد من حذف جميع بصمات الحضور؟</p>
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={confirmDeleteAll}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all duration-200 text-sm font-semibold"
                >
                  حذف
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-semibold"
                >
                  إلغاء
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-lg border border-blue-200 max-w-7xl mx-auto"
      >
        <h2 className="text-3xl font-bold text-blue-600 mb-8 text-right">إدارة بصمات الموظفين</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-right text-sm font-semibold"
          >
            {error}
          </motion.div>
        )}
        <div className="space-y-8">
          <form onSubmit={handleUpload} className="mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="w-full sm:w-1/2 px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading || !file}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                  loading || !file ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                رفع الملف
              </motion.button>
            </div>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">كود الموظف</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
                placeholder="مثال: 123"
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">من التاريخ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">إلى التاريخ</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">نوع الدوام</label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              >
                <option value="all">الكل</option>
                <option value="administrative">إداري</option>
                <option value="dayStation">محطة نهار</option>
                <option value="nightStation">محطة ليل</option>
                <option value="24/24">24/24</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-end">
            <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
              <input
                type="checkbox"
                checked={filterPresent}
                onChange={(e) => {
                  setFilterPresent(e.target.checked);
                  if (e.target.checked) {
                    setFilterAbsent(false);
                    setFilterSingleCheckIn(false);
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                disabled={loading}
              />
              إظهار أيام الحضور فقط
            </label>
            <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
              <input
                type="checkbox"
                checked={filterAbsent}
                onChange={(e) => {
                  setFilterAbsent(e.target.checked);
                  if (e.target.checked) {
                    setFilterPresent(false);
                    setFilterSingleCheckIn(false);
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                disabled={loading}
              />
              إظهار أيام الغياب فقط
            </label>
            <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
              <input
                type="checkbox"
                checked={filterSingleCheckIn}
                onChange={(e) => {
                  setFilterSingleCheckIn(e.target.checked);
                  if (e.target.checked) {
                    setFilterPresent(false);
                    setFilterAbsent(false);
                  }
                }}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                disabled={loading}
              />
              إظهار البصمة الواحدة فقط
            </label>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-4 mb-8">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              عرض الكل
            </motion.button>
            <motion.button
              onClick={() => setShowOfficialLeaveForm(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إجازة رسمية
            </motion.button>
            <motion.button
              onClick={() => setShowAnnualLeaveForm(true)}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              إجازة سنوية
            </motion.button>
            <motion.button
              onClick={handleDeleteAll}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-semibold shadow-md flex items-center justify-center ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              حذف جميع البصمات
            </motion.button>
          </div>
          {showOfficialLeaveForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-50 p-6 rounded-xl shadow-lg border border-blue-200 mb-8"
            >
              <h3 className="text-xl font-bold text-blue-600 mb-4 text-right">تحديد إجازة رسمية</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={officialLeaveData.employeeCode}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || officialLeaveData.applyToAll}
                    placeholder="مثال: 3343"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    من التاريخ
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={officialLeaveData.startDate}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    إلى التاريخ
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={officialLeaveData.endDate}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={officialLeaveData.applyToAll}
                      onChange={handleOfficialLeaveChange}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                      disabled={loading}
                    />
                    تطبيق للجميع
                  </label>
                </div>
                <div className="lg:col-span-3 flex justify-end gap-4">
                  <motion.button
                    type="button"
                    onClick={handleOfficialLeaveSubmit}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    حفظ
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowOfficialLeaveForm(false)}
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
          )}
          {showAnnualLeaveForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gray-50 p-6 rounded-xl shadow-lg border border-blue-200 mb-8"
            >
              <h3 className="text-xl font-bold text-blue-600 mb-4 text-right">تحديد إجازة سنوية</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={annualLeaveData.employeeCode}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || annualLeaveData.applyToAll}
                    placeholder="مثال: 3343"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    من التاريخ
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={annualLeaveData.startDate}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    إلى التاريخ
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={annualLeaveData.endDate}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div className="lg:col-span-3 space-y-2">
                  <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={annualLeaveData.applyToAll}
                      onChange={handleAnnualLeaveChange}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                      disabled={loading}
                    />
                    تطبيق للجميع
                  </label>
                  <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                    <input
                      type="checkbox"
                      name="isMedicalLeave"
                      checked={annualLeaveData.isMedicalLeave}
                      onChange={handleAnnualLeaveChange}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                      disabled={loading}
                    />
                    إجازة مرضية
                  </label>
                </div>
                <div className="lg:col-span-3 flex justify-end gap-4">
                  <motion.button
                    type="button"
                    onClick={handleAnnualLeaveSubmit}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    حفظ
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setShowAnnualLeaveForm(false)}
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
                className="bg-white p-8 rounded-xl shadow-lg border border-blue-200 w-full max-w-lg"
              >
                <h3 className="text-xl font-bold text-blue-600 mb-4 text-right">تعديل سجل الحضور</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      value={editRecord.employeeCode}
                      className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      التاريخ
                    </label>
                    <input
                      type="date"
                      value={editRecord.date}
                      className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      الحضور
                    </label>
                    <input
                      type="text"
                      value={editRecord.checkIn}
                      onChange={handleEditChange}
                      name="checkIn"
                      className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                      disabled={loading || editRecord.isAnnualLeave || editRecord.isLeaveCompensation || editRecord.isMedicalLeave}
                      placeholder="HH:mm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      الانصراف
                    </label>
                    <input
                      type="text"
                      value={editRecord.checkOut}
                      onChange={handleEditChange}
                      name="checkOut"
                      className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                      disabled={loading || editRecord.isAnnualLeave || editRecord.isLeaveCompensation || editRecord.isMedicalLeave}
                      placeholder="HH:mm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      الحالة
                    </label>
                    <select
                      value={editRecord.status}
                      onChange={handleEditChange}
                      name="status"
                      className="w-full px-4 py-3 border border-blue-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                      disabled={loading}
                    >
                      <option value="present">حضور</option>
                      <option value="absent">غياب</option>
                      <option value="weekly_off">إجازة أسبوعية</option>
                      <option value="leave">إجازة</option>
                      <option value="official_leave">إجازة رسمية</option>
                      <option value="medical_leave">إجازة مرضية</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                      <input
                        type="checkbox"
                        name="isAnnualLeave"
                        checked={editRecord.isAnnualLeave}
                        onChange={handleEditChange}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                        disabled={loading}
                      />
                      إجازة سنوية
                    </label>
                    <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                      <input
                        type="checkbox"
                        name="isLeaveCompensation"
                        checked={editRecord.isLeaveCompensation}
                        onChange={handleEditChange}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                        disabled={loading}
                      />
                      بدل إجازة
                    </label>
                    <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                      <input
                        type="checkbox"
                        name="isMedicalLeave"
                        checked={editRecord.isMedicalLeave}
                        onChange={handleEditChange}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-200 rounded"
                        disabled={loading}
                      />
                      إجازة مرضية
                    </label>
                  </div>
                  <div className="sm:col-span-2 flex justify-end gap-4">
                    <motion.button
                      type="button"
                      onClick={handleEditSubmit}
                      disabled={loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-semibold shadow-md ${
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
          {records.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="overflow-x-auto rounded-lg border border-blue-200 bg-white"
            >
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="px-4 py-3 font-semibold text-blue-600">كود الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">اسم الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">الانصراف</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">نوع الدوام</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام العمل</th>
                    {records.some((record) => ['dayStation', 'nightStation'].includes(record.shiftType)) && (
                      <>
                        <th className="px-4 py-3 font-semibold text-blue-600">دقائق التأخير</th>
                        <th className="px-4 py-3 font-semibold text-blue-600">بدل التأخير</th>
                        <th className="px-4 py-3 font-semibold text-blue-600">خصم الساعات</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-semibold text-blue-600">الأيام المخصومة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">رصيد الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">حالة الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">بدل الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">خصم إجازة مرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">ساعات العمل</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const workHours = ['dayStation', 'nightStation'].includes(record.shiftType)
                      ? formatNumber(record.workHours)
                      : '-';
                    const rowClass =
                      record.status === 'absent'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : record.status === 'weekly_off'
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : record.status === 'leave' || record.status === 'official_leave' || record.status === 'medical_leave'
                        ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                        : 'bg-white hover:bg-blue-50';
                    return (
                      <tr key={record._id || Math.random()} className={`border-b border-blue-200 ${rowClass}`}>
                        <td className="px-4 py-3">{record.employeeCode}</td>
                        <td className="px-4 py-3">{record.employeeName}</td>
                        <td className="px-4 py-3">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                        <td className="px-4 py-3">{record.checkIn || '-'}</td>
                        <td className="px-4 py-3">{record.checkOut || '-'}</td>
                        <td className="px-4 py-3">
                          {record.shiftType === 'administrative'
                            ? 'إداري'
                            : record.shiftType === 'dayStation'
                            ? 'محطة نهار'
                            : record.shiftType === 'nightStation'
                            ? 'محطة ليل'
                            : record.shiftType === '24/24'
                            ? '24/24'
                            : '-'}
                        </td>
                        <td className="px-4 py-3">{record.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
                        {['dayStation', 'nightStation'].includes(record.shiftType) && (
                          <>
                            <td className="px-4 py-3">{formatNumber(record.lateMinutes)}</td>
                            <td className="px-4 py-3">{formatNumber(record.monthlyLateAllowance)}</td>
                            <td className="px-4 py-3">{formatNumber(record.hoursDeduction)}</td>
                          </>
                        )}
                        <td className="px-4 py-3">{formatNumber(record.deductedDays)}</td>
                        <td className="px-4 py-3">{formatNumber(record.annualLeaveBalance)}</td>
                        <td className="px-4 py-3">
                          {record.status === 'present'
                            ? 'حضور'
                            : record.status === 'absent'
                            ? 'غياب'
                            : record.status === 'weekly_off'
                            ? 'إجازة أسبوعية'
                            : record.status === 'leave'
                            ? 'إجازة'
                            : record.status === 'official_leave'
                            ? 'إجازة رسمية'
                            : record.status === 'medical_leave'
                            ? 'إجازة مرضية'
                            : '-'}
                        </td>
                        <td className="px-4 py-3">{formatNumber(record.leaveCompensation)}</td>
                        <td className="px-4 py-3">{formatNumber(record.medicalLeaveDeduction)}</td>
                        <td className="px-4 py-3">{workHours}</td>
                        <td className="px-4 py-3">
                          <motion.button
                            onClick={() => handleEdit(record)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </motion.button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
          {Object.keys(summaries).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 overflow-x-auto rounded-lg border border-blue-200 bg-white"
            >
              <h3 className="text-xl font-bold text-blue-600 mb-4 text-right px-4 pt-4">ملخص الحضور</h3>
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="px-4 py-3 font-semibold text-blue-600">كود الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">اسم الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الغياب</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الإجازة الأسبوعية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الإجازة الرسمية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">أيام الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي الأيام المخصومة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي بدل الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي خصم الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي خصم الساعات</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي أيام العمل المحسوبة</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي الساعات الإضافية</th>
                    <th className="px-4 py-3 font-semibold text-blue-600">إجمالي تعويض الساعات الإضافية</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaries).map(([employeeCode, summary]) => (
                    <tr key={employeeCode} className="border-b border-blue-200 hover:bg-blue-50">
                      <td className="px-4 py-3">{employeeCode}</td>
                      <td className="px-4 py-3">{summary.employeeName}</td>
                      <td className="px-4 py-3">{summary.presentDays || 0}</td>
                      <td className="px-4 py-3">{summary.absentDays || 0}</td>
                      <td className="px-4 py-3">{summary.weeklyOffDays || 0}</td>
                      <td className="px-4 py-3">{summary.leaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.officialLeaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.medicalLeaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalDeductedDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalLeaveCompensation ? formatNumber(summary.totalLeaveCompensation) : 0}</td>
                      <td className="px-4 py-3">{summary.totalMedicalLeaveDeduction ? formatNumber(summary.totalMedicalLeaveDeduction) : 0}</td>
                      <td className="px-4 py-3">{summary.totalHoursDeduction ? formatNumber(summary.totalHoursDeduction) : 0}</td>
                      <td className="px-4 py-3">{summary.totalWorkDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalExtraHours ? formatNumber(summary.totalExtraHours) : 0}</td>
                      <td className="px-4 py-3">{summary.totalExtraHoursCompensation ? formatNumber(summary.totalExtraHoursCompensation) : 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.entries(summaries).map(([employeeCode, summary]) => (
                summary.warning && (
                  <p key={employeeCode} className="text-red-600 text-sm font-semibold mt-2 text-right px-4 pb-4">{summary.warning}</p>
                )
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UploadAttendance;
