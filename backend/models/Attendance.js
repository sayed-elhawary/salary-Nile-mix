const mongoose = require('mongoose');
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

const attendanceSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: Date, required: true },
  checkIn: { type: String },
  checkOut: { type: String },
  status: {
    type: String,
    enum: ['present', 'absent', 'weekly_off', 'leave', 'official_leave', 'medical_leave'],
    default: 'absent',
  },
  shiftType: {
    type: String,
    enum: ['administrative', 'dayStation', 'nightStation', '24/24'],
    required: true,
  },
  workingDays: { type: String, required: true },
  lateMinutes: { type: Number, default: 0 },
  deductedDays: { type: Number, default: 0 },
  calculatedWorkDays: { type: Number, default: 0 },
  extraHours: { type: Number, default: 0 },
  extraHoursCompensation: { type: Number, default: 0 },
  workHours: { type: Number, default: 0 },
  hoursDeduction: { type: Number, default: 0 },
  fridayBonus: { type: Number, default: 0 },
  annualLeaveBalance: { type: Number, default: 21 },
  monthlyLateAllowance: { type: Number, default: 120 },
  leaveCompensation: { type: Number, default: 0 },
  medicalLeaveDeduction: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalExtraHours: { type: Number, default: 0 },
}, { timestamps: true });

attendanceSchema.pre('save', async function (next) {
  try {
    const NORMAL_WORK_HOURS = 9;

    // حساب workHours وextraHours
    if (this.status === 'present' && this.checkIn && this.checkOut) {
      const checkInDate = new Date(this.date);
      checkInDate.setHours(parseInt(this.checkIn.split(':')[0]), parseInt(this.checkIn.split(':')[1]));
      let checkOutDate = new Date(this.date);
      checkOutDate.setHours(parseInt(this.checkOut.split(':')[0]), parseInt(this.checkOut.split(':')[1]));

      // لشيفت 24/24، افترض دائمًا أن الانصراف في اليوم التالي
      if (this.shiftType === '24/24') {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      } else if (checkOutDate <= checkInDate) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }

      const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
      this.workHours = parseFloat(hoursWorked.toFixed(2));

      if (['dayStation', 'nightStation'].includes(this.shiftType) && this.workHours < NORMAL_WORK_HOURS) {
        this.hoursDeduction = parseFloat((NORMAL_WORK_HOURS - this.workHours).toFixed(2));
        this.extraHours = 0;
      } else if (this.shiftType === '24/24' && this.workHours >= NORMAL_WORK_HOURS) {
        this.extraHours = parseFloat((this.workHours - NORMAL_WORK_HOURS).toFixed(2));
        this.hoursDeduction = 0;
      } else {
        this.hoursDeduction = 0;
        this.extraHours = 0;
      }

      logger.info(`Calculated for save: employeeCode=${this.employeeCode}, date=${this.date.toISOString().split('T')[0]}, workHours=${this.workHours}, extraHours=${this.extraHours}, hoursDeduction=${this.hoursDeduction}`);
    } else {
      this.workHours = 0;
      this.extraHours = 0;
      this.hoursDeduction = 0;
    }

    // تحديث totalExtraHours تراكميًا
    const startOfMonth = new Date(this.date.getFullYear(), this.date.getMonth(), 1);
    const previousRecords = await this.constructor
      .find({
        employeeCode: this.employeeCode,
        date: { $gte: startOfMonth, $lt: this.date },
      })
      .sort({ date: 1 })
      .lean();

    let cumulativeExtraHours = 0;
    for (const record of previousRecords) {
      if (record.shiftType === '24/24' && record.status === 'present') {
        cumulativeExtraHours += parseFloat(record.extraHours || 0);
      }
    }
    if (this.shiftType === '24/24' && this.status === 'present') {
      cumulativeExtraHours += parseFloat(this.extraHours || 0);
    }

    this.totalExtraHours = parseFloat(cumulativeExtraHours.toFixed(2));

    logger.info(`Updated for save: employeeCode=${this.employeeCode}, date=${this.date.toISOString().split('T')[0]}, totalExtraHours=${this.totalExtraHours}`);
    next();
  } catch (err) {
    logger.error('Error in pre-save hook:', { employeeCode: this.employeeCode, date: this.date.toISOString(), error: err.message });
    next(err);
  }
});

attendanceSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    const NORMAL_WORK_HOURS = 9;

    if (update.checkIn && update.checkOut && update.status === 'present') {
      const doc = await this.model.findOne(this.getQuery());
      const checkInDate = new Date(doc.date);
      checkInDate.setHours(parseInt(update.checkIn.split(':')[0]), parseInt(update.checkIn.split(':')[1]));
      let checkOutDate = new Date(doc.date);
      checkOutDate.setHours(parseInt(update.checkOut.split(':')[0]), parseInt(update.checkOut.split(':')[1]));

      if (doc.shiftType === '24/24') {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      } else if (checkOutDate <= checkInDate) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }

      const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
      update.workHours = parseFloat(hoursWorked.toFixed(2));

      if (['dayStation', 'nightStation'].includes(doc.shiftType) && update.workHours < NORMAL_WORK_HOURS) {
        update.hoursDeduction = parseFloat((NORMAL_WORK_HOURS - update.workHours).toFixed(2));
        update.extraHours = 0;
      } else if (doc.shiftType === '24/24' && update.workHours >= NORMAL_WORK_HOURS) {
        update.extraHours = parseFloat((update.workHours - NORMAL_WORK_HOURS).toFixed(2));
        update.hoursDeduction = 0;
      } else {
        update.hoursDeduction = 0;
        update.extraHours = 0;
      }

      logger.info(`Calculated for update: employeeCode=${doc.employeeCode}, date=${doc.date.toISOString().split('T')[0]}, workHours=${update.workHours}, extraHours=${update.extraHours}, hoursDeduction=${update.hoursDeduction}`);
    } else if (!update.checkIn || !update.checkOut) {
      update.workHours = 0;
      update.extraHours = 0;
      update.hoursDeduction = 0;
    }

    next();
  } catch (err) {
    logger.error('Error in pre-findOneAndUpdate hook:', { error: err.message });
    next(err);
  }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
