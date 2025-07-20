const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

const userSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  employeeName: { type: String, required: true },
  department: { type: String, required: true },
  baseSalary: { type: Number, required: true, min: 0 },
  medicalInsurance: { type: Number, default: 0, min: 0 },
  socialInsurance: { type: Number, default: 0, min: 0 },
  mealAllowance: { type: Number, default: 500, min: 0 },
  workingDays: { type: String, enum: ['5', '6'], default: '5' },
  shiftType: {
    type: String,
    enum: ['administrative', 'dayStation', 'nightStation', '24/24'],
    default: 'administrative',
  },
  annualLeaveBalance: { type: Number, default: 21, min: 0 },
  monthlyLateAllowance: { type: Number, default: 120, min: 0 },
  violationsTotal: { type: Number, default: 0, min: 0 },
  violationsDeduction: { type: Number, default: 0, min: 0 },
  advancesTotal: { type: Number, default: 0, min: 0 },
  advancesDeduction: { type: Number, default: 0, min: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
});

// فهرسة حقل code لتحسين الأداء
userSchema.index({ code: 1 }, { unique: true });

// تشفير كلمة المرور قبل الحفظ
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    logger.info(`Encrypting password for save (code: ${this.code})`);
    this.password = await bcrypt.hash(this.password, 10);
    logger.info(`Password encrypted for code: ${this.code}`);
  }
  next();
});

// تشفير كلمة المرور عند التحديث
userSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.$set && update.$set.password && !update.$set.password.startsWith('$2a$')) {
    logger.info(`Encrypting password for update (code: ${update.$set.code || 'unknown'})`);
    update.$set.password = await bcrypt.hash(update.$set.password, 10);
    logger.info(`Password encrypted for update (code: ${update.$set.code || 'unknown'})`);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
