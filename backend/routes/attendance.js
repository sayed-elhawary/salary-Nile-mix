const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const auth = require('../middleware/auth');
const router = express.Router();

const upload = multer({ dest: 'uploads/' });
const NORMAL_WORK_HOURS = 9; // تحديد الدوام الطبيعي 9 ساعات

// POST /api/attendance/upload
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك برفع البصمات' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'لم يتم رفع أي ملف' });
  }

  const results = [];
  try {
    console.log('Starting file parsing...');
    const filePath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop().toLowerCase();

    if (fileExt === 'csv') {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          console.log('Row received:', row);
          if (row['No.'] && row['Date/Time']) {
            const dateTime = new Date(row['Date/Time']);
            if (!isNaN(dateTime)) {
              results.push({
                employeeCode: row['No.'].toString(),
                dateTime,
              });
            } else {
              console.log(`Invalid Date/Time format for row: ${JSON.stringify(row)}`);
            }
          } else {
            console.log(`Missing No. or Date/Time in row: ${JSON.stringify(row)}`);
          }
        })
        .on('end', async () => {
          await processAttendance(results, req, res);
        });
    } else if (fileExt === 'xlsx') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      console.log('XLSX rows:', rows);

      for (const row of rows) {
        if (row['No.'] && row['Date/Time']) {
          const dateTime = new Date(row['Date/Time']);
          if (!isNaN(dateTime)) {
            results.push({
              employeeCode: row['No.'].toString(),
              dateTime,
            });
          } else {
            console.log(`Invalid Date/Time format for row: ${JSON.stringify(row)}`);
          }
        } else {
          console.log(`Missing No. or Date/Time in row: ${JSON.stringify(row)}`);
        }
      }
      await processAttendance(results, req, res);
    } else {
      throw new Error('نوع الملف غير مدعوم. استخدم .csv أو .xlsx');
    }
  } catch (err) {
    console.error(`Error during upload: ${err.message}`);
    res.status(400).json({ message: `خطأ أثناء رفع البصمات: ${err.message}` });
  } finally {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error(`Error deleting file: ${err.message}`);
      }
    }
  }
});

async function processAttendance(results, req, res) {
  console.log(`Parsed ${results.length} valid entries`);
  const groupedByCode = {};

  // Group entries by employee code
  for (const entry of results) {
    const employeeCode = entry.employeeCode;
    if (!groupedByCode[employeeCode]) {
      groupedByCode[employeeCode] = [];
    }
    groupedByCode[employeeCode].push(entry);
  }

  for (const employeeCode in groupedByCode) {
    const user = await User.findOne({ code: employeeCode });
    if (!user) {
      console.log(`No user found for employeeCode: ${employeeCode}`);
      continue;
    }

    let monthlyLateAllowance = user.monthlyLateAllowance || 120;
    let annualLeaveBalance = user.annualLeaveBalance || 21;
    const entries = groupedByCode[employeeCode].sort((a, b) => a.dateTime - b.dateTime);

    const monthlySalary = user.baseSalary || 5000;
    const dailyRate = monthlySalary / 30;
    const regularHourRate = dailyRate / NORMAL_WORK_HOURS; // سعر الساعة العادية

    if (user.shiftType === '24/24') {
      // Handling for 24/24 shift
      const records = [];
      let lastCheckIn = null;
      let lastCheckInDate = null;
      let totalWorkDays = 0;

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const date = new Date(entry.dateTime);
        date.setHours(0, 0, 0, 0);
        const time = entry.dateTime.toTimeString().slice(0, 5);

        if (!lastCheckIn) {
          lastCheckIn = entry.dateTime;
          lastCheckInDate = new Date(date);
          records.push({
            employeeCode,
            date: lastCheckInDate,
            checkIn: time,
            checkOut: null,
            calculatedWorkDays: 1,
            extraHours: 0,
            extraHoursCompensation: 0,
            workHours: 0,
            fridayBonus: 0,
            status: 'present',
          });
        } else {
          const checkOutDate = new Date(date);
          const prevRecord = records[records.length - 1];
          const timeDiffHours = (entry.dateTime - lastCheckIn) / (1000 * 60 * 60);

          if (prevRecord.checkOut === null) {
            prevRecord.checkOut = time;
            let hoursWorked = timeDiffHours;
            prevRecord.workHours = hoursWorked;
            if (hoursWorked <= NORMAL_WORK_HOURS) {
              prevRecord.calculatedWorkDays = 1;
              prevRecord.extraHours = 0;
              prevRecord.extraHoursCompensation = 0;
            } else if (hoursWorked >= 24) {
              prevRecord.calculatedWorkDays = 2;
              prevRecord.extraHours = 6;
              prevRecord.extraHoursCompensation = 6 * regularHourRate;
            } else {
              prevRecord.calculatedWorkDays = 1;
              prevRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
              prevRecord.extraHoursCompensation = (hoursWorked - NORMAL_WORK_HOURS) * regularHourRate;
            }
            if (prevRecord.date.getDay() === 5) {
              prevRecord.fridayBonus = dailyRate;
            }
            totalWorkDays += prevRecord.calculatedWorkDays;
            lastCheckIn = null;
          } else {
            records.push({
              employeeCode,
              date: checkOutDate,
              checkIn: time,
              checkOut: null,
              calculatedWorkDays: 1,
              extraHours: 0,
              extraHoursCompensation: 0,
              workHours: 0,
              fridayBonus: checkOutDate.getDay() === 5 ? dailyRate : 0,
              status: 'present',
            });
            totalWorkDays += 1;
            lastCheckIn = entry.dateTime;
            lastCheckInDate = checkOutDate;
          }
        }
      }

      // Save or update records
      for (const record of records) {
        const existingRecord = await Attendance.findOne({
          employeeCode,
          date: record.date,
        });

        const status = record.checkIn || record.checkOut ? 'present' : 'absent';

        if (existingRecord) {
          console.log(`Updating record for ${employeeCode} on ${record.date.toISOString()}`);
          existingRecord.checkIn = record.checkIn || existingRecord.checkIn;
          existingRecord.checkOut = record.checkOut || existingRecord.checkOut;
          existingRecord.status = status;
          existingRecord.lateMinutes = 0; // No late minutes for 24/24 shift
          existingRecord.deductedDays = 0; // No deducted days for 24/24 shift
          existingRecord.calculatedWorkDays = record.calculatedWorkDays;
          existingRecord.extraHours = record.extraHours;
          existingRecord.extraHoursCompensation = record.extraHoursCompensation;
          existingRecord.workHours = record.workHours;
          existingRecord.fridayBonus = record.fridayBonus;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance;
          existingRecord.employeeName = user.employeeName;
          existingRecord.shiftType = user.shiftType;
          await existingRecord.save();
          console.log(`Updated record: ${JSON.stringify(existingRecord, null, 2)}`);
        } else {
          const newRecord = new Attendance({
            employeeCode,
            employeeName: user.employeeName,
            date: record.date,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes: 0, // No late minutes for 24/24 shift
            deductedDays: 0, // No deducted days for 24/24 shift
            calculatedWorkDays: record.calculatedWorkDays,
            extraHours: record.extraHours,
            extraHoursCompensation: record.extraHoursCompensation,
            workHours: record.workHours,
            fridayBonus: record.fridayBonus,
            annualLeaveBalance,
            monthlyLateAllowance,
            status,
            createdBy: req.user.id,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
          });
          await newRecord.save();
          console.log(`Created new record: ${JSON.stringify(newRecord, null, 2)}`);
        }
      }

      if (totalWorkDays > 15) {
        console.log(`Warning: Employee ${employeeCode} worked ${totalWorkDays} days, exceeding the 15-day limit.`);
      }
    } else {
      // Handling for other shift types (administrative, dayStation, nightStation)
      const groupedByDate = {};
      for (const entry of entries) {
        const date = new Date(entry.dateTime);
        date.setHours(0, 0, 0, 0);
        const dateKey = date.toISOString();
        const time = entry.dateTime.toTimeString().slice(0, 5);
        const hours = entry.dateTime.getHours();

        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push({ time, isCheckIn: hours < 12 });
      }

      console.log('Grouped entries:', JSON.stringify(groupedByDate, null, 2));

      const sortedDates = Object.keys(groupedByDate).sort();
      for (const dateKey of sortedDates) {
        const times = groupedByDate[dateKey].sort((a, b) => a.time.localeCompare(b.time));
        const date = new Date(dateKey);

        const existingRecord = await Attendance.findOne({
          employeeCode,
          date,
        });

        let checkIn = null;
        let checkOut = null;
        if (times.length === 1) {
          if (times[0].isCheckIn) {
            checkIn = times[0].time;
          } else {
            checkOut = times[0].time;
          }
        } else if (times.length > 1) {
          checkIn = times[0].time;
          checkOut = times[times.length - 1].time;
        }

        let lateMinutes = 0;
        let deductedDays = 0;

        // Apply late minutes and deducted days only for administrative shift
        if (user.shiftType === 'administrative') {
          lateMinutes = calculateLateMinutes(user, checkIn);
          if (lateMinutes > 0) {
            if (monthlyLateAllowance >= lateMinutes) {
              monthlyLateAllowance -= lateMinutes;
            } else {
              const excessLateMinutes = lateMinutes - monthlyLateAllowance;
              monthlyLateAllowance = 0;
              deductedDays = calculateDeductedDays(excessLateMinutes, checkIn);
            }
          }
        }

        let workHours = 0;
        let extraHours = 0;
        let extraHoursCompensation = 0;
        let fridayBonus = 0;
        let calculatedWorkDays = (checkIn || checkOut) ? 1 : 0;

        if (user.shiftType === 'dayStation' || user.shiftType === 'nightStation') {
          const isFriday = date.getDay() === 5;
          const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;

          if (checkIn && checkOut) {
            const checkInDate = new Date(date);
            checkInDate.setHours(parseInt(checkIn.split(':')[0]), parseInt(checkIn.split(':')[1]));
            const checkOutDate = new Date(date);
            checkOutDate.setHours(parseInt(checkOut.split(':')[0]), parseInt(checkOut.split(':')[1]));
            if (checkOutDate < checkInDate) {
              checkOutDate.setDate(checkOutDate.getDate() + 1);
            }
            workHours = (checkOutDate - checkInDate) / (1000 * 60 * 60);
            if (isFriday) {
              workHours *= 2; // مضاعفة ساعات العمل يوم الجمعة
              extraHours = workHours / 2; // المدة الفعلية قبل المضاعفة
              extraHoursCompensation = extraHours * extraHourRate;
              calculatedWorkDays = 2; // يوم الجمعة يُحسب كيومين
            } else if (workHours > NORMAL_WORK_HOURS) {
              extraHours = workHours - NORMAL_WORK_HOURS;
              extraHoursCompensation = extraHours * extraHourRate;
            }
          }
          if (checkIn && isFriday) {
            fridayBonus = dailyRate;
          }
        }

        const status = (checkIn || checkOut) ? 'present' : calculateStatus(date, user.workingDays);

        if (existingRecord) {
          console.log(`Updating record for ${employeeCode} on ${dateKey}`);
          existingRecord.checkIn = checkIn || existingRecord.checkIn;
          existingRecord.checkOut = checkOut || existingRecord.checkOut;
          existingRecord.status = status;
          existingRecord.lateMinutes = lateMinutes;
          existingRecord.deductedDays = deductedDays;
          existingRecord.calculatedWorkDays = calculatedWorkDays;
          existingRecord.extraHours = extraHours;
          existingRecord.extraHoursCompensation = extraHoursCompensation;
          existingRecord.workHours = workHours;
          existingRecord.fridayBonus = fridayBonus;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance;
          existingRecord.employeeName = user.employeeName;
          existingRecord.shiftType = user.shiftType;
          await existingRecord.save();
          console.log(`Updated record: ${JSON.stringify(existingRecord, null, 2)}`);
        } else {
          const newRecord = new Attendance({
            employeeCode,
            employeeName: user.employeeName,
            date,
            checkIn,
            checkOut,
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes,
            deductedDays,
            calculatedWorkDays,
            extraHours,
            extraHoursCompensation,
            workHours,
            fridayBonus,
            annualLeaveBalance,
            monthlyLateAllowance,
            status,
            createdBy: req.user.id,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
          });
          await newRecord.save();
          console.log(`Created new record: ${JSON.stringify(newRecord, null, 2)}`);
        }
      }
    }

    await User.updateOne({ code: employeeCode }, { $set: { monthlyLateAllowance, annualLeaveBalance } });
  }
  res.status(201).json({ message: 'تم رفع البصمات بنجاح' });
}

// GET /api/attendance
// GET /api/attendance
router.get('/', auth, async (req, res) => {
  const { employeeCode, startDate, endDate, filterPresent, filterAbsent, filterSingleCheckIn, shiftType } = req.query;
  const query = {};

  if (employeeCode) query.employeeCode = employeeCode;
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (shiftType && shiftType !== 'all') {
    query.shiftType = shiftType;
  }
  if (filterPresent === 'true') {
    query.status = 'present';
  } else if (filterAbsent === 'true') {
    query.status = 'absent';
  } else if (filterSingleCheckIn === 'true') {
    query.$or = [
      { checkIn: { $exists: true, $ne: null }, checkOut: { $exists: false } },
      { checkIn: { $exists: false }, checkOut: { $exists: true, $ne: null } },
    ];
  }

  try {
    let records = await Attendance.find(query).sort({ date: 1 });
    console.log(`Found ${records.length} records for query: ${JSON.stringify(query)}`);
    const users = employeeCode ? await User.find({ code: employeeCode }) : await User.find();
    const result = [];

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      let lastMonthlyLateAllowance = {};
      let lastAnnualLeaveBalance = {};
      for (const user of users) {
        if (shiftType && shiftType !== 'all' && user.shiftType !== shiftType) continue; // Skip users not matching shiftType
        lastMonthlyLateAllowance[user.code] = user.monthlyLateAllowance || 120;
        lastAnnualLeaveBalance[user.code] = user.annualLeaveBalance || 21;
        const lastRecord = await Attendance.findOne({ employeeCode: user.code })
          .sort({ date: -1 })
          .exec();
        if (lastRecord) {
          if (lastRecord.monthlyLateAllowance !== undefined) {
            lastMonthlyLateAllowance[user.code] = lastRecord.monthlyLateAllowance;
          }
          if (lastRecord.annualLeaveBalance !== undefined) {
            lastAnnualLeaveBalance[user.code] = lastRecord.annualLeaveBalance;
          }
        }
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        for (const user of users) {
          if (shiftType && shiftType !== 'all' && user.shiftType !== shiftType) continue; // Skip users not matching shiftType
          const record = records.find(
            (r) =>
              r.employeeCode === user.code &&
              r.date.toDateString() === d.toDateString()
          );
          if (record) {
            if (
              (filterPresent === 'true' && record.status !== 'present') ||
              (filterAbsent === 'true' && record.status !== 'absent') ||
              (filterSingleCheckIn === 'true' &&
                !(
                  (record.checkIn && !record.checkOut) ||
                  (!record.checkIn && record.checkOut)
                ))
            ) {
              continue; // Skip records not matching filter criteria
            }
            lastMonthlyLateAllowance[user.code] = record.monthlyLateAllowance || lastMonthlyLateAllowance[user.code];
            lastAnnualLeaveBalance[user.code] = record.annualLeaveBalance || lastAnnualLeaveBalance[user.code];
            result.push(record);
          } else {
            const status = user.shiftType === '24/24' ? 'absent' : calculateStatus(d, user.workingDays);
            if (
              (filterPresent === 'true' && status !== 'present') ||
              (filterAbsent === 'true' && status !== 'absent') ||
              (filterSingleCheckIn === 'true')
            ) {
              continue; // Skip records not matching filter criteria
            }
            const monthlySalary = user.baseSalary || 5000;
            const dailyRate = monthlySalary / 30;
            result.push({
              _id: new mongoose.Types.ObjectId().toString(),
              employeeCode: user.code,
              employeeName: user.employeeName,
              date: new Date(d),
              checkIn: null,
              checkOut: null,
              shiftType: user.shiftType,
              workingDays: user.workingDays,
              lateMinutes: 0,
              deductedDays: 0,
              calculatedWorkDays: 0,
              extraHours: 0,
              extraHoursCompensation: 0,
              workHours: 0,
              fridayBonus: 0,
              annualLeaveBalance: lastAnnualLeaveBalance[user.code],
              monthlyLateAllowance: lastMonthlyLateAllowance[user.code],
              status,
              leaveCompensation: 0,
              medicalLeaveDeduction: 0,
            });
          }
        }
      }
    } else {
      records = records.filter(record => {
        if (filterPresent === 'true' && record.status !== 'present') return false;
        if (filterAbsent === 'true' && record.status !== 'absent') return false;
        if (
          filterSingleCheckIn === 'true' &&
          !((record.checkIn && !record.checkOut) || (!record.checkIn && record.checkOut))
        ) return false;
        if (shiftType && shiftType !== 'all' && record.shiftType !== shiftType) return false;
        return record.checkIn || record.checkOut || record.status !== 'absent' && record.status !== 'weekly_off';
      });
      result.push(...records);
    }

    const summaries = {};
    result.forEach((record) => {
      if (!summaries[record.employeeCode]) {
        const monthlySalary = record.baseSalary || 5000;
        const dailyRate = monthlySalary / 30;
        summaries[record.employeeCode] = {
          employeeName: record.employeeName,
          presentDays: 0,
          absentDays: 0,
          weeklyOffDays: 0,
          leaveDays: 0,
          officialLeaveDays: 0,
          medicalLeaveDays: 0,
          totalWorkDays: 0,
          totalExtraHours: 0,
          totalExtraHoursCompensation: 0,
          totalWorkHours: 0,
          totalFridayBonus: 0,
          totalLateMinutes: 0,
          totalDeductedDays: 0,
          totalLeaveCompensation: 0,
          totalMedicalLeaveDeduction: 0,
          totalLateDeduction: 0,
          netExtraHoursCompensation: 0,
          dailyRate,
        };
      }
      if (record.status === 'present') {
        summaries[record.employeeCode].presentDays++;
        summaries[record.employeeCode].totalWorkDays += record.calculatedWorkDays || 1;
        summaries[record.employeeCode].totalExtraHours += record.extraHours || 0;
        summaries[record.employeeCode].totalExtraHoursCompensation += record.extraHoursCompensation || 0;
        summaries[record.employeeCode].totalWorkHours += record.workHours || 0;
        summaries[record.employeeCode].totalFridayBonus += record.fridayBonus || 0;
      } else if (record.status === 'absent') summaries[record.employeeCode].absentDays++;
      else if (record.status === 'weekly_off') summaries[record.employeeCode].weeklyOffDays++;
      else if (record.status === 'leave') summaries[record.employeeCode].leaveDays++;
      else if (record.status === 'official_leave') summaries[record.employeeCode].officialLeaveDays++;
      else if (record.status === 'medical_leave') summaries[record.employeeCode].medicalLeaveDays++;
      summaries[record.employeeCode].totalLateMinutes += record.lateMinutes || 0;
      summaries[record.employeeCode].totalDeductedDays += record.deductedDays || 0;
      summaries[record.employeeCode].totalLeaveCompensation += record.leaveCompensation || 0;
      summaries[record.employeeCode].totalMedicalLeaveDeduction += record.medicalLeaveDeduction || 0;
      summaries[record.employeeCode].totalLateDeduction += (record.deductedDays || 0) * summaries[record.employeeCode].dailyRate;
    });

    for (const employeeCode in summaries) {
      const user = await User.findOne({ code: employeeCode });
      summaries[employeeCode].netExtraHoursCompensation =
        summaries[employeeCode].totalExtraHoursCompensation - summaries[employeeCode].totalLateDeduction; // Fixed line
      if (user && user.shiftType === '24/24' && summaries[employeeCode].totalWorkDays > 15) {
        summaries[employeeCode].warning = `Employee worked ${summaries[employeeCode].totalWorkDays} days, exceeding the 15-day limit.`;
      }
    }

    res.json({ records: result, summaries });
  } catch (err) {
    console.error(`Error fetching records: ${err.message}`);
    res.status(500).json({ message: `خطأ في جلب السجلات: ${err.message}` });
  }
});
// PUT /api/attendance/:id
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتعديل البصمات' });
  }

  try {
    const { checkIn, checkOut, status, isAnnualLeave, isLeaveCompensation, isMedicalLeave } = req.body;
    console.log('PUT request body:', req.body);
    console.log('PUT request params:', req.params);

    let record = await Attendance.findById(req.params.id);
    let isNewRecord = false;

    if (!record) {
      const user = await User.findOne({ code: req.body.employeeCode });
      if (!user) {
        return res.status(404).json({ message: 'المستخدم غير موجود' });
      }
      record = new Attendance({
        _id: req.params.id,
        employeeCode: req.body.employeeCode,
        employeeName: user.employeeName,
        date: new Date(req.body.date),
        shiftType: user.shiftType,
        workingDays: user.workingDays,
        createdBy: req.user.id,
      });
      isNewRecord = true;
    }

    const user = await User.findOne({ code: record.employeeCode });
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    const monthlySalary = user.baseSalary || 5000;
    const dailyRate = monthlySalary / 30;
    const regularHourRate = dailyRate / NORMAL_WORK_HOURS;

    const previousRecord = await Attendance.findOne({
      employeeCode: record.employeeCode,
      date: { $lt: record.date },
    }).sort({ date: -1 });

    let monthlyLateAllowance = previousRecord
      ? previousRecord.monthlyLateAllowance
      : user.monthlyLateAllowance || 120;
    let annualLeaveBalance = previousRecord
      ? previousRecord.annualLeaveBalance
      : user.annualLeaveBalance || 21;
    let leaveCompensation = 0;
    let medicalLeaveDeduction = 0;
    let workHours = 0;
    let extraHours = 0;
    let extraHoursCompensation = 0;
    let fridayBonus = 0;
    let calculatedWorkDays = (checkIn || checkOut) ? 1 : 0;

    record.checkIn = checkIn || null;
    record.checkOut = checkOut || null;
    record.status = status || record.status || 'absent';

    if (isAnnualLeave) {
      record.status = 'leave';
      record.checkIn = null;
      record.checkOut = null;
      record.lateMinutes = 0;
      record.deductedDays = 0;
      record.calculatedWorkDays = 0;
      record.extraHours = 0;
      record.extraHoursCompensation = 0;
      record.workHours = 0;
      record.fridayBonus = 0;
      record.leaveCompensation = 0;
      record.medicalLeaveDeduction = 0;
      if (annualLeaveBalance >= 1) {
        annualLeaveBalance -= 1;
      } else {
        return res.status(400).json({ message: 'رصيد الإجازة السنوية غير كافٍ' });
      }
    } else if (isLeaveCompensation) {
      record.status = 'leave';
      record.checkIn = null;
      record.checkOut = null;
      record.lateMinutes = 0;
      record.deductedDays = 0;
      record.calculatedWorkDays = 0;
      record.extraHours = 0;
      record.extraHoursCompensation = 0;
      record.workHours = 0;
      record.fridayBonus = 0;
      record.medicalLeaveDeduction = 0;
      if (annualLeaveBalance >= 2) {
        annualLeaveBalance -= 2;
        leaveCompensation = dailyRate * 2;
        record.leaveCompensation = leaveCompensation;
      } else {
        return res.status(400).json({ message: 'رصيد الإجازة السنوية غير كافٍ لبدل الإجازة' });
      }
    } else if (isMedicalLeave) {
      record.status = 'medical_leave';
      record.checkIn = null;
      record.checkOut = null;
      record.lateMinutes = 0;
      record.deductedDays = 0;
      record.calculatedWorkDays = 0;
      record.extraHours = 0;
      record.extraHoursCompensation = 0;
      record.workHours = 0;
      record.fridayBonus = 0;
      record.leaveCompensation = 0;
      medicalLeaveDeduction = dailyRate * 0.25;
      record.medicalLeaveDeduction = medicalLeaveDeduction;
      if (annualLeaveBalance >= 1) {
        annualLeaveBalance -= 1;
      } else {
        return res.status(400).json({ message: 'رصيد الإجازة السنوية غير كافٍ' });
      }
    } else {
      // Apply late minutes and deducted days only for administrative shift
      record.lateMinutes = user.shiftType === 'administrative' ? calculateLateMinutes(user, record.checkIn) : 0;
      if (record.lateMinutes > 0) {
        if (monthlyLateAllowance >= record.lateMinutes) {
          monthlyLateAllowance -= record.lateMinutes;
          record.deductedDays = 0;
        } else {
          const excessLateMinutes = record.lateMinutes - monthlyLateAllowance;
          monthlyLateAllowance = 0;
          record.deductedDays = calculateDeductedDays(excessLateMinutes, record.checkIn);
        }
      } else {
        record.deductedDays = 0;
      }
      if (user.shiftType === '24/24' && record.checkIn && record.checkOut) {
        const checkInDate = new Date(record.date);
        checkInDate.setHours(parseInt(record.checkIn.split(':')[0]), parseInt(record.checkIn.split(':')[1]));
        const checkOutDate = new Date(record.date);
        checkOutDate.setHours(parseInt(record.checkOut.split(':')[0]), parseInt(record.checkOut.split(':')[1]));
        if (checkOutDate < checkInDate) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
        const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
        workHours = hoursWorked;
        if (hoursWorked <= NORMAL_WORK_HOURS) {
          record.calculatedWorkDays = 1;
          record.extraHours = 0;
          record.extraHoursCompensation = 0;
        } else if (hoursWorked >= 24) {
          record.calculatedWorkDays = 2;
          record.extraHours = 6;
          record.extraHoursCompensation = 6 * regularHourRate;
        } else {
          record.calculatedWorkDays = 1;
          record.extraHours = hoursWorked - NORMAL_WORK_HOURS;
          record.extraHoursCompensation = (hoursWorked - NORMAL_WORK_HOURS) * regularHourRate;
        }
        if (record.date.getDay() === 5) {
          fridayBonus = dailyRate;
        }
      } else if ((user.shiftType === 'dayStation' || user.shiftType === 'nightStation') && record.checkIn && record.checkOut) {
        const isFriday = record.date.getDay() === 5;
        const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;
        const checkInDate = new Date(record.date);
        checkInDate.setHours(parseInt(record.checkIn.split(':')[0]), parseInt(record.checkIn.split(':')[1]));
        const checkOutDate = new Date(record.date);
        checkOutDate.setHours(parseInt(record.checkOut.split(':')[0]), parseInt(record.checkOut.split(':')[1]));
        if (checkOutDate < checkInDate) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
        workHours = (checkOutDate - checkInDate) / (1000 * 60 * 60);
        if (isFriday) {
          workHours *= 2;
          extraHours = workHours / 2;
          extraHoursCompensation = extraHours * extraHourRate;
          calculatedWorkDays = 2;
        } else if (workHours > NORMAL_WORK_HOURS) {
          extraHours = workHours - NORMAL_WORK_HOURS;
          extraHoursCompensation = extraHours * extraHourRate;
          calculatedWorkDays = 1;
        } else {
          extraHours = 0;
          extraHoursCompensation = 0;
          calculatedWorkDays = 1;
        }
        if (isFriday && record.checkIn) {
          fridayBonus = dailyRate;
        }
      } else {
        calculatedWorkDays = (record.checkIn || record.checkOut) ? 1 : 0;
        extraHours = 0;
        extraHoursCompensation = 0;
        workHours = 0;
        if (record.date.getDay() === 5 && record.checkIn) {
          fridayBonus = dailyRate;
        }
      }
      record.fridayBonus = fridayBonus;
      record.workHours = workHours;
      record.extraHours = extraHours;
      record.extraHoursCompensation = extraHoursCompensation;
      record.calculatedWorkDays = calculatedWorkDays;
      record.leaveCompensation = 0;
      record.medicalLeaveDeduction = 0;
    }

    record.monthlyLateAllowance = monthlyLateAllowance;
    record.annualLeaveBalance = annualLeaveBalance;

    await record.save();

    const subsequentRecords = await Attendance.find({
      employeeCode: record.employeeCode,
      date: { $gt: record.date },
    }).sort({ date: 1 });

    let currentMonthlyAllowance = monthlyLateAllowance;
    let currentAnnualLeaveBalance = annualLeaveBalance;
    for (const subRecord of subsequentRecords) {
      if (subRecord.status === 'leave' || subRecord.status === 'official_leave' || subRecord.status === 'medical_leave') {
        continue;
      }
      subRecord.lateMinutes = user.shiftType === 'administrative' ? calculateLateMinutes(user, subRecord.checkIn) : 0;
      if (subRecord.lateMinutes > 0) {
        if (currentMonthlyAllowance >= subRecord.lateMinutes) {
          currentMonthlyAllowance -= subRecord.lateMinutes;
          subRecord.deductedDays = 0;
        } else {
          const excessLateMinutes = subRecord.lateMinutes - currentMonthlyAllowance;
          currentMonthlyAllowance = 0;
          subRecord.deductedDays = calculateDeductedDays(excessLateMinutes, subRecord.checkIn);
        }
      } else {
        subRecord.deductedDays = 0;
      }
      if (user.shiftType === '24/24' && subRecord.checkIn && subRecord.checkOut) {
        const checkInDate = new Date(subRecord.date);
        checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
        const checkOutDate = new Date(subRecord.date);
        checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
        if (checkOutDate < checkInDate) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
        const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
        subRecord.workHours = hoursWorked;
        if (hoursWorked <= NORMAL_WORK_HOURS) {
          subRecord.calculatedWorkDays = 1;
          subRecord.extraHours = 0;
          subRecord.extraHoursCompensation = 0;
        } else if (hoursWorked >= 24) {
          subRecord.calculatedWorkDays = 2;
          subRecord.extraHours = 6;
          subRecord.extraHoursCompensation = 6 * regularHourRate;
        } else {
          subRecord.calculatedWorkDays = 1;
          subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
          subRecord.extraHoursCompensation = (hoursWorked - NORMAL_WORK_HOURS) * regularHourRate;
        }
        if (subRecord.date.getDay() === 5) {
          subRecord.fridayBonus = dailyRate;
        }
      } else if ((user.shiftType === 'dayStation' || user.shiftType === 'nightStation') && subRecord.checkIn && subRecord.checkOut) {
        const isFriday = subRecord.date.getDay() === 5;
        const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;
        const checkInDate = new Date(subRecord.date);
        checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
        const checkOutDate = new Date(subRecord.date);
        checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
        if (checkOutDate < checkInDate) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
        }
        let hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
        if (isFriday) {
          hoursWorked *= 2;
          subRecord.workHours = hoursWorked;
          subRecord.extraHours = hoursWorked / 2;
          subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
          subRecord.calculatedWorkDays = 2;
        } else if (hoursWorked > NORMAL_WORK_HOURS) {
          subRecord.workHours = hoursWorked;
          subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
          subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
          subRecord.calculatedWorkDays = 1;
        } else {
          subRecord.workHours = hoursWorked;
          subRecord.extraHours = 0;
          subRecord.extraHoursCompensation = 0;
          subRecord.calculatedWorkDays = 1;
        }
        if (isFriday && subRecord.checkIn) {
          subRecord.fridayBonus = dailyRate;
        }
      } else {
        subRecord.calculatedWorkDays = (subRecord.checkIn || subRecord.checkOut) ? 1 : 0;
        subRecord.extraHours = 0;
        subRecord.extraHoursCompensation = 0;
        subRecord.workHours = 0;
        if (subRecord.date.getDay() === 5 && subRecord.checkIn) {
          subRecord.fridayBonus = dailyRate;
        }
      }
      subRecord.monthlyLateAllowance = currentMonthlyAllowance;
      subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
      subRecord.employeeName = user.employeeName;
      await subRecord.save();
    }

    await User.updateOne(
      { code: record.employeeCode },
      { $set: { monthlyLateAllowance: currentMonthlyAllowance, annualLeaveBalance: currentAnnualLeaveBalance } }
    );

    console.log(`Updated record: ${JSON.stringify(record, null, 2)}`);
    res.json({ message: 'تم تعديل السجل بنجاح', record });
  } catch (err) {
    console.error(`Error updating record: ${err.message}`);
    res.status(400).json({ message: `خطأ أثناء التعديل: ${err.message}` });
  }
});

// POST /api/attendance/official_leave
router.post('/official_leave', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتحديد إجازة رسمية' });
  }

  const { employeeCode, startDate, endDate, applyToAll } = req.body;
  if (!startDate || !endDate || (!employeeCode && !applyToAll)) {
    return res.status(400).json({ message: 'يرجى تقديم كود الموظف أو تحديد تطبيق للجميع مع نطاق التواريخ' });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const users = applyToAll ? await User.find() : await User.find({ code: employeeCode });
    if (users.length === 0) {
      return res.status(404).json({ message: 'لم يتم العثور على موظفين' });
    }

    for (const user of users) {
      let monthlyLateAllowance = user.monthlyLateAllowance || 120;
      let annualLeaveBalance = user.annualLeaveBalance || 21;

      const previousRecord = await Attendance.findOne({
        employeeCode: user.code,
        date: { $lt: start },
      }).sort({ date: -1 });

      if (previousRecord) {
        monthlyLateAllowance = previousRecord.monthlyLateAllowance || monthlyLateAllowance;
        annualLeaveBalance = previousRecord.annualLeaveBalance || annualLeaveBalance;
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const existingRecord = await Attendance.findOne({
          employeeCode: user.code,
          date: { $gte: d, $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) },
        });

        if (existingRecord) {
          existingRecord.status = 'official_leave';
          existingRecord.checkIn = null;
          existingRecord.checkOut = null;
          existingRecord.lateMinutes = 0;
          existingRecord.deductedDays = 0;
          existingRecord.calculatedWorkDays = 0;
          existingRecord.extraHours = 0;
          existingRecord.extraHoursCompensation = 0;
          existingRecord.workHours = 0;
          existingRecord.fridayBonus = 0;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance;
          existingRecord.employeeName = user.employeeName;
          existingRecord.shiftType = user.shiftType;
          await existingRecord.save();
          console.log(`Updated official leave for ${user.code} on ${d.toISOString()}`);
        } else {
          const newRecord = new Attendance({
            employeeCode: user.code,
            employeeName: user.employeeName,
            date: d,
            status: 'official_leave',
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes: 0,
            deductedDays: 0,
            calculatedWorkDays: 0,
            extraHours: 0,
            extraHoursCompensation: 0,
            workHours: 0,
            fridayBonus: 0,
            annualLeaveBalance,
            monthlyLateAllowance,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
            createdBy: req.user.id,
          });
          await newRecord.save();
          console.log(`Created official leave for ${user.code} on ${d.toISOString()}`);
        }
      }

      const subsequentRecords = await Attendance.find({
        employeeCode: user.code,
        date: { $gt: end },
      }).sort({ date: 1 });

      let currentMonthlyAllowance = monthlyLateAllowance;
      let currentAnnualLeaveBalance = annualLeaveBalance;
      const monthlySalary = user.baseSalary || 5000;
      const dailyRate = monthlySalary / 30;
      const regularHourRate = dailyRate / NORMAL_WORK_HOURS;

      for (const subRecord of subsequentRecords) {
        if (subRecord.status === 'leave' || subRecord.status === 'official_leave' || subRecord.status === 'medical_leave') {
          continue;
        }
        subRecord.lateMinutes = user.shiftType === 'administrative' ? calculateLateMinutes(user, subRecord.checkIn) : 0;
        if (subRecord.lateMinutes > 0) {
          if (currentMonthlyAllowance >= subRecord.lateMinutes) {
            currentMonthlyAllowance -= subRecord.lateMinutes;
            subRecord.deductedDays = 0;
          } else {
            const excessLateMinutes = subRecord.lateMinutes - currentMonthlyAllowance;
            currentMonthlyAllowance = 0;
            subRecord.deductedDays = calculateDeductedDays(excessLateMinutes, subRecord.checkIn);
          }
        } else {
          subRecord.deductedDays = 0;
        }
        if (user.shiftType === '24/24' && subRecord.checkIn && subRecord.checkOut) {
          const checkInDate = new Date(subRecord.date);
          checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
          const checkOutDate = new Date(subRecord.date);
          checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
          if (checkOutDate < checkInDate) {
            checkOutDate.setDate(checkOutDate.getDate() + 1);
          }
          const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
          subRecord.workHours = hoursWorked;
          if (hoursWorked <= NORMAL_WORK_HOURS) {
            subRecord.calculatedWorkDays = 1;
            subRecord.extraHours = 0;
            subRecord.extraHoursCompensation = 0;
          } else if (hoursWorked >= 24) {
            subRecord.calculatedWorkDays = 2;
            subRecord.extraHours = 6;
            subRecord.extraHoursCompensation = 6 * regularHourRate;
          } else {
            subRecord.calculatedWorkDays = 1;
            subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
            subRecord.extraHoursCompensation = (hoursWorked - NORMAL_WORK_HOURS) * regularHourRate;
          }
          if (subRecord.date.getDay() === 5) {
            subRecord.fridayBonus = dailyRate;
          }
        } else if ((user.shiftType === 'dayStation' || user.shiftType === 'nightStation') && subRecord.checkIn && subRecord.checkOut) {
          const isFriday = subRecord.date.getDay() === 5;
          const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;
          const checkInDate = new Date(subRecord.date);
          checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
          const checkOutDate = new Date(subRecord.date);
          checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
          if (checkOutDate < checkInDate) {
            checkOutDate.setDate(checkOutDate.getDate() + 1);
          }
          let hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
          if (isFriday) {
            hoursWorked *= 2;
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = hoursWorked / 2;
            subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
            subRecord.calculatedWorkDays = 2;
          } else if (hoursWorked > NORMAL_WORK_HOURS) {
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
            subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
            subRecord.calculatedWorkDays = 1;
          } else {
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = 0;
            subRecord.extraHoursCompensation = 0;
            subRecord.calculatedWorkDays = 1;
          }
          if (isFriday && subRecord.checkIn) {
            subRecord.fridayBonus = dailyRate;
          }
        } else {
          subRecord.calculatedWorkDays = (subRecord.checkIn || subRecord.checkOut) ? 1 : 0;
          subRecord.extraHours = 0;
          subRecord.extraHoursCompensation = 0;
          subRecord.workHours = 0;
          if (subRecord.date.getDay() === 5 && subRecord.checkIn) {
            subRecord.fridayBonus = dailyRate;
          }
        }
        subRecord.monthlyLateAllowance = currentMonthlyAllowance;
        subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
        subRecord.employeeName = user.employeeName;
        await subRecord.save();
      }

      await User.updateOne(
        { code: user.code },
        { $set: { monthlyLateAllowance: currentMonthlyAllowance, annualLeaveBalance: currentAnnualLeaveBalance } }
      );
    }

    res.json({ message: 'تم تحديد الإجازة الرسمية بنجاح' });
  } catch (err) {
    console.error(`Error setting official leave: ${err.message}`);
    res.status(400).json({ message: `خطأ أثناء تحديد الإجازة الرسمية: ${err.message}` });
  }
});

// POST /api/attendance/annual_leave
router.post('/annual_leave', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتحديد إجازة سنوية' });
  }

  const { employeeCode, startDate, endDate, applyToAll, isMedicalLeave } = req.body;
  if (!startDate || !endDate || (!employeeCode && !applyToAll)) {
    return res.status(400).json({ message: 'يرجى تقديم كود الموظف أو تحديد تطبيق للجميع مع نطاق التواريخ' });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const users = applyToAll ? await User.find() : await User.find({ code: employeeCode });
    if (users.length === 0) {
      return res.status(404).json({ message: 'لم يتم العثور على موظفين' });
    }

    for (const user of users) {
      let monthlyLateAllowance = user.monthlyLateAllowance || 120;
      let annualLeaveBalance = user.annualLeaveBalance || 21;

      const previousRecord = await Attendance.findOne({
        employeeCode: user.code,
        date: { $lt: start },
      }).sort({ date: -1 });

      if (previousRecord) {
        monthlyLateAllowance = previousRecord.monthlyLateAllowance || monthlyLateAllowance;
        annualLeaveBalance = previousRecord.annualLeaveBalance || annualLeaveBalance;
      }

      const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (isMedicalLeave) {
        if (annualLeaveBalance < daysCount) {
          return res.status(400).json({ message: `رصيد الإجازة السنوية غير كافٍ للموظف ${user.code}` });
        }
      } else {
        if (annualLeaveBalance < daysCount) {
          return res.status(400).json({ message: `رصيد الإجازة السنوية غير كافٍ للموظف ${user.code}` });
        }
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const existingRecord = await Attendance.findOne({
          employeeCode: user.code,
          date: { $gte: d, $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) },
        });

        let status = isMedicalLeave ? 'medical_leave' : 'leave';
        let medicalLeaveDeduction = 0;
        if (isMedicalLeave) {
          const dailySalary = user.baseSalary / 30;
          medicalLeaveDeduction = dailySalary * 0.25;
        }

        if (existingRecord) {
          existingRecord.status = status;
          existingRecord.checkIn = null;
          existingRecord.checkOut = null;
          existingRecord.lateMinutes = 0;
          existingRecord.deductedDays = 0;
          existingRecord.calculatedWorkDays = 0;
          existingRecord.extraHours = 0;
          existingRecord.extraHoursCompensation = 0;
          existingRecord.workHours = 0;
          existingRecord.fridayBonus = 0;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance - 1;
          existingRecord.employeeName = user.employeeName;
          existingRecord.leaveCompensation = 0;
          existingRecord.medicalLeaveDeduction = medicalLeaveDeduction;
          existingRecord.shiftType = user.shiftType;
          await existingRecord.save();
          console.log(`Updated ${status} for ${user.code} on ${d.toISOString()}`);
        } else {
          const newRecord = new Attendance({
            employeeCode: user.code,
            employeeName: user.employeeName,
            date: d,
            status,
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes: 0,
            deductedDays: 0,
            calculatedWorkDays: 0,
            extraHours: 0,
            extraHoursCompensation: 0,
            workHours: 0,
            fridayBonus: 0,
            annualLeaveBalance: annualLeaveBalance - 1,
            monthlyLateAllowance,
            leaveCompensation: 0,
            medicalLeaveDeduction,
            createdBy: req.user.id,
          });
          await newRecord.save();
          console.log(`Created ${status} for ${user.code} on ${d.toISOString()}`);
        }
        annualLeaveBalance -= 1;
      }

      const subsequentRecords = await Attendance.find({
        employeeCode: user.code,
        date: { $gt: end },
      }).sort({ date: 1 });

      let currentMonthlyAllowance = monthlyLateAllowance;
      let currentAnnualLeaveBalance = annualLeaveBalance;
      const monthlySalary = user.baseSalary || 5000;
      const dailyRate = monthlySalary / 30;
      const regularHourRate = dailyRate / NORMAL_WORK_HOURS;

      for (const subRecord of subsequentRecords) {
        if (subRecord.status === 'leave' || subRecord.status === 'official_leave' || subRecord.status === 'medical_leave') {
          continue;
        }
        subRecord.lateMinutes = user.shiftType === 'administrative' ? calculateLateMinutes(user, subRecord.checkIn) : 0;
        if (subRecord.lateMinutes > 0) {
          if (currentMonthlyAllowance >= subRecord.lateMinutes) {
            currentMonthlyAllowance -= subRecord.lateMinutes;
            subRecord.deductedDays = 0;
          } else {
            const excessLateMinutes = subRecord.lateMinutes - currentMonthlyAllowance;
            currentMonthlyAllowance = 0;
            subRecord.deductedDays = calculateDeductedDays(excessLateMinutes, subRecord.checkIn);
          }
        } else {
          subRecord.deductedDays = 0;
        }
        if (user.shiftType === '24/24' && subRecord.checkIn && subRecord.checkOut) {
          const checkInDate = new Date(subRecord.date);
          checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
          const checkOutDate = new Date(subRecord.date);
          checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
          if (checkOutDate < checkInDate) {
            checkOutDate.setDate(checkOutDate.getDate() + 1);
          }
          const hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
          subRecord.workHours = hoursWorked;
          if (hoursWorked <= NORMAL_WORK_HOURS) {
            subRecord.calculatedWorkDays = 1;
            subRecord.extraHours = 0;
            subRecord.extraHoursCompensation = 0;
          } else if (hoursWorked >= 24) {
            subRecord.calculatedWorkDays = 2;
            subRecord.extraHours = 6;
            subRecord.extraHoursCompensation = 6 * regularHourRate;
          } else {
            subRecord.calculatedWorkDays = 1;
            subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
            subRecord.extraHoursCompensation = (hoursWorked - NORMAL_WORK_HOURS) * regularHourRate;
          }
          if (subRecord.date.getDay() === 5) {
            subRecord.fridayBonus = dailyRate;
          }
        } else if ((user.shiftType === 'dayStation' || user.shiftType === 'nightStation') && subRecord.checkIn && subRecord.checkOut) {
          const isFriday = subRecord.date.getDay() === 5;
          const extraHourRate = isFriday ? regularHourRate * 2 : regularHourRate;
          const checkInDate = new Date(subRecord.date);
          checkInDate.setHours(parseInt(subRecord.checkIn.split(':')[0]), parseInt(subRecord.checkIn.split(':')[1]));
          const checkOutDate = new Date(subRecord.date);
          checkOutDate.setHours(parseInt(subRecord.checkOut.split(':')[0]), parseInt(subRecord.checkOut.split(':')[1]));
          if (checkOutDate < checkInDate) {
            checkOutDate.setDate(checkOutDate.getDate() + 1);
          }
          let hoursWorked = (checkOutDate - checkInDate) / (1000 * 60 * 60);
          if (isFriday) {
            hoursWorked *= 2;
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = hoursWorked / 2;
            subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
            subRecord.calculatedWorkDays = 2;
          } else if (hoursWorked > NORMAL_WORK_HOURS) {
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = hoursWorked - NORMAL_WORK_HOURS;
            subRecord.extraHoursCompensation = subRecord.extraHours * extraHourRate;
            subRecord.calculatedWorkDays = 1;
          } else {
            subRecord.workHours = hoursWorked;
            subRecord.extraHours = 0;
            subRecord.extraHoursCompensation = 0;
            subRecord.calculatedWorkDays = 1;
          }
          if (isFriday && subRecord.checkIn) {
            subRecord.fridayBonus = dailyRate;
          }
        } else {
          subRecord.calculatedWorkDays = (subRecord.checkIn || subRecord.checkOut) ? 1 : 0;
          subRecord.extraHours = 0;
          subRecord.extraHoursCompensation = 0;
          subRecord.workHours = 0;
          if (subRecord.date.getDay() === 5 && subRecord.checkIn) {
            subRecord.fridayBonus = dailyRate;
          }
        }
        subRecord.monthlyLateAllowance = currentMonthlyAllowance;
        subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
        subRecord.employeeName = user.employeeName;
        await subRecord.save();
      }

      await User.updateOne(
        { code: user.code },
        { $set: { monthlyLateAllowance: currentMonthlyAllowance, annualLeaveBalance: currentAnnualLeaveBalance } }
      );
    }

    res.json({ message: `تم تحديد ${isMedicalLeave ? 'الإجازة المرضية' : 'الإجازة السنوية'} بنجاح` });
  } catch (err) {
    console.error(`Error setting annual leave: ${err.message}`);
    res.status(400).json({ message: `خطأ أثناء تحديد ${isMedicalLeave ? 'الإجازة المرضية' : 'الإجازة السنوية'}: ${err.message}` });
  }
});

// DELETE /api/attendance
router.delete('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بحذف البصمات' });
  }

  try {
    await Attendance.deleteMany({});
    console.log('All attendance records deleted');
    res.json({ message: 'تم حذف جميع البصمات بنجاح' });
  } catch (err) {
    console.error(`Error deleting records: ${err.message}`);
    res.status(500).json({ message: `خطأ أثناء الحذف: ${err.message}` });
  }
});

function calculateLateMinutes(user, checkInTime) {
  // Only calculate late minutes for administrative shift
  if (!checkInTime || user.shiftType !== 'administrative') return 0;
  const [hours, minutes] = checkInTime.split(':').map(Number);
  const checkIn = new Date(0);
  checkIn.setHours(hours, minutes);

  const expectedHour = 8;
  const expectedMinute = 30;

  const expected = new Date(0);
  expected.setHours(expectedHour, expectedMinute);
  if (checkIn > expected) {
    const diffMs = checkIn - expected; 
    return Math.floor(diffMs / 1000 / 60);
  }
  return 0;
}

function calculateDeductedDays(lateMinutes, checkInTime) {
  // Only calculate deducted days for administrative shift
  if (!checkInTime || lateMinutes <= 0) return 0;
  const [hours, minutes] = checkInTime.split(':').map(Number);
  const checkIn = new Date(0);
  checkIn.setHours(hours, minutes);

  const time0916 = new Date(0);
  time0916.setHours(9, 16);
  const time1100 = new Date(0);
  time1100.setHours(11, 0);
  const time1600 = new Date(0);
  time1600.setHours(16, 0);
  const time1720 = new Date(0);
  time1720.setHours(17, 20);

  if (checkIn >= time0916 && checkIn <= time1100) {
    return 0.25;
  } else if (checkIn > time1100 && checkIn <= time1600) {
    return 0.5;
  } else if (checkIn > time1600 && checkIn <= time1720) {
    return 0.25;
  } else if (checkIn > time1720) {
    return 1;
  }
  return 0;
}

function calculateStatus(date, workingDays) {
  const day = date.getDay();
  if (workingDays === '5' && (day === 5 || day === 6)) return 'weekly_off';
  if (workingDays === '6' && day === 5) return 'weekly_off';
  return 'absent';
}

module.exports = router;
