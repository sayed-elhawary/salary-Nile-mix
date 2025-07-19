const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: Date, required: true },
  checkIn: { type: String },
  checkOut: { type: String },
  shiftType: { type: String, enum: ['administrative', 'dayStation', 'nightStation', '24/24'], default: 'administrative' },
  workingDays: { type: String, enum: ['5', '6'], default: '5' },
  lateMinutes: { type: Number, default: 0 },
  deductedDays: { type: Number, default: 0 },
  annualLeaveBalance: { type: Number, default: 21 },
  monthlyLateAllowance: { type: Number, default: 120 },
  status: { type: String, enum: ['present', 'absent', 'weekly_off', 'leave', 'official_leave', 'medical_leave'], default: 'absent' },
  leaveCompensation: { type: Number, default: 0 },
  medicalLeaveDeduction: { type: Number, default: 0 },
  extraHoursCompensation: { type: Number, default: 0 },
  workHours: { type: Number, default: 0 },
  fridayBonus: { type: Number, default: 0 },
  hoursDeduction: { type: Number, default: 0 }, // حقل جديد لخصم الساعات
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// ملاحظة: لحساب hoursDeduction تلقائيًا (مثلًا: 9 - workHours إذا كان workHours < 9 لشيفتات dayStation أو nightStation)،
// يجب تحديث دالة processAttendance في attendance.controller.js لتشمل المنطق التالي:
// if (['dayStation', 'nightStation'].includes(record.shiftType) && record.workHours < 9 && record.status === 'present') {
//   record.hoursDeduction = (9 - record.workHours).toFixed(2);
// }

module.exports = mongoose.model('Attendance', attendanceSchema);
