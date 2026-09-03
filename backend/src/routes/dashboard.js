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
    { key: 'bipador', name: 'Bipador', base: 8, mode: 'per-os', match: 'bipador, bipadores' },
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
  },
  daikin: {
    enabled: true,
    client: 'DAIKIN',
    value: 12
  }
};

function mergeProductivityRules(value) {
  const saved = value && typeof value === 'object' ? value : {};
  const savedStandard = Array.isArray(saved.standard) ? saved.standard : [];
  const mergedStandard = defaultProductivityRules.standard.map((defaultRule) => savedStandard.find((rule) => normalize(rule.key) === normalize(defaultRule.key) || normalize(rule.name) === normalize(defaultRule.name)) || defaultRule);
  savedStandard.forEach((rule) => {
    if (!mergedStandard.some((item) => normalize(item.key) === normalize(rule.key) || normalize(item.name) === normalize(rule.name))) mergedStandard.push(rule);
  });
  return {
    standard: mergedStandard,
    michelin: { ...defaultProductivityRules.michelin, ...(saved.michelin || {}) },
    daikin: { ...defaultProductivityRules.daikin, ...(saved.daikin || {}) }
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

function isDaikinOrder(order, rules = defaultProductivityRules) {
  const config = rules.daikin || defaultProductivityRules.daikin;
  return Boolean(config.enabled) && normalize(order?.client) === normalize(config.client);
}

function isSpecialBonusOrder(order, rules = defaultProductivityRules) {
  return isMichelinOrder(order, rules) || isDaikinOrder(order, rules);
}

function workOrderIdentity(order = {}) {
  return order.id || `${normalize(order.client)}:${normalize(order.number)}`;
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

function displayDate(value) {
  if (!value) return '';
  const raw = String(value);
  const br = raw.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (br) return br[1];
  const [year, month, day] = raw.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : raw;
}

function displayDateTime(value) {
  if (!value) return '';
  const raw = String(value);
  const br = raw.match(/^(\d{2}\/\d{2}\/\d{4})(?:,?\s+(\d{2}:\d{2}))?/);
  if (br) return br[2] ? `${br[1]} ${br[2]}` : br[1];
  const [datePart, timePart = ''] = raw.split('T');
  const [year, month, day] = datePart.split('-');
  const date = year && month && day ? `${day}/${month}/${year}` : datePart;
  return timePart ? `${date} ${timePart.slice(0, 5)}` : date;
}

function durationText(order) {
  const hours = durationHours(order);
  if (!hours) return '00:00:00';
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function timeMinutes(value) {
  const match = String(value || '').match(/(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function scheduledWeekday(value) {
  const text = String(value || '');
  const br = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const raw = br ? `${br[3]}-${br[2]}-${br[1]}` : text.slice(0, 10);
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
  const payableMembers = members;
  if (!payableMembers.includes(name) || !payableMembers.length) return 0;
  return total / payableMembers.length;
}

function daikinShareForEntry(order, name, employeeByName, rules = defaultProductivityRules) {
  const config = rules.daikin || defaultProductivityRules.daikin;
  if (!config.enabled || normalize(order?.client) !== normalize(config.client)) return null;
  const members = Array.isArray(order.teamMembers) ? order.teamMembers : Object.keys(order.attendance || {});
  if (!members.includes(name) || !members.length) return 0;
  return Number(config.value || 0) / members.length;
}

function specialBonusForEntry(order, name, employeeByName, rules = defaultProductivityRules) {
  const michelinShare = michelinShareForEntry(order, name, employeeByName, rules);
  if (michelinShare !== null) return { key: 'michelin', name: 'MICHELIN', share: michelinShare };
  if (isMichelinOrder(order, rules)) return { key: 'michelin', name: 'MICHELIN', share: 0 };
  const daikinShare = daikinShareForEntry(order, name, employeeByName, rules);
  if (daikinShare !== null) return { key: 'daikin', name: 'DAIKIN', share: daikinShare };
  return null;
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

function rangeFromQuery(query) {
  if (query.from || query.to) {
    const now = monthRange(query.month);
    const from = String(query.from || now.from.slice(0, 10)).slice(0, 10);
    const to = String(query.to || now.to.slice(0, 10)).slice(0, 10);
    return {
      month: from.slice(0, 7),
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`
    };
  }
  return monthRange(query.month);
}

function attendanceByName(attendanceRows = []) {
  const byNameDate = {};
  attendanceRows.forEach((row) => {
    const status = normalize(row.status);
    if (status !== 'presente' && status !== 'falta') return;
    byNameDate[`${normalize(row.employeeName)}:${row.date}`] = { name: row.employeeName, status: row.status };
  });
  return Object.values(byNameDate).reduce((result, item) => {
    const key = normalize(item.name);
    result[key] = result[key] || { present: 0, absences: 0 };
    const status = normalize(item.status);
    if (status === 'presente') result[key].present += 1;
    if (status === 'falta') result[key].absences += 1;
    return result;
  }, {});
}

function workOrderAttendanceStatus(order, name) {
  const value = order?.attendance?.[name];
  const status = typeof value === 'object' ? value?.status : value;
  return status || 'Presente';
}

function equipmentLabel(order) {
  const text = normalize(`${order.equipment || ''} ${order.equipmentType || ''}`);
  if (text.includes('container') || text.includes('conteiner')) return 'CONTEINER';
  if (text.includes('carreta')) return 'CARRETA';
  if (text.includes('caminh') || text.includes('truck')) return 'CAMINHAO';
  return String(order.equipment || '').trim();
}

function numberingLabel(order) {
  return order.containerNumber || order.trailerPlate || order.numbering || '';
}

function sheetNameForClient(client, usedNames) {
  const base = String(client || 'SEM CLIENTE').replace(/[:\\/?*\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'SEM CLIENTE';
  let name = base;
  let index = 2;
  while (usedNames.has(normalize(name))) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(normalize(name));
  return name;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlCell(value) {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function buildExcelXml(sheets) {
  const worksheets = sheets.map((sheet) => `
    <Worksheet ss:Name="${escapeXml(sheet.name)}">
      <Table>
        ${(sheet.rows || []).map((row) => `<Row>${row.map(xmlCell).join('')}</Row>`).join('')}
      </Table>
    </Worksheet>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/></Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function buildProductivityExport({ workOrders, employees, attendanceRows, productivityRules, query }) {
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const callsByName = attendanceByName(attendanceRows);
  const headers = [
    'OS N° ST',
    'DATA DA OPERAÇÃO',
    'NOME COLABORADOR',
    'VALOR DA OPERAÇÃO',
    'FUNÇÃO',
    'PRODUTO',
    'ARMADOR',
    'SERVIÇO',
    'EQUIPAMENTO',
    'INCIO DA OPERAÇÃO',
    'TERMINO DA OPERAÇÃO',
    'DURAÇÃO DA OPERAÇÃO',
    'NUMERAÇÃO',
    'QUANTIDADE MÃO DE OBRA'
  ];
  const rows = workOrders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : Object.keys(order.attendance || {});
    return members.flatMap((name) => {
      const employee = employeeByName[normalize(name)] || { name, role: '', team: '' };
      const special = specialBonusForEntry(order, name, employeeByName, productivityRules);
      const criteria = special
        ? [{ key: special.key, name: special.name, base: special.share, mode: 'per-os', match: special.key }]
        : (rulesForAssignment(order.teamRoles?.[name], productivityRules).length
          ? rulesForAssignment(order.teamRoles?.[name], productivityRules)
          : [bonusCriterionFor(employee, productivityRules)]);
      return criteria.map((criterion) => {
        const status = workOrderAttendanceStatus(order, name);
        const absences = callsByName[normalize(name)]?.absences || 0;
        const payable = normalize(status) === 'falta' || normalize(status) === 'pendente' || criterion.mode === 'monthly'
          ? 0
          : Number(special?.share ?? (Number(criterion.base || 0) * bonusDiscountFor(absences)));
        const label = special?.name || criterion.name;
        return {
          order,
          name,
          label,
          status,
          row: [
            order.number,
            displayDate(order.date),
            name,
            `R$ ${payable.toFixed(2).replace('.', ',')}`,
            label,
            order.product,
            order.carrier,
            order.service,
            equipmentLabel(order),
            displayDateTime(order.operationStart),
            displayDateTime(order.operationEnd),
            durationText(order),
            numberingLabel(order),
            members.length || ''
          ]
        };
      });
    });
  }).filter((entry) => {
    const text = normalize(`${entry.order.number} ${entry.order.client} ${entry.order.service} ${entry.order.date} ${entry.name} ${entry.label}`);
    const queryOk = !query.q || text.includes(normalize(query.q));
    const employeeOk = !query.employee || query.employee === 'Todos' || entry.name === query.employee;
    const clientOk = !query.client || query.client === 'Todos' || entry.order.client === query.client;
    const serviceOk = !query.service || query.service === 'Todos' || entry.order.service === query.service;
    const criterionOk = !query.criterion || query.criterion === 'Todos' || normalize(entry.label).includes(normalize(query.criterion));
    const statusOk = !query.status || query.status === 'Todos' || normalize(entry.status) === normalize(query.status);
    return queryOk && employeeOk && clientOk && serviceOk && criterionOk && statusOk;
  }).sort((a, b) =>
    String(a.order.client || '').localeCompare(String(b.order.client || '')) ||
    String(a.order.date || '').localeCompare(String(b.order.date || '')) ||
    String(a.order.number || '').localeCompare(String(b.order.number || '')) ||
    a.name.localeCompare(b.name)
  );

  const usedNames = new Set();
  const grouped = rows.reduce((acc, entry) => {
    const client = entry.order.client || 'SEM CLIENTE';
    acc[client] = acc[client] || [];
    acc[client].push(entry.row);
    return acc;
  }, {});
  const sheets = Object.entries(grouped).map(([client, clientRows]) => ({
    name: sheetNameForClient(client, usedNames),
    rows: [headers, ...clientRows]
  }));
  return sheets.length ? sheets : [{ name: 'SEM DADOS', rows: [headers] }];
}

function buildSummary({ workOrders, employees, occurrences, measurements, activeClients, activeEmployees, range, productivityRules = defaultProductivityRules, attendanceRows = [] }) {
  const byStatus = workOrders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const callsByName = attendanceByName(attendanceRows);
  const memberEntries = workOrders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
    return members.flatMap((name) => {
      const special = specialBonusForEntry(order, name, employeeByName, productivityRules);
      if (special) return [{ order, name, criterion: { key: special.key, name: special.name, base: 0, mode: 'per-os', match: special.key } }];
      const assignedRules = rulesForAssignment(order.teamRoles?.[name], productivityRules);
      const roles = assignedRules.length ? assignedRules : [{ key: 'none', name: 'Sem criterio', base: 0, mode: 'per-os', match: '' }];
      return roles.map((criterion) => ({ order, name, criterion }));
    });
  });
  const productivity = Object.values(memberEntries.reduce((acc, entry) => {
    const key = normalize(entry.name);
    const employee = employeeByName[key] || { name: entry.name, role: '-', team: '-' };
    const special = specialBonusForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = entry.criterion;
    acc[key] = acc[key] || { employee, criterion, criteria: new Set(), osSet: new Set(), michelinSet: new Set(), os: 0, present: 0, absences: callsByName[key]?.absences || 0, pending: 0, customBonus: 0, standardBonus: 0 };
    acc[key].criteria.add(criterion.name);
    acc[key].osSet.add(workOrderIdentity(entry.order));
    acc[key].present += 1;
    if (!special && criterion.mode !== 'monthly') acc[key].standardBonus += Number(criterion.base || 0);
    const michelinKey = `${special?.key || 'standard'}:${workOrderIdentity(entry.order)}:${entry.name}`;
    if (special && !acc[key].michelinSet.has(michelinKey)) {
      acc[key].customBonus += special.share;
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
  const openOccurrences = occurrences.filter((item) => !item.attendanceDate && !normalize(item.status).includes('resolvida') && !normalize(item.status).includes('aprovada'));
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
        { label: 'Faltas', value: totalAbsences }
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
      const [workOrders, clients, employees, occurrences, measurements, productivitySetting, attendanceRows] = await Promise.all([
        prisma.workOrder.findMany({ where: { date: { gte: range.from, lte: range.to } } }),
        prisma.client.count({ where: { status: 'Ativo' } }),
        prisma.employee.findMany(),
        prisma.occurrence.findMany(),
        prisma.measurement.findMany({ where: { status: 'Fechada' } }),
        prisma.setting.findUnique({ where: { key: 'productivityRules' } }),
        prisma.employeeAttendance.findMany({ where: { date: { startsWith: `${range.month}-` } } })
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
        attendanceRows
      }) });
    }

    const db = await readDb();
    const workOrders = (db.workOrders || []).filter((item) => inRange(item, 'date', range));
    const productivitySetting = (db.settings || []).find((item) => item.key === 'productivityRules');
    return res.json({ data: buildSummary({
      workOrders,
      employees: db.employees || [],
      occurrences: db.occurrences || [],
      measurements: db.measurements || [],
      activeClients: (db.clients || []).filter((item) => item.status === 'Ativo').length,
      activeEmployees: (db.employees || []).filter((item) => item.status === 'Ativo').length,
      range,
      productivityRules: mergeProductivityRules(productivitySetting?.value),
      attendanceRows: db.employeeAttendances || []
    }) });
  } catch (error) {
    return next(error);
  }
});

router.get('/productivity-export', async (req, res, next) => {
  try {
    const range = rangeFromQuery(req.query);

    if (hasDatabaseUrl) {
      const [workOrders, employees, productivitySetting, attendanceRows] = await Promise.all([
        prisma.workOrder.findMany({
          where: { date: { gte: range.from, lte: range.to } },
          orderBy: [{ client: 'asc' }, { date: 'asc' }, { number: 'asc' }]
        }),
        prisma.employee.findMany(),
        prisma.setting.findUnique({ where: { key: 'productivityRules' } }),
        prisma.employeeAttendance.findMany({
          where: { date: { gte: range.from.slice(0, 10), lte: range.to.slice(0, 10) } }
        })
      ]);
      const sheets = buildProductivityExport({
        workOrders,
        employees,
        attendanceRows,
        productivityRules: mergeProductivityRules(productivitySetting?.value),
        query: req.query
      });
      const xml = buildExcelXml(sheets);
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="produtividade-colaboradores.xls"');
      return res.send(`\ufeff${xml}`);
    }

    const db = await readDb();
    const workOrders = (db.workOrders || []).filter((item) => inRange(item, 'date', range));
    const productivitySetting = (db.settings || []).find((item) => item.key === 'productivityRules');
    const sheets = buildProductivityExport({
      workOrders,
      employees: db.employees || [],
      attendanceRows: db.employeeAttendances || [],
      productivityRules: mergeProductivityRules(productivitySetting?.value),
      query: req.query
    });
    const xml = buildExcelXml(sheets);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="produtividade-colaboradores.xls"');
    return res.send(`\ufeff${xml}`);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
