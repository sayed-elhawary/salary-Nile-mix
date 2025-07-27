const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
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

const shiftTypeMap = {
  administrative: 'administrative',
  dayStation: 'dayStation',
  nightStation: 'nightStation',
  '24/24': '24/24',
};

// دالة مساعدة لتنظيف البيانات
const sanitizeInput = (value) => (value ? value.trim() : '');

// دالة مساعدة للتحقق من كلمة المرور
const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  }
  if (!/^[a-zA-Z0-9@#$%^&*()]+$/.test(password)) {
    return 'كلمة المرور تحتوي على أحرف غير صالحة';
  }
  return null;
};

// دالة لحساب ساعات العمل
const calculateWorkHours = (record, user, dailyRate, regularHourRate) => {
  let workHours = 0;
  let extraHours = 0;
  let extraHoursCompensation = 0;
  let hoursDeduction = 0;
  let calculatedWorkDays = (record.checkIn || record.checkOut) ? 1 : 0;
  let fridayBonus = 0;

  if (record.checkIn && record.checkOut && record.status === 'present') {
    const checkInDate = new Date(record.date);
    checkInDate.setHours(parseInt(record.checkIn.split(':')[0]), parseInt(record.checkIn.split(':')[1]));
    let checkOutDate = new Date(record.date);
    checkOutDate.setHours(parseInt(record.checkOut.split(':')[0]), parseInt(record.checkOut.split(':')[1]));

    // لشيفت 24/24، افترض دائمًا أن الانصراف في اليوم التالي
    if (user.shiftType === '24/24') {
      checkOutDate.setDate(checkOutDate.getDate() + 1);
    } else if (checkOutDate < checkInDate) {
      checkOutDate.setDate(checkOutDate.getDate() + 1);
    }

    workHours = (checkOutDate - checkInDate) / (1000 * 60 * 60);
    workHours = Math.max(0, parseFloat(workHours.toFixed(2)));

    if (user.shiftType === 'administrative') {
      // للشيفت الإداري: الساعات الإضافية بعد الساعة 17:30
      const checkOutTime = parseInt(record.checkOut.split(':')[0]) * 60 + parseInt(record.checkOut.split(':')[1]);
      const thresholdTime = 17 * 60 + 30; // 17:30
      if (checkOutTime > thresholdTime) {
        extraHours = (checkOutTime - thresholdTime) / 60;
        extraHours = parseFloat(extraHours.toFixed(2));
        const hourlyRate = (user.baseSalary / 30) / 9;
        extraHoursCompensation = extraHours * hourlyRate;
        calculatedWorkDays = 1;
        hoursDeduction = workHours < 9 ? 9 - workHours : 0;
      } else {
        extraHours = 0;
        extraHoursCompensation = 0;
        calculatedWorkDays = 1;
        hoursDeduction = workHours < 9 ? 9 - workHours : 0;
      }
    } else if (user.shiftType === '24/24') {
      if (workHours >= 9) {
        extraHours = workHours - 9;
        extraHoursCompensation = extraHours * regularHourRate;
        calculatedWorkDays = 1;
        hoursDeduction = 0;
      } else {
        extraHours = 0;
        extraHoursCompensation = 0;
        calculatedWorkDays = 1;
        hoursDeduction = 9 - workHours;
      }
    } else if (user.shiftType === 'dayStation' || user.shiftType === 'nightStation') {
      const isFriday = record.date.getDay() === 5;
      const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;
      if (isFriday) {
        workHours *= 2;
        extraHours = workHours / 2;
        extraHoursCompensation = extraHours * extraHourRate;
        calculatedWorkDays = 2;
        hoursDeduction = 0;
        if (record.checkIn) {
          fridayBonus = dailyRate;
        }
      } else if (workHours < 9) {
        hoursDeduction = 9 - workHours;
        extraHours = 0;
        extraHoursCompensation = 0;
        calculatedWorkDays = 1;
      } else if (workHours > 9) {
        extraHours = workHours - 9;
        extraHoursCompensation = extraHours * extraHourRate;
        calculatedWorkDays = 1;
        hoursDeduction = 0;
      } else {
        extraHours = 0;
        extraHoursCompensation = 0;
        calculatedWorkDays = 1;
        hoursDeduction = 0;
      }
    }
  } else if ((user.shiftType === 'dayStation' || user.shiftType === 'nightStation') && (record.checkIn || record.checkOut)) {
    workHours = 9;
    extraHours = 0;
    extraHoursCompensation = 0;
    calculatedWorkDays = 1;
    hoursDeduction = 0;
    if (record.date.getDay() === 5 && record.checkIn) {
      fridayBonus = dailyRate;
    }
  }

  logger.info(`Calculated work hours for ${record.employeeCode} on ${record.date.toISOString().split('T')[0]}: workHours=${workHours}, extraHours=${extraHours}, extraHoursCompensation=${extraHoursCompensation}, hoursDeduction=${hoursDeduction}`);
  return { workHours, extraHours, extraHoursCompensation, hoursDeduction, calculatedWorkDays, fridayBonus };
};

// جلب جميع المستخدمين أو البحث بكود
router.get('/', auth, async (req, res) => {
  try {
    const { code } = req.query;
    let users;
    if (code) {
      const trimmedCode = sanitizeInput(code);
      logger.info(`Fetching users with code: ${trimmedCode}`);
      users = await User.find({ code: trimmedCode }).select('-password').lean();
    } else {
      logger.info('Fetching all users');
      users = await User.find().select('-password').lean();
    }
    res.json({ users });
  } catch (err) {
    logger.error('Error fetching users:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// إنشاء مستخدم جديد
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized attempt to create user by user: ${req.user.id}`);
    return res.status(403).json({ message: 'غير مصرح لك بإنشاء المستخدم' });
  }

  try {
    const {
      code,
      password,
      employeeName,
      department,
      baseSalary,
      baseBonus,
      bonusPercentage,
      medicalInsurance,
      socialInsurance,
      mealAllowance,
      workingDays,
      shiftType,
      annualLeaveBalance,
      monthlyLateAllowance,
      netSalary,
      createdBy,
    } = req.body;

    const trimmedCode = sanitizeInput(code);
    const trimmedPassword = sanitizeInput(password);

    logger.info('Received data for user creation:', { code: trimmedCode, password: trimmedPassword ? '****' : '' });

    if (!trimmedCode) {
      return res.status(400).json({ message: 'كود الموظف مطلوب' });
    }

    const existingUser = await User.findOne({ code: trimmedCode });
    if (existingUser) {
      logger.warn(`Duplicate code attempted: ${trimmedCode}`);
      return res.status(400).json({ message: 'كود الموظف موجود بالفعل' });
    }

    const passwordError = validatePassword(trimmedPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const validShiftTypes = ['administrative', 'dayStation', 'nightStation', '24/24'];
    if (shiftType && !validShiftTypes.includes(shiftType)) {
      return res.status(400).json({ message: 'نوع الشيفت غير صالح' });
    }

    const user = new User({
      code: trimmedCode,
      password: trimmedPassword,
      employeeName: employeeName || '',
      department: department || '',
      baseSalary: parseFloat(baseSalary) || 0,
      baseBonus: parseFloat(baseBonus) || 0,
      bonusPercentage: parseFloat(bonusPercentage) || 0,
      medicalInsurance: parseFloat(medicalInsurance) || 0,
      socialInsurance: parseFloat(socialInsurance) || 0,
      mealAllowance: parseFloat(mealAllowance) || 500,
      workingDays: workingDays || '5',
      shiftType: shiftTypeMap[shiftType] || shiftType || 'administrative',
      annualLeaveBalance: parseInt(annualLeaveBalance) || 21,
      monthlyLateAllowance: parseInt(monthlyLateAllowance) || 120,
      netSalary: parseFloat(netSalary) || 0,
      role: 'user',
      createdBy: createdBy || req.user.id,
      updatedBy: req.user.id,
      violationsTotal: 0,
      violationsDeduction: 0,
      advancesTotal: 0,
      advancesDeduction: 0,
    });

    await user.save();
    const userResponse = user.toObject();
    delete userResponse.password;
    logger.info(`User created successfully: ${trimmedCode}`);
    res.status(201).json({ message: 'تم إنشاء المستخدم بنجاح', user: userResponse });
  } catch (err) {
    logger.error('Create User Error:', { error: err.message, stack: err.stack });
    res.status(400).json({ message: `خطأ أثناء إنشاء المستخدم: ${err.message}` });
  }
});

// تعديل مستخدم
router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized attempt to update user by user: ${req.user.id}`);
    return res.status(403).json({ message: 'غير مصرح لك بتعديل المستخدم' });
  }

  try {
    const {
      code,
      password,
      employeeName,
      department,
      baseSalary,
      baseBonus,
      bonusPercentage,
      medicalInsurance,
      socialInsurance,
      mealAllowance,
      workingDays,
      shiftType,
      annualLeaveBalance,
      monthlyLateAllowance,
      netSalary,
    } = req.body;

    const trimmedCode = sanitizeInput(code);
    const trimmedPassword = sanitizeInput(password);

    logger.info('Received PATCH data:', { id: req.params.id, code: trimmedCode, password: trimmedPassword ? '****' : '' });

    if (trimmedCode) {
      const existingUser = await User.findOne({ code: trimmedCode, _id: { $ne: req.params.id } });
      if (existingUser) {
        logger.warn(`Duplicate code attempted for update: ${trimmedCode}`);
        return res.status(400).json({ message: 'كود الموظف موجود بالفعل' });
      }
    }

    const validShiftTypes = ['administrative', 'dayStation', 'nightStation', '24/24'];
    if (shiftType && !validShiftTypes.includes(shiftType)) {
      return res.status(400).json({ message: 'نوع الشيفت غير صالح' });
    }

    const updateData = {
      code: trimmedCode,
      employeeName: employeeName || '',
      department: department || '',
      baseSalary: parseFloat(baseSalary) || 0,
      baseBonus: parseFloat(baseBonus) || 0,
      bonusPercentage: parseFloat(bonusPercentage) || 0,
      medicalInsurance: parseFloat(medicalInsurance) || 0,
      socialInsurance: parseFloat(socialInsurance) || 0,
      mealAllowance: parseFloat(mealAllowance) || 500,
      workingDays: workingDays || '5',
      shiftType: shiftTypeMap[shiftType] || shiftType || 'administrative',
      annualLeaveBalance: parseInt(annualLeaveBalance) || 21,
      monthlyLateAllowance: parseInt(monthlyLateAllowance) || 120,
      netSalary: parseFloat(netSalary) || 0,
      updatedBy: req.user.id,
    };

    if (trimmedPassword) {
      const passwordError = validatePassword(trimmedPassword);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }
      updateData.password = trimmedPassword;
      logger.info(`Password update requested for user ${req.params.id}: ****`);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      logger.warn(`User not found for update: ${req.params.id}`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    logger.info(`User updated successfully: ${user.code}`);
    res.json({ message: 'تم تحديث الحساب بنجاح', user });
  } catch (err) {
    logger.error('PATCH Error:', { error: err.message, stack: err.stack });
    res.status(400).json({ message: `خطأ أثناء تحديث الحساب: ${err.message}` });
  }
});

// حذف مستخدم
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized attempt to delete user by user: ${req.user.id}`);
    return res.status(403).json({ message: 'غير مصرح لك بحذف المستخدم' });
  }

  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      logger.warn(`User not found for deletion: ${req.params.id}`);
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    logger.info(`User deleted successfully: ${user.code}`);
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    logger.error('Delete Error:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: 'خطأ أثناء حذف المستخدم' });
  }
});

// تعديل جماعي
router.post('/bulk-update', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized attempt to bulk update by user: ${req.user.id}`);
    return res.status(403).json({ message: 'غير مصرح لك بإجراء التعديل الجماعي' });
  }

  try {
    const {
      type,
      percentage,
      monthlyLateAllowance,
      annualLeaveBalance,
      baseBonus,
      medicalInsurance,
      socialInsurance,
      shiftType,
      excludedUsers,
    } = req.body;

    logger.info('Received bulk update data:', { type, shiftType, excludedUsers });

    const validShiftTypes = ['administrative', 'dayStation', 'nightStation', '24/24'];
    if (shiftType && !validShiftTypes.includes(shiftType)) {
      return res.status(400).json({ message: 'نوع الشيفت غير صالح' });
    }

    let query = {};
    if (shiftType) {
      query.shiftType = shiftTypeMap[shiftType] || shiftType;
    }
    if (excludedUsers && excludedUsers.length > 0) {
      query._id = { $nin: excludedUsers };
    }

    const users = await User.find(query);
    if (!users || users.length === 0) {
      logger.warn('No users found for bulk update', { query });
      return res.status(404).json({ message: 'لا يوجد مستخدمين للتعديل' });
    }

    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        let updateData = {};
        if (type === 'baseSalary' && percentage) {
          updateData.baseSalary = parseFloat(user.baseSalary || 0) * (1 + parseFloat(percentage) / 100);
        } else if (type === 'monthlyLateAllowance' && monthlyLateAllowance !== undefined) {
          updateData.monthlyLateAllowance = parseInt(monthlyLateAllowance);
        } else if (type === 'annualLeaveBalance' && annualLeaveBalance !== undefined) {
          updateData.annualLeaveBalance = parseInt(annualLeaveBalance);
        } else if (type === 'baseBonus' && baseBonus !== undefined) {
          updateData.baseBonus = parseFloat(baseBonus);
        } else if (type === 'medicalInsurance' && medicalInsurance !== undefined) {
          updateData.medicalInsurance = parseFloat(medicalInsurance);
        } else if (type === 'socialInsurance' && socialInsurance !== undefined) {
          updateData.socialInsurance = parseFloat(socialInsurance);
        }

        updateData.updatedBy = req.user.id;

        return await User.findByIdAndUpdate(
          user._id,
          { $set: updateData },
          { new: true }
        ).select('-password');
      })
    );

    logger.info(`Bulk update completed for ${updatedUsers.length} users`);
    res.json({ message: 'تم التعديل الجماعي بنجاح', users: updatedUsers });
  } catch (err) {
    logger.error('Bulk Update Error:', { error: err.message, stack: err.stack });
    res.status(400).json({ message: `خطأ أثناء التعديل الجماعي: ${err.message}` });
  }
});

// تقرير الراتب
router.get('/salary-report', auth, async (req, res) => {
  try {
    const { code, startDate, endDate, shiftType } = req.query;
    logger.info('Received salary report query:', { code, startDate, endDate, shiftType });

    let userQuery = {};
    if (code) {
      userQuery.code = sanitizeInput(code);
    }
    if (shiftType && shiftType !== 'all') {
      const mappedShiftType = shiftTypeMap[sanitizeInput(shiftType)] || sanitizeInput(shiftType);
      userQuery.shiftType = mappedShiftType;
      logger.info('Mapped shiftType:', mappedShiftType);
    }

    const users = await User.find(userQuery).lean();
    if (!users || users.length === 0) {
      logger.warn('No users found for salary report', { userQuery });
      return res.status(404).json({
        message: 'لم يتم العثور على موظفين',
        details: `لا يوجد مستخدمين مطابقين للشروط: code=${code || 'غير محدد'}, shiftType=${shiftType || 'غير محدد'}`,
      });
    }

    const summaries = {};
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    for (const user of users) {
      const dailySalary = parseFloat(user.baseSalary || 0) / 30;
      const hourlyRate = dailySalary / 9;

      const attendanceQuery = {
        employeeCode: user.code,
        date: { $gte: start, $lte: end },
      };
      if (shiftType && shiftType !== 'all') {
        attendanceQuery.shiftType = shiftTypeMap[sanitizeInput(shiftType)] || sanitizeInput(shiftType);
      }
      logger.info(`Attendance query for user ${user.code}:`, attendanceQuery);

      let attendanceRecords = await Attendance.find(attendanceQuery).sort({ date: 1 }).lean();
      logger.info(`Found ${attendanceRecords.length} attendance records for user ${user.code}`);

      const daysInRange = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const allDates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
      }

      // إنشاء سجلات افتراضية للأيام المفقودة
      for (const date of allDates) {
        const existingRecord = attendanceRecords.find(
          (record) => record.date.toDateString() === date.toDateString()
        );
        if (!existingRecord) {
          const status = calculateStatus(date, user.workingDays, user.shiftType);
          const newRecord = {
            employeeCode: user.code,
            employeeName: user.employeeName,
            date: new Date(date),
            status,
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes: 0,
            deductedDays: 0,
            calculatedWorkDays: 0,
            extraHours: 0,
            extraHoursCompensation: 0,
            workHours: 0,
            hoursDeduction: 0,
            fridayBonus: 0,
            annualLeaveBalance: user.annualLeaveBalance || 21,
            monthlyLateAllowance: user.monthlyLateAllowance || 120,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
            createdBy: req.user.id,
          };
          if (!shiftType || shiftType === 'all' || newRecord.shiftType === (shiftTypeMap[sanitizeInput(shiftType)] || sanitizeInput(shiftType))) {
            await new Attendance(newRecord).save();
            attendanceRecords.push(newRecord);
            logger.info(`Created default record for ${user.code} on ${date.toISOString().split('T')[0]}: ${status}`);
          }
        }
      }

      let presentDays = 0,
        absentDays = 0,
        weeklyOffDays = 0,
        leaveDays = 0,
        officialLeaveDays = 0,
        medicalLeaveDays = 0,
        totalWorkHours = 0,
        totalExtraHours = 0,
        totalExtraHoursCompensation = 0,
        totalFridayBonus = 0,
        totalLeaveCompensation = 0,
        totalMedicalLeaveDeduction = 0,
        totalDeductedDaysFromAttendance = 0,
        totalHoursDeduction = 0;

      // إعادة ترتيب السجلات حسب التاريخ
      attendanceRecords = attendanceRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

      for (const record of attendanceRecords) {
        if (shiftType && shiftType !== 'all' && record.shiftType !== (shiftTypeMap[sanitizeInput(shiftType)] || sanitizeInput(shiftType))) {
          continue;
        }

        const { workHours, extraHours, extraHoursCompensation, hoursDeduction, calculatedWorkDays, fridayBonus } = calculateWorkHours(record, user, dailySalary, hourlyRate);

        switch (record.status) {
          case 'present':
            presentDays += calculatedWorkDays;
            totalWorkHours += workHours;
            totalExtraHours += extraHours;
            totalExtraHoursCompensation += extraHoursCompensation;
            totalHoursDeduction += hoursDeduction;
            totalFridayBonus += fridayBonus;
            break;
          case 'absent':
            absentDays++;
            break;
          case 'weekly_off':
            weeklyOffDays++;
            break;
          case 'leave':
            leaveDays++;
            totalLeaveCompensation += parseFloat(record.leaveCompensation || 0);
            break;
          case 'official_leave':
            officialLeaveDays++;
            break;
          case 'medical_leave':
            medicalLeaveDays++;
            totalMedicalLeaveDeduction += parseFloat(record.medicalLeaveDeduction || (dailySalary * 0.25));
            break;
        }

        totalDeductedDaysFromAttendance += parseFloat(record.deductedDays || 0);
      }

      if (!shiftType || shiftType === 'all' || user.shiftType === (shiftTypeMap[sanitizeInput(shiftType)] || sanitizeInput(shiftType))) {
        const totalWorkDays = presentDays;
        const totalAbsentDeduction = absentDays * dailySalary;

        // حساب خصم بدل الوجبة بناءً على الشروط الجديدة
        let totalMealAllowanceDeduction = 0;
        if (user.shiftType === '24/24') {
          // خصم 50 جنيهًا لكل يوم غياب بعد 15 يومًا
          const deductibleAbsentDays = absentDays > 15 ? absentDays - 15 : 0;
          totalMealAllowanceDeduction = Math.min(deductibleAbsentDays * 50, parseFloat(user.mealAllowance || 500));
        } else {
          // خصم 50 جنيهًا لكل يوم غياب أو إجازة سنوية
          totalMealAllowanceDeduction = Math.min((absentDays + leaveDays) * 50, parseFloat(user.mealAllowance || 500));
        }

        const totalDeductions = totalDeductedDaysFromAttendance + (medicalLeaveDays * 0.25) + absentDays;
        const totalDeductionsAmount = totalDeductions * dailySalary;
        const totalHoursDeductionAmount = totalHoursDeduction * hourlyRate;

        const mealAllowanceAfterDeduction = parseFloat(user.mealAllowance || 500) - totalMealAllowanceDeduction;
        const finalMealAllowance = mealAllowanceAfterDeduction >= 0 ? mealAllowanceAfterDeduction : 0;

        const netSalary =
          parseFloat(user.baseSalary || 0) +
          parseFloat(user.baseBonus || 0) +
          finalMealAllowance +
          totalLeaveCompensation +
          totalExtraHoursCompensation +
          totalFridayBonus -
          totalDeductionsAmount -
          totalHoursDeductionAmount -
          parseFloat(user.violationsDeduction || 0) -
          parseFloat(user.advancesDeduction || 0) -
          parseFloat(user.medicalInsurance || 0) -
          parseFloat(user.socialInsurance || 0);

        summaries[user._id.toString()] = {
          employeeCode: user.code,
          employeeName: user.employeeName,
          baseSalary: parseFloat(user.baseSalary || 0),
          baseBonus: parseFloat(user.baseBonus || 0),
          workingDays: user.workingDays,
          mealAllowance: finalMealAllowance,
          shiftType: user.shiftType,
          medicalInsurance: parseFloat(user.medicalInsurance || 0),
          socialInsurance: parseFloat(user.socialInsurance || 0),
          presentDays,
          absentDays,
          weeklyOffDays,
          leaveDays,
          officialLeaveDays,
          medicalLeaveDays,
          totalDeductions,
          totalLeaveCompensation,
          totalMedicalLeaveDeduction,
          totalWorkDays,
          totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
          totalExtraHours: parseFloat(totalExtraHours.toFixed(2)),
          totalExtraHoursCompensation: parseFloat(totalExtraHoursCompensation.toFixed(2)),
          totalFridayBonus,
          totalAbsentDeduction,
          totalMealAllowanceDeduction,
          totalHoursDeduction: parseFloat(totalHoursDeduction.toFixed(2)),
          violationsTotal: parseFloat(user.violationsTotal || 0),
          violationsDeduction: parseFloat(user.violationsDeduction || 0),
          advancesTotal: parseFloat(user.advancesTotal || 0),
          advancesDeduction: parseFloat(user.advancesDeduction || 0),
          annualLeaveBalance: parseFloat(attendanceRecords[attendanceRecords.length - 1]?.annualLeaveBalance || user.annualLeaveBalance || 21),
          monthlyLateAllowance: parseFloat(attendanceRecords[attendanceRecords.length - 1]?.monthlyLateAllowance || user.monthlyLateAllowance || 120),
          netSalary: parseFloat(netSalary.toFixed(2)),
        };
      }
    }

    logger.info('Salary report generated', { summaries: Object.keys(summaries).length });
    res.json({ summaries });
  } catch (err) {
    logger.error('Error generating salary report:', { error: err.message, stack: err.stack });
    res.status(500).json({ message: `خطأ أثناء إنشاء تقرير الراتب: ${err.message}` });
  }
});

// تعديل البيانات المالية
router.patch('/:id/update-finance', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    logger.warn(`Unauthorized attempt to update financial data by user: ${req.user.id}`);
    return res.status(403).json({ message: 'غير مصرح لك بتحديث البيانات المالية' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      logger.warn(`User not found for financial update: ${req.params.id}`);
      return res.status(404).json({ message: 'لم يتم العثور على الموظف' });
    }

    const violationsDeduction = parseFloat(req.body.violationsDeduction) || user.violationsDeduction || 0;
    const advancesDeduction = parseFloat(req.body.advancesDeduction) || user.advancesDeduction || 0;
    const violationsTotal = parseFloat(req.body.violationsTotal) || user.violationsTotal || 0;
    const advancesTotal = parseFloat(req.body.advancesTotal) || user.advancesTotal || 0;

    const updatedViolationsTotal = violationsTotal >= violationsDeduction ? violationsTotal - violationsDeduction : 0;
    const updatedAdvancesTotal = advancesTotal >= advancesDeduction ? advancesTotal - advancesDeduction : 0;

    user.violationsTotal = updatedViolationsTotal;
    user.violationsDeduction = violationsDeduction;
    user.advancesTotal = updatedAdvancesTotal;
    user.advancesDeduction = advancesDeduction;

    await user.save();
    logger.info(`Financial data updated for user: ${user.code}`);

    res.json({
      message: 'تم تحديث البيانات المالية بنجاح',
      user: {
        ...user.toObject(),
        violationsTotal: updatedViolationsTotal,
        violationsDeduction,
        advancesTotal: updatedAdvancesTotal,
        advancesDeduction,
      },
    });
  } catch (err) {
    logger.error('Error updating financial data:', { error: err.message, stack: err.stack });
    res.status(400).json({ message: `خطأ أثناء تحديث البيانات المالية: ${err.message}` });
  }
});

// دالة لحساب الحالة
function calculateStatus(date, workingDays, shiftType) {
  const daysOfWeek = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const day = daysOfWeek[date.getDay()];

  if (shiftType === '24/24' && day === 'الجمعة') {
    logger.info(`Calculated status for ${date.toISOString().split('T')[0]}: weekly_off (Friday for 24/24 shift)`);
    return 'weekly_off';
  }

  let workDaysArray;
  if (shiftType === '24/24') {
    workDaysArray = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'السبت'];
  } else if (shiftType === 'dayStation' || shiftType === 'nightStation') {
    workDaysArray = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'السبت'];
  } else {
    workDaysArray = workingDays === '5'
      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']
      : ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  }

  const status = workDaysArray.includes(day) ? 'absent' : 'weekly_off';
  logger.info(`Calculated status for ${date.toISOString().split('T')[0]}: ${status}`);
  return status;
}

module.exports = router;
