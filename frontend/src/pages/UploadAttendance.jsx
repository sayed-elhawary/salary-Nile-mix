import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../components/AuthProvider';
import LoadingSpinner from '../components/LoadingSpinner';
import SuccessCheckmark from '../components/SuccessCheckmark';
import { Trash2, Edit } from 'lucide-react';

const UploadAttendance = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterPresent, setFilterPresent] = useState(false);
  const [filterAbsent, setFilterAbsent] = useState(false);
  const [filterSingleCheckIn, setFilterSingleCheckIn] = useState(false);
  const [records, setRecords] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [error, setError] = useState('');
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
      setError('يرجى اختيار ملف');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');

    try {
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFile(null);
        handleSearch();
      }, 2000);
    } catch (err) {
      setError(`خطأ أثناء رفع الملف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');
    const params = { employeeCode, startDate, endDate, filterPresent, filterAbsent, filterSingleCheckIn };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const validRecords = response.data.records.filter(record => record._id);
      setRecords(validRecords);
      setSummaries(response.data.summaries);
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
    const params = { startDate, endDate, filterPresent, filterAbsent, filterSingleCheckIn };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      const validRecords = response.data.records.filter(record => record._id);
      setRecords(validRecords);
      setSummaries(response.data.summaries);
    } catch (err) {
      setError(`خطأ أثناء عرض جميع السجلات: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('هل أنت متأكد من حذف جميع البصمات؟')) return;
    setError('');
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      await axios.delete(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords([]);
      setSummaries({});
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      setError(`خطأ أثناء الحذف: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
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
      extraHoursCompensation: record.extraHoursCompensation || 0,
    });
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
        newRecord.extraHoursCompensation = 0;
      } else if (name === 'isLeaveCompensation' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isMedicalLeave = false;
        newRecord.status = 'leave';
        newRecord.checkIn = '';
        newRecord.checkOut = '';
        newRecord.calculatedWorkDays = 0;
        newRecord.extraHours = 0;
        newRecord.extraHoursCompensation = 0;
      } else if (name === 'isMedicalLeave' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isLeaveCompensation = false;
        newRecord.status = 'medical_leave';
        newRecord.checkIn = '';
        newRecord.checkOut = '';
        newRecord.calculatedWorkDays = 0;
        newRecord.extraHours = 0;
        newRecord.extraHoursCompensation = 0;
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
      const response = await axios.put(`${process.env.REACT_APP_API_URL}/api/attendance/${editRecord.id}`, editRecord, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setEditRecord(null);
        handleSearch();
      }, 2000);
    } catch (err) {
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/official_leave`, officialLeaveData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowOfficialLeaveForm(false);
        setOfficialLeaveData({ employeeCode: '', startDate: '', endDate: '', applyToAll: false });
        handleSearch();
      }, 2000);
    } catch (err) {
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
      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/annual_leave`, annualLeaveData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowAnnualLeaveForm(false);
        setAnnualLeaveData({ employeeCode: '', startDate: '', endDate: '', applyToAll: false, isMedicalLeave: false });
        handleSearch();
      }, 2000);
    } catch (err) {
      setError(`خطأ أثناء تحديد الإجازة السنوية: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // دالة للتحقق مما إذا كان اليوم جمعة
  const isFriday = (date) => {
    return new Date(date).getDay() === 5;
  };

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl font-amiri">
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
        <h2 className="text-2xl font-bold text-blue-600 mb-6 sm:mb-8 text-right">رفع بصمات الموظفين</h2>
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
          <form onSubmit={handleUpload} className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="w-full sm:w-auto px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                رفع الملف
              </motion.button>
            </div>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                من التاريخ
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                إلى التاريخ
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-end">
            <label className="flex items-center text-gray-600 text-sm font-medium text-right">
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
                className="mr-2"
                disabled={loading}
              />
              إظهار أيام الحضور فقط
            </label>
            <label className="flex items-center text-gray-600 text-sm font-medium text-right">
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
                className="mr-2"
                disabled={loading}
              />
              إظهار أيام الغياب فقط
            </label>
            <label className="flex items-center text-gray-600 text-sm font-medium text-right">
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
                className="mr-2"
                disabled={loading}
              />
              إظهار البصمة الواحدة فقط
            </label>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mb-6">
            <motion.button
              onClick={handleSearch}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
              className={`w-full sm:w-auto bg-red-600 text-white px-5 py-3 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium shadow-sm ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Trash2 className="h-4 w-4 inline mr-2" />
              حذف جميع البصمات
            </motion.button>
          </div>
          {showOfficialLeaveForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm mb-6"
            >
              <h3 className="text-lg font-bold text-blue-600 mb-4 text-right">تحديد إجازة رسمية</h3>
              <form onSubmit={handleOfficialLeaveSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={officialLeaveData.employeeCode}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || officialLeaveData.applyToAll}
                    placeholder="مثال: 123"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    من التاريخ
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={officialLeaveData.startDate}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    إلى التاريخ
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={officialLeaveData.endDate}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                < divalent className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={officialLeaveData.applyToAll}
                      onChange={handleOfficialLeaveChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    تطبيق للجميع
                  </label>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
                    className={`w-full sm:w-auto bg-gray-500 text-white px-5 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
          {showAnnualLeaveForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm mb-6"
            >
              <h3 className="text-lg font-bold text-blue-600 mb-4 text-right">تحديد إجازة سنوية</h3>
              <form onSubmit={handleAnnualLeaveSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={annualLeaveData.employeeCode}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || annualLeaveData.applyToAll}
                    placeholder="مثال: 123"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    من التاريخ
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={annualLeaveData.startDate}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    إلى التاريخ
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={annualLeaveData.endDate}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={annualLeaveData.applyToAll}
                      onChange={handleAnnualLeaveChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    تطبيق للجميع
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="isMedicalLeave"
                      checked={annualLeaveData.isMedicalLeave}
                      onChange={handleAnnualLeaveChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    إجازة مرضية
                  </label>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
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
                    className={`w-full sm:w-auto bg-gray-500 text-white px-5 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-sm ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}
          {records.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="overflow-x-auto"
            >
              <h3 className="text-lg font-bold text-blue-600 mb-4 text-right">سجلات الحضور</h3>
              <table className="min-w-full border-collapse text-right">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">كود الموظف</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">اسم الموظف</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">التاريخ</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">الحضور</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">الانصراف</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">نوع الدوام</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام العمل</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">دقائق التأخير</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">الأيام المخصومة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">رصيد الإجازة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">بدل التأخير</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">حالة الحضور</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">بدل الإجازة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">خصم إجازة مرضية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">ساعات العمل</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">تعويض الساعات الإضافية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record._id}
                      className={`border-b hover:bg-gray-50 ${isFriday(record.date) ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm">{record.employeeCode}</td>
                      <td className="px-4 py-3 text-sm">{record.employeeName}</td>
                      <td className="px-4 py-3 text-sm">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                      <td className="px-4 py-3 text-sm">{record.checkIn || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.checkOut || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.shiftType}</td>
                      <td className="px-4 py-3 text-sm">{record.calculatedWorkDays || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.lateMinutes || 0}</td>
                      <td className="px-4 py-3 text-sm">{record.deductedDays || 0}</td>
                      <td className="px-4 py-3 text-sm">{record.leaveBalance || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.lateDeduction || '-'}</td>
                      <td className="px-4 py-3 text-sm">{record.status}</td>
                      <td className="px-4 py-3 text-sm">{record.leaveCompensation || 0}</td>
                      <td className="px-4 py-3 text-sm">{record.medicalLeaveDeduction || 0}</td>
                      <td className="px-4 py-3 text-sm">{record.workHours ? record.workHours.toFixed(2) : 0}</td>
                      <td className="px-4 py-3 text-sm">{record.extraHoursCompensation ? record.extraHoursCompensation.toFixed(2) : 0}</td>
                      <td className="px-4 py-3 text-sm">
                        <motion.button
                          onClick={() => handleEdit(record)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Edit className="h-4 w-4" />
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
          {Object.keys(summaries).length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mt-8"
            >
              <h3 className="text-lg font-bold text-blue-600 mb-4 text-right">ملخص الحضور</h3>
              <table className="min-w-full border-collapse text-right">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">كود الموظف</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">اسم الموظف</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الحضور</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الغياب</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الإجازة الأسبوعية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الإجازة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الإجازة الرسمية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">أيام الإجازة المرضية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي دقائق التأخير</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي الأيام المخصومة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي بدل الإجازة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي خصم الإجازة المرضية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي أيام العمل المحسوبة</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي الساعات الإضافية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">إجمالي تعويض الساعات الإضافية</th>
                    <th className="px-4 py-3 text-sm font-medium text-gray-600 border-b">صافي تعويض الساعات الإضافية</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaries).map(([code, summary]) => (
                    <tr key={code} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{code}</td>
                      <td className="px-4 py-3 text-sm">{summary.employeeName}</td>
                      <td className="px-4 py-3 text-sm">{summary.presentDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.absentDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.weeklyOffDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.leaveDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.officialLeaveDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.medicalLeaveDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalLateMinutes}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalDeductedDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalLeaveCompensation.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalMedicalLeaveDeduction.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalWorkDays}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalExtraHours.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{summary.totalExtraHoursCompensation.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{summary.netExtraHoursCompensation.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
          {editRecord && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm mt-8"
            >
              <h3 className="text-lg font-bold text-blue-600 mb-4 text-right">تعديل سجل الحضور</h3>
              <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={editRecord.employeeCode}
                    onChange={handleEditChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={editRecord.date}
                    onChange={handleEditChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    الحضور
                  </label>
                  <input
                    type="time"
                    name="checkIn"
                    value={editRecord.checkIn}
                    onChange={handleEditChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || editRecord.isAnnualLeave || editRecord.isLeaveCompensation || editRecord.isMedicalLeave}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    الانصراف
                  </label>
                  <input
                    type="time"
                    name="checkOut"
                    value={editRecord.checkOut}
                    onChange={handleEditChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading || editRecord.isAnnualLeave || editRecord.isLeaveCompensation || editRecord.isMedicalLeave}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-sm font-medium mb-2 text-right">
                    حالة الحضور
                  </label>
                  <select
                    name="status"
                    value={editRecord.status}
                    onChange={handleEditChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="isAnnualLeave"
                      checked={editRecord.isAnnualLeave}
                      onChange={handleEditChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    إجازة سنوية
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="isLeaveCompensation"
                      checked={editRecord.isLeaveCompensation}
                      onChange={handleEditChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    بدل إجازة
                  </label>
                </div>
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-600 text-sm font-medium text-right">
                    <input
                      type="checkbox"
                      name="isMedicalLeave"
                      checked={editRecord.isMedicalLeave}
                      onChange={handleEditChange}
                      className="mr-2"
                      disabled={loading}
                    />
                    إجازة مرضية
                  </label>
                </div>
                <div className="md:col-span-3 flex justify-end gap-3">
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-sm ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    حفظ
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => setEditRecord(null)}
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
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UploadAttendance;
