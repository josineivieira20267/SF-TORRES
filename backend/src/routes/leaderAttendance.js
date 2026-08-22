const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

const router = express.Router();

router.use(requireAuth);

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function attendanceKey(user, date) {
  return `leaderAttendance:${date}:${user.id || normalize(user.email || user.name)}`;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeDate(value) {
  return String(value || todayValue()).slice(0, 10);
}

function employeeRow(employee, attendance = {}) {
  const saved = attendance[employee.name] || {};
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role || '-',
    team: employee.team || '-',
    status: saved.status || '',
    note: saved.note || ''
  };
}

function attendanceSummary(attendance = {}) {
  const entries = Object.values(attendance);
  return {
    total: entries.length,
    present: entries.filter((item) => normalize(item?.status || item) === 'presente').length,
    absences: entries.filter((item) => normalize(item?.status || item) === 'falta').length,
    pending: entries.filter((item) => !normalize(item?.status || item)).length
  };
}

function shapePayload({ user, date, employees, saved }) {
  const attendance = saved?.attendance || {};
  const rows = employees.map((employee) => employeeRow(employee, attendance));
  return {
    date,
    leader: { id: user.id, name: user.name, email: user.email },
    employees: rows,
    summary: attendanceSummary(attendance)
  };
}

async function readSavedAttendance(key) {
  if (hasDatabaseUrl) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value || null;
  }
  const db = await readDb();
  return (db.settings || []).find((item) => item.key === key)?.value || null;
}

async function readActiveEmployees(query = '', savedAttendance = {}) {
  const needle = normalize(query).trim();
  const savedNames = new Set(Object.keys(savedAttendance));
  const matches = (item) => {
    if (!needle) return savedNames.has(item.name);
    return normalize(`${item.name} ${item.role} ${item.team}`).includes(needle);
  };
  if (hasDatabaseUrl) {
    const where = needle
      ? {
          status: 'Ativo',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { role: { contains: query, mode: 'insensitive' } },
            { team: { contains: query, mode: 'insensitive' } }
          ]
        }
      : { status: 'Ativo' };
    const employees = await prisma.employee.findMany({ where, orderBy: { name: 'asc' }, ...(needle ? { take: 20 } : {}) });
    return needle ? employees : employees.filter(matches);
  }
  const db = await readDb();
  return (db.employees || [])
    .filter((item) => item.status === 'Ativo')
    .filter(matches)
    .slice(0, 20)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

router.get('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const saved = await readSavedAttendance(attendanceKey(req.user, date));
    const employees = await readActiveEmployees(req.query.q || '', saved?.attendance || {});

    return res.json({ data: shapePayload({ user: req.user, date, employees, saved }) });
  } catch (error) {
    return next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const month = String(req.query.month || todayValue().slice(0, 7)).slice(0, 7);
    const prefix = `leaderAttendance:${month}-`;
    const settings = hasDatabaseUrl
      ? await prisma.setting.findMany({ where: { key: { startsWith: prefix } } })
      : ((await readDb()).settings || []).filter((item) => String(item.key || '').startsWith(prefix));
    const byName = {};
    settings.forEach((setting) => {
      Object.entries(setting.value?.attendance || {}).forEach(([name, item]) => {
        byName[name] = byName[name] || { name, present: 0, absences: 0 };
        const status = normalize(item?.status || item);
        if (status === 'presente') byName[name].present += 1;
        if (status === 'falta') byName[name].absences += 1;
      });
    });
    return res.json({ data: { month, employees: Object.values(byName) } });
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.body?.date);
    const key = attendanceKey(req.user, date);
    const saved = await readSavedAttendance(key);
    const attendance = {
      ...(saved?.attendance || {}),
      ...(req.body?.attendance && typeof req.body.attendance === 'object' ? req.body.attendance : {})
    };
    const value = {
      date,
      leader: { id: req.user.id, name: req.user.name, email: req.user.email },
      attendance,
      updatedAt: new Date().toISOString()
    };

    if (hasDatabaseUrl) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      });
    } else {
      await updateDb((db) => {
        db.settings = db.settings || [];
        const index = db.settings.findIndex((item) => item.key === key);
        const now = new Date().toISOString();
        if (index === -1) db.settings.push({ id: `set_${Date.now()}`, key, value, createdAt: now, updatedAt: now });
        else db.settings[index] = { ...db.settings[index], value, updatedAt: now };
      });
    }

    const employees = await readActiveEmployees(req.body?.q || '', attendance);
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: value }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
