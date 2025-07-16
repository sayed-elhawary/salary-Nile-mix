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
  const [shiftType, setShiftType] = useState('all');
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
  const [showEditModal, setShowEditModal] = useState(false);

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
    const params = {
      employeeCode,
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
      setRecords(response.data.records);
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
    const params = { startDate, endDate };

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRecords(response.data.records);
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
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setEditRecord(null);
        setShowEditModal(false);
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
      await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/official_leave`, officialLeaveData, {
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
      await axios.post(`${process.env.REACT_APP_API_URL}/api/attendance/annual_leave`, annualLeaveData, {
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

  if (!user || user.role !== 'admin') {
    navigate('/login');
    return null;
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl font-tajawal bg-gray-100 min-h-screen">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
          .font-tajawal { font-family: 'Tajawal', sans-serif; }
          .table-header { background: linear-gradient(to right, #e0f2fe, #bae6fd); }
          .table-row:hover { background-color: #f0f9ff; }
          .modal-overlay { background: rgba(0, 0, 0, 0.5); }
          .modal-content { background: #ffffff; border-radius: 1rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); }
          .row-present { background-color: #ffffff; }
          .row-present:hover { background-color: #f0f9ff; }
          .row-absent { background-color: #fef2f2; color: #dc2626; }
          .row-absent:hover { background-color: #fee2e2; }
          .row-weekly-off { background-color: #f0fdf4; color: #15803d; }
          .row-weekly-off:hover { background-color: #dcfce7; }
        `}
      </style>
      <AnimatePresence>
        {loading && <LoadingSpinner />}
        {showSuccess && <SuccessCheckmark onComplete={() => setShowSuccess(false)} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-blue-700 mb-6 sm:mb-8 text-right">إدارة بصمات الموظفين</h2>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-red-100 text-red-700 p-4 rounded-lg mb-6 text-right text-sm font-medium"
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
                className="w-full sm:w-1/2 px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                رفع الملف
              </motion.button>
            </div>
          </form>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                كود الموظف
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                نوع الدوام
              </label>
              <select
                value={shiftType}
                onChange={(e) => setShiftType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className={`w-full sm:w-auto bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium shadow-md flex items-center justify-center ${
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
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm mb-8"
            >
              <h3 className="text-lg font-bold text-blue-700 mb-4 text-right">تحديد إجازة رسمية</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={officialLeaveData.employeeCode}
                    onChange={handleOfficialLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={officialLeaveData.applyToAll}
                      onChange={handleOfficialLeaveChange}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
                      disabled={loading}
                    />
                    تطبيق للجميع
                  </label>
                </div>
                <div className="md:col-span-3 flex justify-end gap-4">
                  <motion.button
                    type="button"
                    onClick={handleOfficialLeaveSubmit}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
                    className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className="bg-blue-50 p-4 sm:p-6 rounded-xl shadow-sm mb-8"
            >
              <h3 className="text-lg font-bold text-blue-700 mb-4 text-right">تحديد إجازة سنوية</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                    كود الموظف
                  </label>
                  <input
                    type="text"
                    name="employeeCode"
                    value={annualLeaveData.employeeCode}
                    onChange={handleAnnualLeaveChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
                    disabled={loading}
                  />
                </div>
                <div className="md:col-span-3 space-y-2">
                  <label className="flex items-center text-gray-700 text-sm font-semibold text-right">
                    <input
                      type="checkbox"
                      name="applyToAll"
                      checked={annualLeaveData.applyToAll}
                      onChange={handleAnnualLeaveChange}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
                      disabled={loading}
                    />
                    إجازة مرضية
                  </label>
                </div>
                <div className="md:col-span-3 flex justify-end gap-4">
                  <motion.button
                    type="button"
                    onClick={handleAnnualLeaveSubmit}
                    disabled={loading}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
                    className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className="fixed inset-0 modal-overlay flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="modal-content p-6 sm:p-8 w-full max-w-lg"
              >
                <h3 className="text-lg font-bold text-blue-700 mb-4 text-right">تعديل سجل الحضور</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-semibold mb-2 text-right">
                      كود الموظف
                    </label>
                    <input
                      type="text"
                      value={editRecord.employeeCode}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm bg-gray-100 cursor-not-allowed"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg text-right text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-gray-50 hover:bg-blue-50"
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
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-400 border-gray-300 rounded"
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
                      className={`w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 text-sm font-medium shadow-md ${
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
                      className={`w-full sm:w-auto bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-all duration-200 text-sm font-medium shadow-md ${
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
              className="overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200"
            >
              <table className="w-full table-auto border-collapse text-right text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 font-semibold text-blue-700">كود الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">اسم الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">التاريخ</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">الانصراف</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">نوع الدوام</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام العمل</th>
                    {records.some((record) => record.shiftType !== 'administrative') && (
                      <>
                        <th className="px-4 py-3 font-semibold text-blue-700">دقائق التأخير</th>
                        <th className="px-4 py-3 font-semibold text-blue-700">بدل التأخير</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-semibold text-blue-700">الأيام المخصومة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">رصيد الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">حالة الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">بدل الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">خصم إجازة مرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">ساعات العمل</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const isFriday = new Date(record.date).getDay() === 5;
                    const workHours = (record.shiftType === 'dayStation' || record.shiftType === 'nightStation')
                      ? (record.workHours ? record.workHours.toFixed(2) : 0)
                      : '-';
                    const rowClass = record.status === 'absent' ? 'row-absent' :
                                     record.status === 'weekly_off' ? 'row-weekly-off' :
                                     'row-present';
                    return (
                      <tr key={record._id || Math.random()} className={`table-row border-b border-gray-200 ${rowClass}`}>
                        <td className="px-4 py-3">{record.employeeCode}</td>
                        <td className="px-4 py-3">{record.employeeName}</td>
                        <td className="px-4 py-3">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
                        <td className="px-4 py-3">{record.checkIn || '-'}</td>
                        <td className="px-4 py-3">{record.checkOut || '-'}</td>
                        <td className="px-4 py-3">
                          {record.shiftType === 'administrative' ? 'إداري' :
                           record.shiftType === 'dayStation' ? 'محطة نهار' :
                           record.shiftType === 'nightStation' ? 'محطة ليل' :
                           record.shiftType === '24/24' ? '24/24' : '-'}
                        </td>
                        <td className="px-4 py-3">{record.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
                        {record.shiftType !== 'administrative' && (
                          <>
                            <td className="px-4 py-3">{record.lateMinutes || 0}</td>
                            <td className="px-4 py-3">{record.monthlyLateAllowance || 0}</td>
                          </>
                        )}
                        <td className="px-4 py-3">{record.deductedDays || 0}</td>
                        <td className="px-4 py-3">{record.annualLeaveBalance || 0}</td>
                        <td className="px-4 py-3">
                          {record.status === 'present' ? 'حضور' :
                           record.status === 'absent' ? 'غياب' :
                           record.status === 'weekly_off' ? 'إجازة أسبوعية' :
                           record.status === 'leave' ? 'إجازة' :
                           record.status === 'official_leave' ? 'إجازة رسمية' :
                           record.status === 'medical_leave' ? 'إجازة مرضية' : '-'}
                        </td>
                        <td className="px-4 py-3">{record.leaveCompensation ? record.leaveCompensation.toFixed(2) : 0}</td>
                        <td className="px-4 py-3">{record.medicalLeaveDeduction ? record.medicalLeaveDeduction.toFixed(2) : 0}</td>
                        <td className="px-4 py-3">{workHours}</td>
                        <td className="px-4 py-3">
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
              className="mt-8 overflow-x-auto bg-white rounded-xl shadow-lg border border-gray-200"
            >
              <h3 className="text-lg font-bold text-blue-700 mb-4 text-right px-4 pt-4">ملخص الحضور</h3>
              <table className="w-full table-auto border-collapse text-right text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 font-semibold text-blue-700">كود الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">اسم الموظف</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الحضور</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الغياب</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الإجازة الأسبوعية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الإجازة الرسمية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">أيام الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي الأيام المخصومة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي بدل الإجازة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي خصم الإجازة المرضية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي أيام العمل المحسوبة</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي الساعات الإضافية</th>
                    <th className="px-4 py-3 font-semibold text-blue-700">إجمالي تعويض الساعات الإضافية</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summaries).map(([employeeCode, summary]) => (
                    <tr key={employeeCode} className="table-row border-b border-gray-200">
                      <td className="px-4 py-3">{employeeCode}</td>
                      <td className="px-4 py-3">{summary.employeeName}</td>
                      <td className="px-4 py-3">{summary.presentDays || 0}</td>
                      <td className="px-4 py-3">{summary.absentDays || 0}</td>
                      <td className="px-4 py-3">{summary.weeklyOffDays || 0}</td>
                      <td className="px-4 py-3">{summary.leaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.officialLeaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.medicalLeaveDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalDeductedDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalLeaveCompensation ? summary.totalLeaveCompensation.toFixed(2) : 0}</td>
                      <td className="px-4 py-3">{summary.totalMedicalLeaveDeduction ? summary.totalMedicalLeaveDeduction.toFixed(2) : 0}</td>
                      <td className="px-4 py-3">{summary.totalWorkDays || 0}</td>
                      <td className="px-4 py-3">{summary.totalExtraHours ? summary.totalExtraHours.toFixed(2) : 0}</td>
                      <td className="px-4 py-3">{summary.totalExtraHoursCompensation ? summary.totalExtraHoursCompensation.toFixed(2) : 0}</td>
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
