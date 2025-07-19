const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Attendance = require('../models/Attendance');

// جلب جميع المستخدمين أو البحث بكود
router.get('/', auth, async (req, res) => {
  try {
    const { code } = req.query;
    let users;
    if (code) {
      users = await User.find({ code }).select('-password');
    } else {
      users = await User.find().select('-password');
    }
    res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'خطأ في جلب المستخدمين' });
  }
});

// تعديل مستخدم
router.patch('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتعديل المستخدم' });
  }

  try {
    const {
      code,
      password,
      employeeName,
      department,
      baseSalary,
      medicalInsurance,
      socialInsurance,
      mealAllowance,
      workingDays,
      shiftType,
      annualLeaveBalance,
      monthlyLateAllowance,
    } = req.body;

    if (code) {
      const existingUser = await User.findOne({ code, _id: { $ne: req.params.id } });
      if (existingUser) {
        return res.status(400).json({ message: 'كود الموظف موجود بالفعل' });
      }
    }

    const updateData = {
      code,
      employeeName,
      department,
      baseSalary: parseFloat(baseSalary) || 0,
      medicalInsurance: parseFloat(medicalInsurance || 0),
      socialInsurance: parseFloat(socialInsurance || 0),
      mealAllowance: parseFloat(mealAllowance || 500),
      workingDays: workingDays || '5',
      shiftType: shiftType || 'administrative',
      annualLeaveBalance: parseInt(annualLeaveBalance || 21),
      monthlyLateAllowance: parseInt(monthlyLateAllowance || 120),
      updatedBy: req.user.id,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.json({ message: 'تم تحديث الحساب بنجاح', user });
  } catch (err) {
    console.error('PATCH Error:', err);
    res.status(400).json({ message: `خطأ أثناء تحديث الحساب: ${err.message}` });
  }
});

// حذف مستخدم
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بحذف المستخدم' });
  }

  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({ message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ message: 'خطأ أثناء حذف المستخدم' });
  }
});

// تعديل جماعي
router.post('/bulk-update', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بإجراء التعديل الجماعي' });
  }

  try {
    const {
      type,
      percentage,
      monthlyLateAllowance,
      annualLeaveBalance,
      medicalInsurance,
      socialInsurance,
      shiftType,
      excludedUsers,
    } = req.body;

    let query = {};
    if (shiftType) {
      query.shiftType = shiftType;
    }
    if (excludedUsers && excludedUsers.length > 0) {
      query._id = { $nin: excludedUsers };
    }

    const users = await User.find(query);
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'لا يوجد مستخدمين للتعديل' });
    }

    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        let updateData = {};
        if (type === 'baseSalary' && percentage) {
          updateData.baseSalary = parseFloat(user.baseSalary) * (1 + percentage / 100);
        } else if (type === 'monthlyLateAllowance' && monthlyLateAllowance !== undefined) {
          updateData.monthlyLateAllowance = parseInt(monthlyLateAllowance);
        } else if (type === 'annualLeaveBalance' && annualLeaveBalance !== undefined) {
          updateData.annualLeaveBalance = parseInt(annualLeaveBalance);
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

    res.json({ message: 'تم التعديل الجماعي بنجاح', users: updatedUsers });
  } catch (err) {
    console.error('Bulk Update Error:', err);
    res.status(400).json({ message: `خطأ أثناء التعديل الجماعي: ${err.message}` });
  }
});

// تقرير الراتب
router.get('/salary-report', auth, async (req, res) => {
  try {
    const { code, startDate, endDate } = req.query;
    let userQuery = {};
    if (code) {
      userQuery.code = code;
    }

    const users = await User.find(userQuery);
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'لم يتم العثور على موظفين' });
    }

    const summaries = {};
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    for (const user of users) {
      // جلب سجلات الحضور
      const attendanceQuery = { employeeCode: user.code, date: { $gte: start, $lte: end } };
      let attendanceRecords = await Attendance.find(attendanceQuery).lean();
      console.log(`Attendance records for ${user.code}: ${attendanceRecords.length}`);

      // إنشاء سجلات افتراضية للأيام بدون بصمات
      const daysInRange = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const allDates = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(new Date(d));
      }

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
            hoursDeduction: 0, // إضافة حقل hoursDeduction الافتراضي
            fridayBonus: 0,
            annualLeaveBalance: user.annualLeaveBalance || 21,
            monthlyLateAllowance: user.monthlyLateAllowance || 120,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
            createdBy: req.user.id,
          };
          // حفظ السجل الافتراضي في قاعدة البيانات
          await new Attendance(newRecord).save();
          attendanceRecords.push(newRecord);
          console.log(`Created default record for ${user.code} on ${date.toISOString().split('T')[0]}: ${status}`);
        }
      }

      let presentDays = 0,
        absentDays = 0,
        weeklyOffDays = 0,
        leaveDays = 0,
        officialLeaveDays = 0,
        medicalLeaveDays = 0,
        totalWorkHours = 0,
        totalExtraHoursCompensation = 0,
        totalFridayBonus = 0,
        totalLeaveCompensation = 0,
        totalMedicalLeaveDeduction = 0,
        totalDeductedDaysFromAttendance = 0,
        totalHoursDeduction = 0; // إضافة متغير لحساب إجمالي خصم الساعات

      attendanceRecords.forEach((record) => {
        switch (record.status) {
          case 'present':
            presentDays++;
            break;
          case 'absent':
            absentDays++;
            break;
          case 'weekly_off':
            weeklyOffDays++;
            break;
          case 'leave':
            leaveDays++;
            break;
          case 'official_leave':
            officialLeaveDays++;
            break;
          case 'medical_leave':
            medicalLeaveDays++;
            totalMedicalLeaveDeduction += record.medicalLeaveDeduction || (parseFloat(user.baseSalary || 0) / 30) * 0.25;
            break;
        }

        totalWorkHours += parseFloat(record.workHours || 0);
        totalExtraHoursCompensation += parseFloat(record.extraHoursCompensation || 0);
        totalHoursDeduction += parseFloat(record.hoursDeduction || 0); // جمع خصم الساعات
        totalLeaveCompensation += parseFloat(record.leaveCompensation || 0);
        totalDeductedDaysFromAttendance += parseFloat(record.deductedDays || 0);

        // إضافة بدل الجمعة فقط إذا لم يكن الشيفت dayStation أو nightStation
        if (!['dayStation', 'nightStation'].includes(user.shiftType)) {
          totalFridayBonus += parseFloat(record.fridayBonus || 0);
        }
      });

      const totalWorkDays = presentDays;
      const dailySalary = parseFloat(user.baseSalary || 0) / 30;
      const hourlyRate = dailySalary / 9; // معدل الساعة بناءً على 9 ساعات عمل يوميًا
      const totalAbsentDeduction = absentDays * dailySalary;
      const totalMealAllowanceDeduction = (absentDays + leaveDays + medicalLeaveDays) * 50;
      const totalDeductions = totalDeductedDaysFromAttendance + (medicalLeaveDays * 0.25) + absentDays;
      const totalDeductionsAmount = totalDeductions * dailySalary;
      const totalHoursDeductionAmount = totalHoursDeduction * hourlyRate; // خصم الساعات بالقيمة المالية

      // ضمان ألا يكون بدل الوجبة سالبًا
      const mealAllowanceAfterDeduction = parseFloat(user.mealAllowance || 500) - totalMealAllowanceDeduction;
      const finalMealAllowance = mealAllowanceAfterDeduction >= 0 ? mealAllowanceAfterDeduction : 0;

      const netSalary =
        parseFloat(user.baseSalary || 0) +
        finalMealAllowance +
        totalLeaveCompensation +
        totalExtraHoursCompensation +
        (['dayStation', 'nightStation'].includes(user.shiftType) ? 0 : totalFridayBonus) - // إزالة totalFridayBonus لـ dayStation وnightStation
        totalDeductionsAmount -
        totalHoursDeductionAmount - // إضافة خصم الساعات
        (parseFloat(user.violationsDeduction || 0)) -
        (parseFloat(user.advancesDeduction || 0)) -
        (parseFloat(user.medicalInsurance || 0)) -
        (parseFloat(user.socialInsurance || 0));

      summaries[user._id.toString()] = {
        employeeCode: user.code,
        employeeName: user.employeeName,
        baseSalary: parseFloat(user.baseSalary || 0),
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
        totalWorkHours,
        totalExtraHoursCompensation,
        totalFridayBonus: ['dayStation', 'nightStation'].includes(user.shiftType) ? 0 : totalFridayBonus, // إزالة totalFridayBonus لـ dayStation وnightStation
        totalAbsentDeduction,
        totalMealAllowanceDeduction,
        totalHoursDeduction: parseFloat(totalHoursDeduction.toFixed(2)), // إضافة إجمالي خصم الساعات
        violationsTotal: parseFloat(user.violationsTotal || 0),
        violationsDeduction: parseFloat(user.violationsDeduction || 0),
        advancesTotal: parseFloat(user.advancesTotal || 0),
        advancesDeduction: parseFloat(user.advancesDeduction || 0),
        netSalary: parseFloat(netSalary.toFixed(2)),
      };
    }

    console.log('Salary report summaries:', JSON.stringify(summaries, null, 2));
    res.json({ summaries });
  } catch (err) {
    console.error('Error generating salary report:', err);
    res.status(500).json({ message: `خطأ أثناء إنشاء تقرير الراتب: ${err.message}` });
  }
});

// تعديل البيانات المالية
router.patch('/:id/update-finance', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتحديث البيانات المالية' });
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'لم يتم العثور على الموظف' });
    }

    const violationsDeduction = parseFloat(req.body.violationsDeduction) || user.violationsDeduction || 0;
    const advancesDeduction = parseFloat(req.body.advancesDeduction) || user.advancesDeduction || 0;
    const violationsTotal = parseFloat(req.body.violationsTotal) || user.violationsTotal || 0;
    const advancesTotal = parseFloat(req.body.advancesTotal) || user.advancesTotal || 0;

    // تحديث تلقائي
    const updatedViolationsTotal = violationsTotal >= violationsDeduction ? violationsTotal - violationsDeduction : 0;
    const updatedAdvancesTotal = advancesTotal >= advancesDeduction ? advancesTotal - advancesDeduction : 0;

    user.violationsTotal = updatedViolationsTotal;
    user.violationsDeduction = violationsDeduction;
    user.advancesTotal = updatedAdvancesTotal;
    user.advancesDeduction = advancesDeduction;

    await user.save();

    // إرجاع البيانات المحدثة
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
    console.error('Error updating financial data:', err);
    res.status(400).json({ message: `خطأ أثناء تحديث البيانات المالية: ${err.message}` });
  }
});

// دالة لحساب الحالة
function calculateStatus(date, workingDays, shiftType) {
  const daysOfWeek = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const day = daysOfWeek[date.getDay()];
  
  let workDaysArray;
  if (shiftType === '24/24') {
    workDaysArray = daysOfWeek; // جميع الأيام تعتبر أيام عمل
  } else if (shiftType === 'dayStation' || shiftType === 'nightStation') {
    // لمحطة نهار أو ليل، الجمعة إجازة أسبوعية فقط
    workDaysArray = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'السبت'];
  } else {
    // للدوام الإداري، استخدام workingDays
    workDaysArray = workingDays === '5' 
      ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس']
      : ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
  }

  const status = workDaysArray.includes(day) ? 'absent' : 'weekly_off';
  console.log(`Calculated status for ${date.toISOString().split('T')[0]}: ${status}`);
  return status;
}

module.exports = router;
