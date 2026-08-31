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

function attendanceObject(rows = []) {
  return rows.reduce((acc, row) => {
    acc[row.employeeName] = { status: row.status || '', note: row.note || '' };
    return acc;
  }, {});
}

function correctionObject(rows = []) {
  return rows.reduce((acc, row) => {
    if (row.status === 'Cancelada') return acc;
    acc[row.employeeName] = {
      status: row.status,
      currentStatus: row.currentStatus || '',
      reason: row.reason || '',
      requestedBy: { id: row.requestedById || '', name: row.requestedByName || '' },
      requestedAt: row.requestedAt,
      approvedBy: { id: row.approvedById || '', name: row.approvedByName || '' },
      approvedAt: row.approvedAt
    };
    return acc;
  }, {});
}

async function readAttendanceDay(user, date) {
  const legacy = await readSavedAttendance(attendanceKey(date)) || await readSavedAttendance(legacyAttendanceKey(user, date)) || {};
  if (!hasDatabaseUrl) return legacy;
  const [attendanceRows, correctionRows] = await Promise.all([
    prisma.employeeAttendance.findMany({ where: { date } }),
    prisma.attendanceCorrection.findMany({ where: { date, status: { not: 'Cancelada' } } })
  ]);
  return {
    date,
    updatedBy: legacy.updatedBy || null,
    attendance: { ...(legacy.attendance || {}), ...attendanceObject(attendanceRows) },
    correctionRequests: { ...(legacy.correctionRequests || {}), ...correctionObject(correctionRows) }
  };
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

async function findEmployeeByName(name) {
  if (!hasDatabaseUrl) return null;
  return prisma.employee.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
}

async function saveLegacyAttendanceValue(key, value) {
  await updateDb((db) => {
    db.settings = db.settings || [];
    const index = db.settings.findIndex((item) => item.key === key);
    const now = new Date().toISOString();
    if (index === -1) db.settings.push({ id: `set_${Date.now()}`, key, value, createdAt: now, updatedAt: now });
    else db.settings[index] = { ...db.settings[index], value, updatedAt: now };
  });
}

function summarizeRows(rows = []) {
  const byName = {};
  rows.forEach((row) => {
    const status = normalize(row.status);
    if (status !== 'presente' && status !== 'falta') return;
    byName[row.employeeName] = byName[row.employeeName] || { name: row.employeeName, present: 0, absences: 0, days: [] };
    if (status === 'presente') byName[row.employeeName].present += 1;
    if (status === 'falta') byName[row.employeeName].absences += 1;
    byName[row.employeeName].days.push({ date: row.date, status: row.status, note: row.note || '' });
  });
  return Object.values(byName);
}

function includeAllEmployees(summary = [], employees = []) {
  const byName = Object.fromEntries(summary.map((item) => [normalize(item.name), item]));
  employees
    .filter((employee) => employee.status === 'Ativo')
    .forEach((employee) => {
      const key = normalize(employee.name);
      byName[key] = {
        name: employee.name,
        role: employee.role || '',
        team: employee.team || '',
        present: byName[key]?.present || 0,
        absences: byName[key]?.absences || 0,
        days: byName[key]?.days || []
      };
    });
  return Object.values(byName).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function mergeLegacySummary(summary, settings = [], from = '', to = '') {
  const byNameDate = {};
  summary.forEach((employee) => {
    employee.days.forEach((day) => {
      byNameDate[`${normalize(employee.name)}:${day.date}`] = { name: employee.name, ...day };
    });
  });
  settings.filter((setting) => {
    if (!from || !to) return true;
    const date = String(setting.key || '').replace('leaderAttendance:', '').slice(0, 10);
    return date >= from && date <= to;
  }).forEach((setting) => {
    const date = String(setting.key || '').replace('leaderAttendance:', '').slice(0, 10);
    Object.entries(setting.value?.attendance || {}).forEach(([name, item]) => {
      const status = item?.status || item;
      const normalized = normalize(status);
      if (normalized !== 'presente' && normalized !== 'falta') return;
      const key = `${normalize(name)}:${date}`;
      if (!byNameDate[key]) byNameDate[key] = { name, date, status, note: item?.note || '' };
    });
  });
  return summarizeRows(Object.values(byNameDate).map((item) => ({
    employeeName: item.name,
    date: item.date,
    status: item.status,
    note: item.note
  })));
}

router.get('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const saved = await readAttendanceDay(req.user, date);
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

    if (hasDatabaseUrl) {
      const where = from && to ? { date: { gte: from, lte: to } } : { date: { startsWith: `${month}-` } };
      const [rows, settings, employees] = await Promise.all([
        prisma.employeeAttendance.findMany({ where, orderBy: [{ date: 'asc' }, { employeeName: 'asc' }] }),
        prisma.setting.findMany({ where: { key: { startsWith: prefix } } }),
        prisma.employee.findMany({ where: { status: 'Ativo' }, orderBy: { name: 'asc' } })
      ]);
      const monthlyEmployees = includeAllEmployees(mergeLegacySummary(summarizeRows(rows), settings, from, to), employees);
      return res.json({ data: { month, from: from || null, to: to || null, employees: monthlyEmployees } });
    }

    const db = await readDb();
    const settings = (db.settings || []).filter((item) => String(item.key || '').startsWith(prefix));
    const monthlyEmployees = includeAllEmployees(mergeLegacySummary([], settings, from, to), db.employees || []);
    return res.json({ data: { month, from: from || null, to: to || null, employees: monthlyEmployees } });
  } catch (error) {
    return next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.body?.date);
    const saved = await readAttendanceDay(req.user, date);
    const incoming = req.body?.attendance && typeof req.body.attendance === 'object' ? req.body.attendance : {};
    const correctionRequests = { ...(saved?.correctionRequests || {}) };

    if (isLeader(req.user)) {
      const blockedName = Object.keys(incoming).find((name) => {
        const alreadyMarked = Boolean(saved?.attendance?.[name]?.status);
        return alreadyMarked && correctionRequests[name]?.status !== 'Aprovada';
      });
      if (blockedName) return res.status(403).json({ error: { message: `Solicite correcao para alterar ${blockedName}` } });
    }

    if (hasDatabaseUrl) {
      await Promise.all(Object.entries(incoming).map(async ([name, item]) => {
        if (item?.clear) {
          await prisma.employeeAttendance.deleteMany({ where: { date, employeeName: name } });
          return;
        }
        const employee = await findEmployeeByName(name);
        const payload = {
          employeeId: employee?.id || null,
          employeeName: name,
          date,
          status: item?.status || item || '',
          note: item?.note || '',
          markedById: req.user.id || '',
          markedByName: req.user.name || req.user.email || '',
          markedByRole: req.user.role || ''
        };
        await prisma.employeeAttendance.upsert({
          where: { date_employeeName: { date, employeeName: name } },
          update: payload,
          create: payload
        });
        if (correctionRequests[name]?.status === 'Aprovada') {
          await prisma.attendanceCorrection.deleteMany({ where: { date, employeeName: name, status: 'Aprovada' } });
        }
      }));
    } else {
      Object.keys(incoming).forEach((name) => {
        if (correctionRequests[name]?.status === 'Aprovada') delete correctionRequests[name];
      });
      const attendance = { ...(saved?.attendance || {}) };
      Object.entries(incoming).forEach(([name, item]) => {
        if (item?.clear) delete attendance[name];
        else attendance[name] = item;
      });
      await saveLegacyAttendanceValue(attendanceKey(date), {
        date,
        updatedBy: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role },
        attendance,
        correctionRequests,
        updatedAt: new Date().toISOString()
      });
    }

    const nextSaved = await readAttendanceDay(req.user, date);
    const employees = await readActiveEmployees(req.body?.q || '', nextSaved.attendance || {}, !isLeader(req.user));
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: nextSaved }) });
  } catch (error) {
    return next(error);
  }
});

router.get('/corrections', async (req, res, next) => {
  try {
    const date = sanitizeDate(req.query.date);
    const saved = await readAttendanceDay(req.user, date);
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
    if (!isLeader(req.user)) return res.status(403).json({ error: { message: 'Somente lider pode solicitar correcao' } });
    const date = sanitizeDate(req.body?.date);
    const name = String(req.body?.name || '').trim();
    const reason = String(req.body?.reason || '').trim();
    if (!name) return res.status(400).json({ error: { message: 'Colaborador obrigatorio' } });
    if (!reason) return res.status(400).json({ error: { message: 'Justificativa obrigatoria para solicitar correcao' } });
    const saved = await readAttendanceDay(req.user, date);

    if (hasDatabaseUrl) {
      const employee = await findEmployeeByName(name);
      await prisma.attendanceCorrection.upsert({
        where: { date_employeeName: { date, employeeName: name } },
        update: {
          employeeId: employee?.id || null,
          status: 'Pendente',
          currentStatus: saved.attendance?.[name]?.status || '',
          reason,
          requestedById: req.user.id || '',
          requestedByName: req.user.name || req.user.email || '',
          requestedAt: new Date()
        },
        create: {
          employeeId: employee?.id || null,
          employeeName: name,
          date,
          status: 'Pendente',
          currentStatus: saved.attendance?.[name]?.status || '',
          reason,
          requestedById: req.user.id || '',
          requestedByName: req.user.name || req.user.email || ''
        }
      });
    } else {
      await saveLegacyAttendanceValue(attendanceKey(date), {
        ...saved,
        date,
        correctionRequests: {
          ...(saved.correctionRequests || {}),
          [name]: {
            status: 'Pendente',
            currentStatus: saved.attendance?.[name]?.status || '',
            reason,
            requestedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
            requestedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      });
    }

    const nextSaved = await readAttendanceDay(req.user, date);
    const employees = await readActiveEmployees(req.body?.q || '', nextSaved.attendance || {}, false);
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: nextSaved }) });
  } catch (error) {
    return next(error);
  }
});

router.put('/corrections/approve', async (req, res, next) => {
  try {
    if (!canApproveCorrections(req.user)) return res.status(403).json({ error: { message: 'Seu perfil nao aprova correcao de chamada' } });
    const date = sanitizeDate(req.body?.date);
    const name = String(req.body?.name || '').trim();
    const approved = req.body?.approved !== false;
    const nextStatus = approved ? 'Aprovada' : 'Negada';
    if (!name) return res.status(400).json({ error: { message: 'Colaborador obrigatorio' } });
    const saved = await readAttendanceDay(req.user, date);

    if (hasDatabaseUrl) {
      const employee = await findEmployeeByName(name);
      await prisma.attendanceCorrection.upsert({
        where: { date_employeeName: { date, employeeName: name } },
        update: {
          employeeId: employee?.id || null,
          status: nextStatus,
          approvedById: req.user.id || '',
          approvedByName: req.user.name || req.user.email || '',
          approvedAt: new Date()
        },
        create: {
          employeeId: employee?.id || null,
          employeeName: name,
          date,
          status: nextStatus,
          currentStatus: saved.attendance?.[name]?.status || '',
          approvedById: req.user.id || '',
          approvedByName: req.user.name || req.user.email || '',
          approvedAt: new Date()
        }
      });
    } else {
      const current = saved.correctionRequests?.[name];
      await saveLegacyAttendanceValue(attendanceKey(date), {
        ...saved,
        date,
        correctionRequests: {
          ...(saved.correctionRequests || {}),
          [name]: {
            ...(current || {}),
            status: nextStatus,
            approvedBy: { id: req.user.id, name: req.user.name, email: req.user.email },
            approvedAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      });
    }

    const nextSaved = await readAttendanceDay(req.user, date);
    const employees = await readActiveEmployees(req.body?.q || '', nextSaved.attendance || {}, true);
    return res.json({ data: shapePayload({ user: req.user, date, employees, saved: nextSaved }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
