const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

const router = express.Router();

router.use(requireAuth);

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function attendanceKey(date) {
  return `leaderAttendance:${date}`;
}

function legacyAttendanceKey(user, date) {
  return `leaderAttendance:${date}:${user.id || normalize(user.email || user.name)}`;
}

function isLeader(user) {
  return normalize(user?.role).includes('lider');
}

function canApproveCorrections(user) {
  const role = normalize(user?.role);
  return role.includes('administrador') || role.includes('operacional');
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeDate(value) {
  return String(value || todayValue()).slice(0, 10);
}

function employeeRow(employee, attendance = {}, correctionRequests = {}) {
  const saved = attendance[employee.name] || {};
  const correction = correctionRequests[employee.name] || null;
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role || '-',
    team: employee.team || '-',
    status: saved.status || '',
    note: saved.note || '',
    correctionRequest: correction && correction.status !== 'Cancelada' ? correction : null
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
  const correctionRequests = saved?.correctionRequests || {};
  const rows = employees.map((employee) => employeeRow(employee, attendance, correctionRequests));
  return {
    date,
    leader: { id: user.id, name: user.name, email: user.email },
    employees: rows,
    summary: attendanceSummary(attendance),
    correctionRequests: Object.entries(correctionRequests)
      .filter(([, item]) => item?.status === 'Pendente')
      .map(([name, item]) => ({ name, ...item }))
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

async function readActiveEmployees(query = '', savedAttendance = {}, showAll = false) {
  const needle = normalize(query).trim();
  const savedNames = new Set(Object.keys(savedAttendance));
  const matches = (item) => {
    if (!needle) return showAll || savedNames.has(item.name);
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
    return needle || showAll ? employees : employees.filter(matches);
  }
  const db = await readDb();
  return (db.employees || [])
    .filter((item) => item.status === 'Ativo')
    .filter(matches)
    .slice(0, needle || showAll ? undefined : 20)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function saveAttendanceValue(key, value) {
  if (hasDatabaseUrl) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    return;
  }
  await updateDb((db) => {
    db.settings = db.settings || [];
    const index = db.settings.findIndex((item) => item.key === key);
    const now = new Date().toISOString();
    if (index === -1) db.settings.push({ id: `set_${Date.now()}`, key, value, createdAt: now, updatedAt: now });
    else db.settings[index] = { ...db.settings[index], value, updatedAt: now };
  });
}

router.get('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const saved = await readSavedAttendance(attendanceKey(date)) || await readSavedAttendance(legacyAttendanceKey(req.user, date));
    const employees = await readActiveEmployees(req.query.q || '', saved?.attendance || {}, !isLeader(req.user));

    return res.json({ data: shapePayload({ user: req.user, date, employees, saved }) });
  } catch (error) {
    return next(error);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const month = String(req.query.month || todayValue().slice(0, 7)).slice(0, 7);
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const prefix = from && to ? 'leaderAttendance:' : `leaderAttendance:${month}-`;
    const settings = hasDatabaseUrl
      ? await prisma.setting.findMany({ where: { key: { startsWith: prefix } } })
      : ((await readDb()).settings || []).filter((item) => String(item.key || '').startsWith(prefix));
    const byName = {};
    settings.filter((setting) => {
      if (!from || !to) return true;
      const date = String(setting.key || '').replace('leaderAttendance:', '').slice(0, 10);
      return date >= from && date <= to;
    }).forEach((setting) => {
      Object.entries(setting.value?.attendance || {}).forEach(([name, item]) => {
        const date = String(setting.key || '').replace('leaderAttendance:', '').slice(0, 10);
        byName[name] = byName[name] || { name, present: 0, absences: 0, days: [] };
        const status = normalize(item?.status || item);
        if (status === 'presente') byName[name].present += 1;
        if (status === 'falta') byName[name].absences += 1;
        if (status === 'presente' || status === 'falta') {
          byName[name].days.push({ date, status: item?.status || item, note: item?.note || '' });
        }
      });
    });
    return res.json({ data: { month, from: from || null, to: to || null, employees: Object.values(byName) } });
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.body?.date);
    const key = attendanceKey(date);
    const saved = await readSavedAttendance(key);
    const incoming = req.body?.attendance && typeof req.body.attendance === 'object' ? req.body.attendance : {};
    const correctionRequests = { ...(saved?.correctionRequests || {}) };
    if (isLeader(req.user)) {
      const blockedName = Object.keys(incoming).find((name) => {
        const alreadyMarked = Boolean(saved?.attendance?.[name]?.status);
        return alreadyMarked && correctionRequests[name]?.status !== 'Aprovada';
      });
      if (blockedName) return res.status(403).json({ error: { message: `Solicite correção para alterar ${blockedName}` } });
    }
    Object.keys(incoming).forEach((name) => {
      if (correctionRequests[name]?.status === 'Aprovada') delete correctionRequests[name];
    });
    const attendance = {
      ...(saved?.attendance || {}),
      ...incoming
    };
    const value = {
      date,
      updatedBy: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role },
      attendance,
      correctionRequests,
      updatedAt: new Date().toISOString()
    };

    await saveAttendanceValue(key, value);

    const employees = await readActiveEmployees(req.body?.q || '', attendance, !isLeader(req.user));
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: value }) });
  } catch (error) {
    return next(error);
  }
});

router.get('/corrections', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const saved = await readSavedAttendance(attendanceKey(date));
    const items = Object.entries(saved?.correctionRequests || {})
      .filter(([, item]) => item?.status === 'Pendente')
      .map(([name, item]) => ({ name, date, ...item }));
    return res.json({ data: items });
  } catch (error) {
    return next(error);
  }
});

router.put('/corrections', async (req, res, next) => {
  try {
    if (!isLeader(req.user)) return res.status(403).json({ error: { message: 'Somente líder pode solicitar correção' } });
    const date = sanitizeDate(req.body?.date);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'Colaborador obrigatório' } });
    const key = attendanceKey(date);
    const saved = await readSavedAttendance(key) || { date, attendance: {}, correctionRequests: {} };
    const value = {
      ...saved,
      date,
      correctionRequests: {
        ...(saved.correctionRequests || {}),
        [name]: {
          status: 'Pendente',
          currentStatus: saved.attendance?.[name]?.status || '',
          requestedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
          requestedAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveAttendanceValue(key, value);
    const employees = await readActiveEmployees(req.body?.q || '', value.attendance || {}, false);
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: value }) });
  } catch (error) {
    return next(error);
  }
});

router.put('/corrections/approve', async (req, res, next) => {
  try {
    if (!canApproveCorrections(req.user)) return res.status(403).json({ error: { message: 'Seu perfil não aprova correção de chamada' } });
    const date = sanitizeDate(req.body?.date);
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'Colaborador obrigatório' } });
    const key = attendanceKey(date);
    const saved = await readSavedAttendance(key) || { date, attendance: {}, correctionRequests: {} };
    const current = saved.correctionRequests?.[name];
    const value = {
      ...saved,
      date,
      correctionRequests: {
        ...(saved.correctionRequests || {}),
        [name]: {
          ...(current || {}),
          status: 'Aprovada',
          approvedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
          approvedAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString()
    };
    await saveAttendanceValue(key, value);
    const employees = await readActiveEmployees(req.body?.q || '', value.attendance || {}, true);
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: value }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
