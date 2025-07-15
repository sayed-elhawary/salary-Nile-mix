const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  employeeName: { type: String, required: true },
  department: { type: String, required: true },
  baseSalary: { type: Number, required: true, min: 0 },
  baseBonus: { type: Number, default: 0, min: 0 },
  bonusPercentage: { type: Number, default: 0, min: 0, max: 100 },
  medicalInsurance: { type: Number, default: 0, min: 0 },
  socialInsurance: { type: Number, default: 0, min: 0 },
  mealAllowance: { type: Number, default: 0, min: 0 },
  workingDays: { type: String, enum: ['5', '6'], default: '5' },
  shiftType: {
    type: String,
    enum: ['administrative', 'dayStation', 'nightStation', '24/24'],
    default: 'administrative',
  },
  annualLeaveBalance: { type: Number, default: 21, min: 0 },
  monthlyLateAllowance: { type: Number, default: 120, min: 0 },
  netSalary: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
