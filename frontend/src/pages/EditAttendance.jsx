import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const EditAttendance = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState({
    checkIn: '',
    checkOut: '',
    status: 'present',
    isAnnualLeave: false,
    isLeaveCompensation: false,
    isMedicalLeave: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/attendance/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRecord({
          checkIn: response.data.checkIn || '',
          checkOut: response.data.checkOut || '',
          status: response.data.status,
          isAnnualLeave: response.data.status === 'leave' && response.data.leaveCompensation === 0 && response.data.medicalLeaveDeduction === 0,
          isLeaveCompensation: response.data.status === 'leave' && response.data.leaveCompensation > 0,
          isMedicalLeave: response.data.status === 'leave' && response.data.medicalLeaveDeduction > 0,
        });
      } catch (err) {
        setError('خطأ في جلب السجل');
      }
    };
    fetchRecord();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRecord((prev) => {
      const newRecord = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'isAnnualLeave' && checked) {
        newRecord.isLeaveCompensation = false;
        newRecord.isMedicalLeave = false;
        newRecord.status = 'leave';
      } else if (name === 'isLeaveCompensation' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isMedicalLeave = false;
        newRecord.status = 'leave';
      } else if (name === 'isMedicalLeave' && checked) {
        newRecord.isAnnualLeave = false;
        newRecord.isLeaveCompensation = false;
        newRecord.status = 'leave';
      } else if (name === 'status' && value !== 'leave') {
        newRecord.isAnnualLeave = false;
        newRecord.isLeaveCompensation = false;
        newRecord.isMedicalLeave = false;
      }
      return newRecord;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/attendance/${id}`, record, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate('/attendance');
    } catch (err) {
      setError('خطأ أثناء التعديل: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">تعديل سجل الحضور</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block">وقت الحضور</label>
          <input
            type="text"
            name="checkIn"
            value={record.checkIn}
            onChange={handleChange}
            className="border p-2 w-full"
            placeholder="مثال: 09:00"
            disabled={record.isAnnualLeave || record.isLeaveCompensation || record.isMedicalLeave}
          />
        </div>
        <div>
          <label className="block">وقت الانصراف</label>
          <input
            type="text"
            name="checkOut"
            value={record.checkOut}
            onChange={handleChange}
            className="border p-2 w-full"
            placeholder="مثال: 17:00"
            disabled={record.isAnnualLeave || record.isLeaveCompensation || record.isMedicalLeave}
          />
        </div>
        <div>
          <label className="block">الحالة</label>
          <select
            name="status"
            value={record.status}
            onChange={handleChange}
            className="border p-2 w-full"
          >
            <option value="present">حضور</option>
            <option value="absent">غياب</option>
            <option value="weekly_off">إجازة أسبوعية</option>
            <option value="leave">إجازة</option>
          </select>
        </div>
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="isAnnualLeave"
              checked={record.isAnnualLeave}
              onChange={handleChange}
              className="mr-2"
            />
            إجازة سنوية
          </label>
        </div>
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="isLeaveCompensation"
              checked={record.isLeaveCompensation}
              onChange={handleChange}
              className="mr-2"
            />
            بدل إجازة
          </label>
        </div>
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="isMedicalLeave"
              checked={record.isMedicalLeave}
              onChange={handleChange}
              className="mr-2"
            />
            إجازة طبية
          </label>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          حفظ التعديلات
        </button>
      </form>
    </div>
  );
};

export default EditAttendance;
