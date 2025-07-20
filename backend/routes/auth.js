const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { code, password } = req.body;

  try {
    const trimmedCode = code ? code.trim() : '';
    const trimmedPassword = password ? password.trim().replace(/[^\w\s@#$%^&*()]/g, '') : '';

    console.log('Login attempt:', { code: trimmedCode, password: trimmedPassword });

    if (!trimmedCode || !trimmedPassword) {
      console.log('Invalid input: Empty code or password', { code, password });
      return res.status(400).json({ message: 'رمز الموظف وكلمة المرور مطلوبان' });
    }

    const user = await User.findOne({ code: trimmedCode });
    if (!user) {
      console.log('User not found:', trimmedCode);
      return res.status(400).json({ message: 'رمز الموظف غير صحيح' });
    }

    console.log('Stored hash:', user.password);
    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    console.log('Password comparison result:', isMatch);

    if (!isMatch) {
      console.log('Password mismatch for code:', trimmedCode);
      return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1h' }
    );

    res.json({
      user: {
        _id: user._id,
        code: user.code,
        employeeName: user.employeeName,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: `خطأ في الخادم: ${err.message}` });
  }
});

// نقطة نهاية لاختبار كلمة المرور
router.post('/test-password', async (req, res) => {
  const { code, password } = req.body;
  const trimmedCode = code ? code.trim() : '';
  const trimmedPassword = password ? password.trim().replace(/[^\w\s@#$%^&*()]/g, '') : '';

  try {
    const user = await User.findOne({ code: trimmedCode });
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    res.json({
      isMatch,
      storedHash: user.password,
      inputPassword: trimmedPassword,
    });
  } catch (err) {
    console.error('Test Password Error:', err);
    res.status(500).json({ message: `خطأ أثناء اختبار كلمة المرور: ${err.message}` });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    res.json({
      user: {
        _id: user._id,
        code: user.code,
        employeeName: user.employeeName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Get Me Error:', err);
    res.status(500).json({ message: `خطأ في الخادم: ${err.message}` });
  }
});

module.exports = router;
