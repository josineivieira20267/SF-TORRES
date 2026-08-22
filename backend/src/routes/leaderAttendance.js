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
    status: saved.status || 'Pendente',
    note: saved.note || ''
  };
}

function shapePayload({ user, date, employees, saved }) {
  const attendance = saved?.attendance || {};
  const rows = employees.map((employee) => employeeRow(employee, attendance));
  return {
    date,
    leader: { id: user.id, name: user.name, email: user.email },
    employees: rows,
    summary: {
      total: rows.length,
      present: rows.filter((item) => normalize(item.status) === 'presente').length,
      absences: rows.filter((item) => normalize(item.status) === 'falta').length,
      pending: rows.filter((item) => normalize(item.status) === 'pendente').length
    }
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

async function readActiveEmployees() {
  if (hasDatabaseUrl) {
    return prisma.employee.findMany({ where: { status: 'Ativo' }, orderBy: { name: 'asc' } });
  }
  const db = await readDb();
  return (db.employees || [])
    .filter((item) => item.status === 'Ativo')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

router.get('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const [employees, saved] = await Promise.all([
      readActiveEmployees(),
      readSavedAttendance(attendanceKey(req.user, date))
    ]);

    return res.json({ data: shapePayload({ user: req.user, date, employees, saved }) });
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.body?.date);
    const key = attendanceKey(req.user, date);
    const attendance = req.body?.attendance && typeof req.body.attendance === 'object' ? req.body.attendance : {};
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

    const employees = await readActiveEmployees();
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: value }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
