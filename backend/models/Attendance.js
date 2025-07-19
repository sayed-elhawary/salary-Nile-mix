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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Attendance', attendanceSchema);
