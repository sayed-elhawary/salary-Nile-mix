const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// إنشاء مستخدم جديد
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بإنشاء مستخدم' });
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
    } = req.body;

    // التحقق من وجود كود الموظف
    const existingUser = await User.findOne({ code });
    if (existingUser) {
      return res.status(400).json({ message: 'كود الموظف موجود بالفعل' });
    }

    // حساب الصافي
    const netSalary = (
      parseFloat(baseSalary || 0) +
      (parseFloat(baseBonus || 0) * parseFloat(bonusPercentage || 0)) / 100 +
      parseFloat(mealAllowance || 0) -
      parseFloat(medicalInsurance || 0) -
      parseFloat(socialInsurance || 0)
    ).toFixed(2);

    // إنشاء مستخدم جديد
    const user = new User({
      code,
      password, // كلمة المرور هتتشفر تلقائيًا في middleware
      employeeName,
      department,
      baseSalary: parseFloat(baseSalary),
      baseBonus: parseFloat(baseBonus || 0),
      bonusPercentage: parseFloat(bonusPercentage || 0),
      medicalInsurance: parseFloat(medicalInsurance || 0),
      socialInsurance: parseFloat(socialInsurance || 0),
      mealAllowance: parseFloat(mealAllowance || 0),
      workingDays: workingDays || '5',
      shiftType: shiftType || 'administrative',
      annualLeaveBalance: parseInt(annualLeaveBalance || 21),
      monthlyLateAllowance: parseInt(monthlyLateAllowance || 120),
      netSalary: parseFloat(netSalary),
      createdBy: req.user.id,
      role: 'user',
    });

    await user.save();
    res.status(201).json({ message: 'تم إنشاء الحساب بنجاح', user });
  } catch (err) {
    res.status(400).json({ message: `خطأ أثناء إنشاء الحساب: ${err.message}` });
  }
});

module.exports = router;
