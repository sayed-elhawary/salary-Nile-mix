const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  // حقول إضافية حسب الحاجة
  department: { type: String },
  shiftType: { type: String, enum: ['administrative', 'dayStation', 'nightStation', '24/24'] },
  workingDays: { type: String, enum: ['5', '6'] },
});

module.exports = mongoose.model('Employee', employeeSchema);
