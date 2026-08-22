const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { readDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

const router = express.Router();

router.use(requireAuth);

const defaultProductivityRules = {
  standard: [
    { key: 'pa', name: 'Equipe PA', base: 150, mode: 'monthly', match: 'equipe pa, pa' },
    { key: 'batedores', name: 'Batedores', base: 8, mode: 'per-os', match: 'batedor, batedores, conferente' },
    { key: 'apoio', name: 'Apoio', base: 5, mode: 'per-os', match: 'apoio' }
  ],
  michelin: {
    enabled: true,
    client: 'MICHELIN',
    weekdayOnly: true,
    commercialStart: '07:30',
    commercialEnd: '18:00',
    afterStart: '18:01',
    afterEnd: '23:00',
    commercialContainer: 49.14,
    commercialTruck: 28.09,
    afterContainer: 68.26,
    afterTruck: 39.01
  }
};

function mergeProductivityRules(value) {
  const saved = value && typeof value === 'object' ? value : {};
  return {
    standard: Array.isArray(saved.standard) && saved.standard.length ? saved.standard : defaultProductivityRules.standard,
    michelin: { ...defaultProductivityRules.michelin, ...(saved.michelin || {}) }
  };
}

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

function readRuleMatches(rule) {
  return Array.isArray(rule.match) ? rule.match : String(rule.match || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function rulesForAssignment(names = [], rules = defaultProductivityRules) {
  const selected = Array.isArray(names) ? names : [];
  const standard = rules.standard || defaultProductivityRules.standard;
  return selected.map((name) => standard.find((rule) => normalize(rule.name) === normalize(name) || normalize(rule.key) === normalize(name))).filter(Boolean);
}

function isMichelinOrder(order, rules = defaultProductivityRules) {
  const config = rules.michelin || defaultProductivityRules.michelin;
  return Boolean(config.enabled) && normalize(order?.client) === normalize(config.client);
}

function bonusCriterionFor(employee, rules = defaultProductivityRules) {
  const team = normalize(employee?.team);
  const role = normalize(employee?.role);
  const standard = rules.standard || defaultProductivityRules.standard;
  const byTeam = standard.find((rule) => readRuleMatches(rule).some((item) => team.includes(normalize(item))));
  if (byTeam) return byTeam;
  return standard.find((rule) => readRuleMatches(rule).some((item) => role.includes(normalize(item)))) || { key: 'none', name: 'Sem criterio', base: 0, mode: 'per-os', match: '' };
}

function bonusDiscountFor(absences) {
  return absences <= 0 ? 1 : absences === 1 ? 0.75 : absences === 2 ? 0.5 : absences === 3 ? 0.25 : 0;
}

function bonusAmountFor(summary) {
  const factor = bonusDiscountFor(summary.absences);
  const paidUnits = summary.criterion.mode === 'monthly' ? (summary.present > 0 ? 1 : 0) : summary.present;
  return summary.criterion.base * factor * paidUnits;
}

function productivityTotalFor(summary) {
  const standardPresent = Number.isFinite(summary.standardPresent) ? summary.standardPresent : summary.present;
  return Number(summary.customBonus || 0) + bonusAmountFor({ ...summary, present: standardPresent });
}

function timeMinutes(value) {
  const match = String(value || '').match(/(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function scheduledWeekday(value) {
  const raw = String(value || '').slice(0, 10);
  const parsed = new Date(`${raw}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

function isLeaderForOrder(employee, order, name) {
  return normalize(employee?.role).includes('lider') || normalize(order?.responsible) === normalize(name);
}

function michelinShareForEntry(order, name, employeeByName, rules = defaultProductivityRules) {
  const config = rules.michelin || defaultProductivityRules.michelin;
  if (!config.enabled || normalize(order?.client) !== normalize(config.client)) return null;
  const weekday = scheduledWeekday(order.date);
  if (config.weekdayOnly && (weekday === 0 || weekday === 6 || weekday === null)) return null;
  const minutes = timeMinutes(order.date);
  if (minutes === null) return null;
  const commercial = minutes >= timeMinutes(config.commercialStart) && minutes <= timeMinutes(config.commercialEnd);
  const after = minutes >= timeMinutes(config.afterStart) && minutes <= timeMinutes(config.afterEnd);
  if (!commercial && !after) return null;
  const vehicle = normalize(`${order.equipment} ${order.equipmentType} ${order.service} ${order.product}`);
  const isTruck = vehicle.includes('caminh') || vehicle.includes('truck');
  const total = commercial
    ? (isTruck ? Number(config.commercialTruck) : Number(config.commercialContainer))
    : (isTruck ? Number(config.afterTruck) : Number(config.afterContainer));
  const members = Array.isArray(order.teamMembers) ? order.teamMembers : Object.keys(order.attendance || {});
  const payableMembers = members.filter((memberName) => !isLeaderForOrder(employeeByName[normalize(memberName)], order, memberName));
  if (!payableMembers.includes(name) || !payableMembers.length) return 0;
  return total / payableMembers.length;
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

function attendanceByName(settings = []) {
  return settings.reduce((acc, setting) => {
    Object.entries(setting.value?.attendance || {}).forEach(([name, item]) => {
      const key = normalize(name);
      acc[key] = acc[key] || { present: 0, absences: 0 };
      const status = normalize(item?.status || item);
      if (status === 'presente') acc[key].present += 1;
      if (status === 'falta') acc[key].absences += 1;
    });
    return acc;
  }, {});
}

function buildSummary({ workOrders, employees, occurrences, measurements, activeClients, activeEmployees, range, productivityRules = defaultProductivityRules, attendanceSettings = [] }) {
  const byStatus = workOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const callsByName = attendanceByName(attendanceSettings);
  const memberEntries = workOrders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
    return members.flatMap((name) => {
      if (isMichelinOrder(order, productivityRules)) return [{ order, name, criterion: { key: 'michelin', name: 'MICHELIN', base: 0, mode: 'per-os', match: 'michelin' } }];
      const assignedRules = rulesForAssignment(order.teamRoles?.[name], productivityRules);
      const roles = assignedRules.length ? assignedRules : [{ key: 'none', name: 'Sem criterio', base: 0, mode: 'per-os', match: '' }];
      return roles.map((criterion) => ({ order, name, criterion }));
    });
  });
  const productivity = Object.values(memberEntries.reduce((acc, entry) => {
    const key = normalize(entry.name);
    const employee = employeeByName[key] || { name: entry.name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = entry.criterion;
    acc[key] = acc[key] || { employee, criterion, criteria: new Set(), osSet: new Set(), michelinSet: new Set(), os: 0, present: 0, absences: callsByName[key]?.absences || 0, pending: 0, customBonus: 0, standardBonus: 0 };
    acc[key].criteria.add(criterion.name);
    acc[key].osSet.add(entry.order.id || entry.order.number);
    acc[key].present += 1;
    if (michelinShare === null && criterion.mode !== 'monthly') acc[key].standardBonus += Number(criterion.base || 0);
    const michelinKey = `${entry.order.id || entry.order.number}:${entry.name}`;
    if (michelinShare !== null && !acc[key].michelinSet.has(michelinKey)) {
      if (michelinShare !== null) acc[key].customBonus += michelinShare;
      acc[key].michelinSet.add(michelinKey);
    }
    return acc;
  }, {})).map((item) => {
    const factor = bonusDiscountFor(item.absences);
    const monthlyBonus = item.criteria.has('Equipe PA') && item.present > 0 ? Number((productivityRules.standard || []).find((rule) => rule.name === 'Equipe PA')?.base || 0) * factor : 0;
    return { ...item, os: item.osSet.size, criterion: { ...item.criterion, name: Array.from(item.criteria).join(' + ') }, factor, bonus: item.customBonus + (item.standardBonus * factor) + monthlyBonus };
  }).sort((a, b) => b.bonus - a.bonus || b.present - a.present);
  const activeOrders = workOrders.filter((order) => normalize(order.status).includes('exec'));
  const programmedOrders = workOrders.filter((order) => normalize(order.status).includes('program'));
  const finalOrders = workOrders.filter((order) => isFinalStatus(order.status));
  const totalAbsences = Object.values(callsByName).reduce((sum, item) => sum + item.absences, 0);
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
      criterion: { name: item.customBonus ? `${item.criterion.name} + MICHELIN` : item.criterion.name },
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
      const [workOrders, clients, employees, occurrences, measurements, productivitySetting, attendanceSettings] = await Promise.all([
        prisma.workOrder.findMany({ where: { date: { gte: range.from, lte: range.to } } }),
        prisma.client.count({ where: { status: 'Ativo' } }),
        prisma.employee.findMany(),
        prisma.occurrence.findMany(),
        prisma.measurement.findMany({ where: { status: 'Fechada' } }),
        prisma.setting.findUnique({ where: { key: 'productivityRules' } }),
        prisma.setting.findMany({ where: { key: { startsWith: `leaderAttendance:${range.month}-` } } })
      ]);
      return res.json({ data: buildSummary({
        workOrders,
        employees,
        occurrences,
        measurements,
        activeClients: clients,
        activeEmployees: employees.filter((item) => item.status === 'Ativo').length,
        range,
        productivityRules: mergeProductivityRules(productivitySetting?.value),
        attendanceSettings
      }) });
    }

    const db = await readDb();
    const workOrders = (db.workOrders || []).filter((item) => inRange(item, 'date', range));
    const productivitySetting = (db.settings || []).find((item) => item.key === 'productivityRules');
    const attendanceSettings = (db.settings || []).filter((item) => String(item.key || '').startsWith(`leaderAttendance:${range.month}-`));
    return res.json({ data: buildSummary({
      workOrders,
      employees: db.employees || [],
      occurrences: db.occurrences || [],
      measurements: db.measurements || [],
      activeClients: (db.clients || []).filter((item) => item.status === 'Ativo').length,
      activeEmployees: (db.employees || []).filter((item) => item.status === 'Ativo').length,
      range,
      productivityRules: mergeProductivityRules(productivitySetting?.value),
      attendanceSettings
    }) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
