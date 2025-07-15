const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { code, password } = req.body;

  try {
    const user = await User.findOne({ code });
    if (!user) {
      return res.status(400).json({ message: 'كود الموظف غير صحيح' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ 
      user: { 
        _id: user._id, 
        code: user.code, 
        employeeName: user.employeeName, 
        role: user.role 
      }, 
      token 
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
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
        role: user.role 
      } 
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
