const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { readDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

const router = express.Router();

router.use(requireAuth);

const bonusRules = [
  { key: 'pa', name: 'Equipe PA', base: 150, mode: 'monthly', match: ['equipe pa', 'pa'] },
  { key: 'batedores', name: 'Batedores', base: 8, mode: 'per-os', match: ['batedor', 'batedores', 'conferente'] },
  { key: 'apoio', name: 'Apoio', base: 5, mode: 'per-os', match: ['apoio'] }
];

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function monthRange(month) {
  const now = new Date();
  const [year, monthNumber] = String(month || '').split('-').map(Number);
  const safeYear = Number.isFinite(year) ? year : now.getFullYear();
  const safeMonth = Number.isFinite(monthNumber) ? monthNumber - 1 : now.getMonth();
  const end = new Date(safeYear, safeMonth + 1, 0);
  return {
    month: `${safeYear}-${pad2(safeMonth + 1)}`,
    from: `${safeYear}-${pad2(safeMonth + 1)}-01T00:00:00`,
    to: `${safeYear}-${pad2(safeMonth + 1)}-${pad2(end.getDate())}T23:59:59`,
    days: end.getDate()
  };
}

function inRange(item, field, range) {
  const value = String(item[field] || '');
  return value && value >= range.from && value <= range.to;
}

function isFinalStatus(status) {
  const value = normalize(status);
  return value.includes('finalizado') || value.includes('conclu');
}

function absenceCount(order) {
  if (!order?.attendance) return 0;
  return Object.values(order.attendance).filter((value) => normalize(typeof value === 'object' ? value.status : value) === 'falta').length;
}

function bonusCriterionFor(employee) {
  const team = normalize(employee?.team);
  const role = normalize(employee?.role);
  const byTeam = bonusRules.find((rule) => rule.match.some((item) => team.includes(item)));
  if (byTeam) return byTeam;
  return bonusRules.find((rule) => rule.match.some((item) => role.includes(item))) || { key: 'none', name: 'Sem criterio', base: 0, mode: 'per-os', match: [] };
}

function bonusDiscountFor(absences) {
  return absences <= 0 ? 1 : absences === 1 ? 0.75 : absences === 2 ? 0.5 : absences === 3 ? 0.25 : 0;
}

function bonusAmountFor(summary) {
  const factor = bonusDiscountFor(summary.absences);
  const paidUnits = summary.criterion.mode === 'monthly' ? (summary.present > 0 ? 1 : 0) : summary.present;
  return summary.criterion.base * factor * paidUnits;
}

function durationHours(order) {
  if (!order.operationStart || !order.operationEnd) return 0;
  const start = new Date(String(order.operationStart).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
  const end = new Date(String(order.operationEnd).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
  const diff = end - start;
  return Number.isFinite(diff) && diff > 0 ? diff / 36e5 : 0;
}

function countBy(items, readLabel) {
  return Object.values(items.reduce((acc, item) => {
    const label = readLabel(item) || 'Nao informado';
    acc[label] = acc[label] || { label, value: 0 };
    acc[label].value += 1;
    return acc;
  }, {})).sort((a, b) => b.value - a.value);
}

function buildSummary({ workOrders, employees, occurrences, measurements, activeClients, activeEmployees, range }) {
  const byStatus = workOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const memberEntries = workOrders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : Object.keys(order.attendance || {});
    return members.map((name) => {
      const attendance = order.attendance?.[name];
      const status = attendance ? (typeof attendance === 'object' ? attendance.status : attendance) : 'Pendente';
      return { order, name, status };
    });
  });
  const productivity = Object.values(memberEntries.reduce((acc, entry) => {
    const key = normalize(entry.name);
    const employee = employeeByName[key] || { name: entry.name, role: '-', team: '-' };
    const criterion = bonusCriterionFor(employee);
    acc[key] = acc[key] || { employee, criterion, os: 0, present: 0, absences: 0, pending: 0 };
    acc[key].os += 1;
    const status = normalize(entry.status);
    if (status === 'falta') acc[key].absences += 1;
    else if (status === 'pendente') acc[key].pending += 1;
    else acc[key].present += 1;
    return acc;
  }, {})).map((item) => {
    const factor = bonusDiscountFor(item.absences);
    return { ...item, factor, bonus: bonusAmountFor(item) };
  }).sort((a, b) => b.bonus - a.bonus || b.present - a.present);
  const activeOrders = workOrders.filter((order) => normalize(order.status).includes('exec'));
  const programmedOrders = workOrders.filter((order) => normalize(order.status).includes('program'));
  const finalOrders = workOrders.filter((order) => isFinalStatus(order.status));
  const totalAbsences = workOrders.reduce((sum, order) => sum + absenceCount(order), 0);
  const pendingCalls = productivity.reduce((sum, item) => sum + item.pending, 0);
  const totalAttendances = productivity.reduce((sum, item) => sum + item.present + item.absences + item.pending, 0);
  const productivityRate = totalAttendances ? Math.round((productivity.reduce((sum, item) => sum + item.present, 0) / totalAttendances) * 1000) / 10 : 0;
  const openOccurrences = occurrences.filter((item) => !normalize(item.status).includes('resolvida'));
  const durations = workOrders.map(durationHours).filter((value) => value > 0);
  const avgDuration = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  const days = Array.from({ length: range.days }, (_, index) => `${range.month}-${pad2(index + 1)}`);
  const dailyOrders = days.map((day) => ({ label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, value: workOrders.filter((order) => String(order.date || '').slice(0, 10) === day).length }));
  const trendStep = Math.max(Math.ceil(range.days / 12), 1);

  return {
    month: range.month,
    workOrders: {
      total: workOrders.length,
      byStatus,
      active: activeOrders.length,
      programmed: programmedOrders.length,
      final: finalOrders.length,
      pendingAndAbsences: programmedOrders.length + pendingCalls + totalAbsences,
      totalAbsences,
      pendingCalls
    },
    activeClients,
    activeEmployees,
    openOccurrences: openOccurrences.length,
    billedMonth: measurements.filter((item) => item.status === 'Fechada').reduce((sum, item) => sum + Number(item.total || 0), 0),
    productivityRate,
    avgDurationHours: avgDuration,
    charts: {
      status: [
        { label: 'Finalizadas', value: finalOrders.length },
        { label: 'Em execucao', value: activeOrders.length },
        { label: 'Pendentes', value: programmedOrders.length },
        { label: 'Faltas', value: totalAbsences },
        { label: 'Ocorrencias', value: openOccurrences.length }
      ],
      dailyOrders,
      trendChart: dailyOrders.filter((_, index) => index % trendStep === 0 || index === range.days - 1),
      clientChart: countBy(workOrders, (order) => order.client).slice(0, 7)
    },
    ranking: productivity.slice(0, 8).map((item, index) => ({
      index: index + 1,
      employee: { name: item.employee.name, team: item.employee.team || '-', photo: item.employee.photo || item.employee.profilePhoto || '' },
      criterion: { name: item.criterion.name },
      os: item.os,
      present: item.present,
      absences: item.absences,
      factor: item.factor,
      bonus: item.bonus,
      label: item.employee.name,
      value: item.present,
      percent: Math.round(item.factor * 100)
    })),
    exportRows: workOrders.map((order) => [order.number, order.client, order.service, order.responsible, Array.isArray(order.teamMembers) ? order.teamMembers.join(', ') : '', order.status, absenceCount(order), order.date, order.operationStart, order.operationEnd])
  };
}

router.get('/summary', async (req, res, next) => {
  try {
    const range = monthRange(req.query.month);

    if (hasDatabaseUrl) {
      const [workOrders, clients, employees, occurrences, measurements] = await Promise.all([
        prisma.workOrder.findMany({ where: { date: { gte: range.from, lte: range.to } } }),
        prisma.client.count({ where: { status: 'Ativo' } }),
        prisma.employee.findMany(),
        prisma.occurrence.findMany(),
        prisma.measurement.findMany({ where: { status: 'Fechada' } })
      ]);
      return res.json({ data: buildSummary({
        workOrders,
        employees,
        occurrences,
        measurements,
        activeClients: clients,
        activeEmployees: employees.filter((item) => item.status === 'Ativo').length,
        range
      }) });
    }

    const db = await readDb();
    const workOrders = (db.workOrders || []).filter((item) => inRange(item, 'date', range));
    return res.json({ data: buildSummary({
      workOrders,
      employees: db.employees || [],
      occurrences: db.occurrences || [],
      measurements: db.measurements || [],
      activeClients: (db.clients || []).filter((item) => item.status === 'Ativo').length,
      activeEmployees: (db.employees || []).filter((item) => item.status === 'Ativo').length,
      range
    }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
