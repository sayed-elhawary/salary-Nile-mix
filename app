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
  const groupedByDate = {};
  for (const entry of results) {
    const user = await User.findOne({ code: entry.employeeCode });
    if (!user) {
      console.log(`No user found for employeeCode: ${entry.employeeCode}`);
      continue;
    }

    const date = new Date(entry.dateTime);
    date.setHours(0, 0, 0, 0);
    const dateKey = date.toISOString();
    const time = entry.dateTime.toTimeString().slice(0, 5);
    const hours = entry.dateTime.getHours();

    if (!groupedByDate[entry.employeeCode]) {
      groupedByDate[entry.employeeCode] = {};
    }
    if (!groupedByDate[entry.employeeCode][dateKey]) {
      groupedByDate[entry.employeeCode][dateKey] = [];
    }
    groupedByDate[entry.employeeCode][dateKey].push({ time, isCheckIn: hours < 12 });
  }

  console.log('Grouped entries:', JSON.stringify(groupedByDate, null, 2));

  for (const employeeCode in groupedByDate) {
    const user = await User.findOne({ code: employeeCode });
    let monthlyLateAllowance = user.monthlyLateAllowance || 120;
    let annualLeaveBalance = user.annualLeaveBalance || 21;

    const sortedDates = Object.keys(groupedByDate[employeeCode]).sort();
    for (const dateKey of sortedDates) {
      const times = groupedByDate[employeeCode][dateKey].sort((a, b) => a.time.localeCompare(b.time));
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

      const lateMinutes = calculateLateMinutes(user, checkIn);
      let deductedDays = 0;

      if (lateMinutes > 0) {
        if (monthlyLateAllowance >= lateMinutes) {
          monthlyLateAllowance -= lateMinutes;
        } else {
          const excessLateMinutes = lateMinutes - monthlyLateAllowance;
          monthlyLateAllowance = 0;
          deductedDays = calculateDeductedDays(excessLateMinutes, checkIn);
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
        existingRecord.monthlyLateAllowance = monthlyLateAllowance;
        existingRecord.annualLeaveBalance = annualLeaveBalance;
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
    await User.updateOne({ code: employeeCode }, { $set: { monthlyLateAllowance, annualLeaveBalance } });
  }
  res.status(201).json({ message: 'تم رفع البصمات بنجاح' });
}

router.get('/', auth, async (req, res) => {
  const { employeeCode, startDate, endDate, filterPresent, filterAbsent } = req.query;
  const query = {};

  if (employeeCode) query.employeeCode = employeeCode;
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (filterPresent === 'true') query.status = 'present';
  else if (filterAbsent === 'true') query.status = 'absent';

  try {
    const records = await Attendance.find(query).sort({ date: 1 });
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
          const record = records.find(
            (r) =>
              r.employeeCode === user.code &&
              r.date.toDateString() === d.toDateString()
          );
          if (record) {
            lastMonthlyLateAllowance[user.code] = record.monthlyLateAllowance || lastMonthlyLateAllowance[user.code];
            lastAnnualLeaveBalance[user.code] = record.annualLeaveBalance || lastAnnualLeaveBalance[user.code];
            result.push(record);
          } else if (!filterPresent && !filterAbsent) {
            const status = calculateStatus(d, user.workingDays);
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
      result.push(...records);
    }

    const summaries = {};
    result.forEach((record) => {
      if (!summaries[record.employeeCode]) {
        summaries[record.employeeCode] = {
          employeeName: record.employeeName,
          presentDays: 0,
          absentDays: 0,
          weeklyOffDays: 0,
          leaveDays: 0,
          officialLeaveDays: 0,
          totalLateMinutes: 0,
          totalDeductedDays: 0,
          totalLeaveCompensation: 0,
          totalMedicalLeaveDeduction: 0,
        };
      }
      if (record.status === 'present') summaries[record.employeeCode].presentDays++;
      else if (record.status === 'absent') summaries[record.employeeCode].absentDays++;
      else if (record.status === 'weekly_off') summaries[record.employeeCode].weeklyOffDays++;
      else if (record.status === 'leave') summaries[record.employeeCode].leaveDays++;
      else if (record.status === 'official_leave') summaries[record.employeeCode].officialLeaveDays++;
      summaries[record.employeeCode].totalLateMinutes += record.lateMinutes || 0;
      summaries[record.employeeCode].totalDeductedDays += record.deductedDays || 0;
      summaries[record.employeeCode].totalLeaveCompensation += record.leaveCompensation || 0;
      summaries[record.employeeCode].totalMedicalLeaveDeduction += record.medicalLeaveDeduction || 0;
    });

    res.json({ records: result, summaries });
  } catch (err) {
    console.error(`Error fetching records: ${err.message}`);
    res.status(500).json({ message: `خطأ في جلب السجلات: ${err.message}` });
  }
});

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

    record.checkIn = checkIn || null;
    record.checkOut = checkOut || null;
    record.status = status || record.status || 'absent';

    if (isAnnualLeave) {
      record.status = 'leave';
      record.checkIn = null;
      record.checkOut = null;
      record.lateMinutes = 0;
      record.deductedDays = 0;
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
      record.medicalLeaveDeduction = 0;
      if (annualLeaveBalance >= 2) {
        annualLeaveBalance -= 2;
        const dailySalary = user.baseSalary / 30;
        leaveCompensation = dailySalary * 2;
        record.leaveCompensation = leaveCompensation;
      } else {
        return res.status(400).json({ message: 'رصيد الإجازة السنوية غير كافٍ لبدل الإجازة' });
      }
    } else if (isMedicalLeave) {
      record.status = 'leave';
      record.checkIn = null;
      record.checkOut = null;
      record.lateMinutes = 0;
      record.deductedDays = 0;
      record.leaveCompensation = 0;
      const dailySalary = user.baseSalary / 30;
      medicalLeaveDeduction = dailySalary * 0.25;
      record.medicalLeaveDeduction = medicalLeaveDeduction;
    } else {
      record.lateMinutes = calculateLateMinutes(user, record.checkIn);
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
      if (subRecord.status === 'leave' || subRecord.status === 'official_leave') {
        continue;
      }
      subRecord.lateMinutes = calculateLateMinutes(user, subRecord.checkIn);
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
      subRecord.monthlyLateAllowance = currentMonthlyAllowance;
      subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
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
          existingRecord.leaveCompensation = 0;
          existingRecord.medicalLeaveDeduction = 0;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance;
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
      for (const subRecord of subsequentRecords) {
        if (subRecord.status === 'leave' || subRecord.status === 'official_leave') {
          continue;
        }
        subRecord.lateMinutes = calculateLateMinutes(user, subRecord.checkIn);
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
        subRecord.monthlyLateAllowance = currentMonthlyAllowance;
        subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
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

router.post('/annual_leave', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'غير مصرح لك بتحديد إجازة سنوية' });
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

      const daysCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (annualLeaveBalance < daysCount) {
        return res.status(400).json({ message: `رصيد الإجازة السنوية غير كافٍ للموظف ${user.code}` });
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const existingRecord = await Attendance.findOne({
          employeeCode: user.code,
          date: { $gte: d, $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000) },
        });

        if (existingRecord) {
          existingRecord.status = 'leave';
          existingRecord.checkIn = null;
          existingRecord.checkOut = null;
          existingRecord.lateMinutes = 0;
          existingRecord.deductedDays = 0;
          existingRecord.leaveCompensation = 0;
          existingRecord.medicalLeaveDeduction = 0;
          existingRecord.monthlyLateAllowance = monthlyLateAllowance;
          existingRecord.annualLeaveBalance = annualLeaveBalance - 1;
          await existingRecord.save();
          console.log(`Updated annual leave for ${user.code} on ${d.toISOString()}`);
        } else {
          const newRecord = new Attendance({
            employeeCode: user.code,
            employeeName: user.employeeName,
            date: d,
            status: 'leave',
            shiftType: user.shiftType,
            workingDays: user.workingDays,
            lateMinutes: 0,
            deductedDays: 0,
            annualLeaveBalance: annualLeaveBalance - 1,
            monthlyLateAllowance,
            leaveCompensation: 0,
            medicalLeaveDeduction: 0,
            createdBy: req.user.id,
          });
          await newRecord.save();
          console.log(`Created annual leave for ${user.code} on ${d.toISOString()}`);
        }
        annualLeaveBalance -= 1;
      }

      const subsequentRecords = await Attendance.find({
        employeeCode: user.code,
        date: { $gt: end },
      }).sort({ date: 1 });

      let currentMonthlyAllowance = monthlyLateAllowance;
      let currentAnnualLeaveBalance = annualLeaveBalance;
      for (const subRecord of subsequentRecords) {
        if (subRecord.status === 'leave' || subRecord.status === 'official_leave') {
          continue;
        }
        subRecord.lateMinutes = calculateLateMinutes(user, subRecord.checkIn);
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
        subRecord.monthlyLateAllowance = currentMonthlyAllowance;
        subRecord.annualLeaveBalance = currentAnnualLeaveBalance;
        await subRecord.save();
      }

      await User.updateOne(
        { code: user.code },
        { $set: { monthlyLateAllowance: currentMonthlyAllowance, annualLeaveBalance: currentAnnualLeaveBalance } }
      );
    }

    res.json({ message: 'تم تحديد الإجازة السنوية بنجاح' });
  } catch (err) {
    console.error(`Error setting annual leave: ${err.message}`);
    res.status(400).json({ message: `خطأ أثناء تحديد الإجازة السنوية: ${err.message}` });
  }
});

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
  if (!checkInTime) return 0;
  const [hours, minutes] = checkInTime.split(':').map(Number);
  const checkIn = new Date(0);
  checkIn.setHours(hours, minutes);

  let expectedHour, expectedMinute;
  if (user.shiftType === 'administrative') {
    expectedHour = 8;
    expectedMinute = 30;
  } else if (user.shiftType === 'dayStation') {
    expectedHour = 8;
    expectedMinute = 0;
  } else if (user.shiftType === 'nightStation') {
    expectedHour = 20;
    expectedMinute = 0;
  } else {
    return 0;
  }

  const expected = new Date(0);
  expected.setHours(expectedHour, expectedMinute);
  if (checkIn > expected) {
    const diffMs = checkIn - expected;
    return Math.floor(diffMs / 1000 / 60);
  }
  return 0;
}

function calculateDeductedDays(lateMinutes, checkInTime) {
  if (!checkInTime || lateMinutes === 0) return 0;
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
