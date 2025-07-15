import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Attendance = () => {
  const [records, setRecords] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [employeeCode, setEmployeeCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const fetchRecords = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/attendance', {
        params: { employeeCode, startDate, endDate },
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords(response.data.records);
      setSummaries(response.data.summaries);
    } catch (err) {
      setError('خطأ في جلب السجلات');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleDeleteAll = async () => {
    if (window.confirm('هل أنت متأكد من حذف جميع البصمات؟')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete('http://localhost:5000/api/attendance', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRecords([]);
        setSummaries({});
        alert('تم حذف جميع البصمات بنجاح');
      } catch (err) {
        setError('خطأ أثناء الحذف');
      }
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">سجلات الحضور</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="كود الموظف"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          className="border p-2"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="border p-2"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="border p-2"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          بحث
        </button>
        <button
          type="button"
          onClick={handleDeleteAll}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          حذف جميع البصمات
        </button>
      </form>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-4 py-2">كود الموظف</th>
            <th className="border px-4 py-2">الاسم</th>
            <th className="border px-4 py-2">التاريخ</th>
            <th className="border px-4 py-2">الحضور</th>
            <th className="border px-4 py-2">الانصراف</th>
            <th className="border px-4 py-2">نوع الشيفت</th>
            <th className="border px-4 py-2">عدد أيام العمل</th>
            <th className="border px-4 py-2">دقائق التأخير</th>
            <th className="border px-4 py-2">الأيام المخصومة</th>
            <th className="border px-4 py-2">رصيد الإجازة</th>
            <th className="border px-4 py-2">سماح التأخير</th>
            <th className="border px-4 py-2">بدل الإجازة</th>
            <th className="border px-4 py-2">خصم الإجازة الطبية</th>
            <th className="border px-4 py-2">الحالة</th>
            <th className="border px-4 py-2">تعديل</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record._id}>
              <td className="border px-4 py-2">{record.employeeCode}</td>
              <td className="border px-4 py-2">{record.employeeName}</td>
              <td className="border px-4 py-2">{new Date(record.date).toLocaleDateString('ar-EG')}</td>
              <td className="border px-4 py-2">{record.checkIn || '-'}</td>
              <td className="border px-4 py-2">{record.checkOut || '-'}</td>
              <td className="border px-4 py-2">
                {record.shiftType === 'administrative' ? 'إداري' : 
                 record.shiftType === 'dayStation' ? 'محطة نهار' : 
                 record.shiftType === 'nightStation' ? 'محطة ليل' : '24/24'}
              </td>
              <td className="border px-4 py-2">{record.workingDays === '5' ? '5 أيام' : '6 أيام'}</td>
              <td className="border px-4 py-2">{record.lateMinutes}</td>
              <td className="border px-4 py-2">{record.deductedDays}</td>
              <td className="border px-4 py-2">{record.annualLeaveBalance}</td>
              <td className="border px-4 py-2">{record.monthlyLateAllowance}</td>
              <td className="border px-4 py-2">{record.leaveCompensation.toFixed(2)}</td>
              <td className="border px-4 py-2">{record.medicalLeaveDeduction.toFixed(2)}</td>
              <td className="border px-4 py-2">
                {record.status === 'present' ? 'حضور' : 
                 record.status === 'absent' ? 'غياب' : 
                 record.status === 'weekly_off' ? 'إجازة أسبوعية' : 'إجازة'}
              </td>
              <td className="border px-4 py-2">
                <Link to={`/edit-attendance/${record._id}`} className="text-blue-500">
                  تعديل
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-xl font-bold mt-4">الإجماليات</h3>
      {Object.entries(summaries).map(([code, summary]) => (
        <div key={code} className="mt-2">
          <p>كود الموظف: {code}</p>
          <p>الاسم: {summary.employeeName}</p>
          <p>أيام الحضور: {summary.presentDays}</p>
          <p>أيام الغياب: {summary.absentDays}</p>
          <p>أيام الإجازة الأسبوعية: {summary.weeklyOffDays}</p>
          <p>أيام الإجازة: {summary.leaveDays}</p>
          <p>إجمالي دقائق التأخير: {summary.totalLateMinutes}</p>
          <p>إجمالي الأيام المخصومة: {summary.totalDeductedDays}</p>
          <p>إجمالي بدل الإجازة: {summary.totalLeaveCompensation.toFixed(2)}</p>
          <p>إجمالي خصم الإجازة الطبية: {summary.totalMedicalLeaveDeduction.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
};

export default Attendance;
