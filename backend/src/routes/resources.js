const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { createController, buildWhere, normalize } = require('../utils/crud');
const { createOverview } = require('../utils/operationOverview');
const { readDb } = require('../db/jsonStore');
const { dailyFilters, dailyJsonFilters } = require('../utils/dailyWorkOrders');

const router = express.Router();

const workOrderSearchFields = ['number', 'client', 'equipment', 'service', 'status', 'carrier', 'responsible', 'product'];
const workOrderFilterKeys = ['mine', 'statusGroup', 'overview', 'today'];

const finalStatusWhere = [
  { status: { contains: 'finaliz', mode: 'insensitive' } },
  { status: { contains: 'conclu', mode: 'insensitive' } }
];
const canceledStatusWhere = [
  { status: { contains: 'cancel', mode: 'insensitive' } }
];

function appendAnd(where, condition) {
  if (!condition) return where;
  return { ...where, AND: [...(Array.isArray(where.AND) ? where.AND : []), condition] };
}

function shouldRestrictToLoggedUser(query, req) {
  const role = normalize(req.user?.role);
  if (role.includes('administrador')) return false;
  return role.includes('lider') || String(query.mine || '').toLowerCase() === 'true';
}

function workOrderMineWhere(query, req) {
  if (!shouldRestrictToLoggedUser(query, req)) return null;
  const terms = [req.user?.name, req.user?.email].filter(Boolean);
  if (!terms.length) return { id: '__none__' };
  return {
    OR: terms.map((term) => ({ responsible: { contains: String(term), mode: 'insensitive' } }))
  };
}

function workOrderStatusWhere(statusGroup) {
  if (statusGroup === 'Aguardando') return { OR: ['Programado', 'Rascunho', 'Enviada', 'Aprovada'].map((status) => ({ status: { equals: status, mode: 'insensitive' } })) };
  if (statusGroup === 'Fila') return { OR: ['Programado', 'Rascunho', 'Enviada', 'Aprovada', 'Em execucao'].map((status) => ({ status: { equals: status, mode: 'insensitive' } })) };
  if (statusGroup === 'Finalizados') return { OR: finalStatusWhere };
  if (statusGroup === 'Abertos') return { NOT: { OR: [...finalStatusWhere, ...canceledStatusWhere] } };
  return null;
}

function applyWorkOrderPrismaWhere(where, query, req) {
  let nextWhere = appendAnd(where, workOrderMineWhere(query, req));
  nextWhere = appendAnd(nextWhere, workOrderStatusWhere(query.statusGroup));
  return nextWhere;
}

function applyWorkOrderJsonFilters(items, query, req) {
  let result = [...items];
  if (shouldRestrictToLoggedUser(query, req)) {
    const terms = [req.user?.name, req.user?.email].map(normalize).filter(Boolean);
    result = result.filter((item) => terms.some((term) => normalize(item.responsible).includes(term)));
  }
  if (query.statusGroup === 'Aguardando') result = result.filter((item) => ['programado', 'rascunho', 'enviada', 'aprovada'].includes(normalize(item.status)));
  if (query.statusGroup === 'Fila') result = result.filter((item) => ['programado', 'rascunho', 'enviada', 'aprovada', 'em execucao'].includes(normalize(item.status)));
  if (query.statusGroup === 'Finalizados') {
    result = result.filter((item) => normalize(item.status).includes('finaliz') || normalize(item.status).includes('conclu'));
  } else if (query.statusGroup === 'Abertos') {
    result = result.filter((item) => {
      const status = normalize(item.status);
      return !status.includes('finaliz') && !status.includes('conclu') && !status.includes('cancel');
    });
  }
  return result;
}

function workOrderStatusCountsFromItems(items) {
  return items.reduce((acc, item) => {
    const status = normalize(item.status);
    const final = status.includes('finaliz') || status.includes('conclu');
    const canceled = status.includes('cancel');
    if (final) acc.finalizados += 1;
    if (!final && !canceled) acc.abertos += 1;
    acc.todos += 1;
    return acc;
  }, { abertos: 0, finalizados: 0, todos: 0 });
}

async function workOrderMetaPrisma(query, req) {
  if (!hasDatabaseUrl) return {};
  const baseQuery = { ...query, statusGroup: '' };
  const baseWhere = applyWorkOrderPrismaWhere(
    buildWhere(baseQuery, workOrderSearchFields, { dateField: 'date', filterKeys: workOrderFilterKeys }),
    baseQuery,
    req
  );
  if (query.overview) {
    const overview = createOverview(query);
    let cursor;
    while (true) {
      const rows = await prisma.workOrder.findMany({ where: baseWhere, take: 500, orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, status: true, date: true, client: true, teamMembers: true } });
      rows.forEach((row) => overview.add(row));
      if (rows.length < 500) break;
      cursor = rows[rows.length - 1].id;
    }
    return overview.finish();
  }
  const groups = await prisma.workOrder.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } });
  return { statusCounts: groups.reduce((counts, group) => {
    const row = workOrderStatusCountsFromItems([group]);
    for (const key of Object.keys(counts)) counts[key] += row[key] * group._count._all;
    return counts;
  }, { abertos: 0, finalizados: 0, todos: 0 }) };
}

async function workOrderMetaJson(items, query, req) {
  const baseQuery = { ...query, statusGroup: '' };
  let filtered = [...items];
  if (baseQuery.q) {
    const needle = normalize(baseQuery.q);
    filtered = filtered.filter((item) => workOrderSearchFields.some((field) => normalize(item[field]).includes(needle)));
  }
  if (baseQuery.from || baseQuery.to) {
    filtered = filtered.filter((item) => {
      const value = String(item.date || '');
      if (!value) return false;
      if (baseQuery.from && value < String(baseQuery.from)) return false;
      if (baseQuery.to && value > String(baseQuery.to)) return false;
      return true;
    });
  }
  filtered = applyWorkOrderJsonFilters(filtered, baseQuery, req);
  if (query.overview) {
    const overview = createOverview(query);
    filtered.forEach((item) => overview.add(item));
    return overview.finish();
  }
  return { statusCounts: workOrderStatusCountsFromItems(filtered) };
}

function nextServiceCodeFrom(items) {
  const nextNumber = items.reduce((max, item) => {
    const match = String(item.code || '').match(/^SV-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `SV-${String(nextNumber).padStart(3, '0')}`;
}

function normalizedUniqueValue(value) {
  return normalize(value).trim();
}

function duplicateWorkOrderError() {
  const error = new Error('Ja existe uma OS com este numero para este cliente');
  error.status = 409;
  return error;
}

function validateWorkOrderContainer(data) {
  if (normalize(data.equipment).includes('container') && !String(data.containerNumber || '').trim()) {
    const error = new Error('Preencha o campo obrigatorio: Numero do container');
    error.status = 400;
    throw error;
  }
}

function workOrderStatusFromDates(order) {
  if (String(order.operationEnd || '').trim()) return 'Finalizado';
  if (String(order.operationStart || '').trim()) return 'Em execucao';
  return order.status;
}

async function ensureUniqueWorkOrderByClient(data, req) {
  const { readDb } = require('../db/jsonStore');
  let candidate = data;

  if (req.params.id) {
    if (hasDatabaseUrl) {
      const current = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
      if (current) candidate = { ...current, ...data };
    } else {
      const db = await readDb();
      const current = (db.workOrders || []).find((item) => item.id === req.params.id);
      if (current) candidate = { ...current, ...data };
    }
  }

  const datesChanged = Object.hasOwn(data, 'operationStart') || Object.hasOwn(data, 'operationEnd');
  if (datesChanged && !candidate.operationStart && !candidate.operationEnd && !Object.hasOwn(data, 'status')) candidate.status = 'Programado';
  const status = workOrderStatusFromDates(candidate);
  if (status !== undefined) data = { ...data, status };
  validateWorkOrderContainer(candidate);

  const number = normalizedUniqueValue(candidate.number);
  const client = normalizedUniqueValue(candidate.client);
  if (!number || !client) return data;

  if (hasDatabaseUrl) {
    const orders = await prisma.workOrder.findMany({
      select: { id: true, number: true, client: true }
    });
    const exists = orders.some((item) =>
      item.id !== req.params.id &&
      normalizedUniqueValue(item.number) === number &&
      normalizedUniqueValue(item.client) === client
    );
    if (exists) throw duplicateWorkOrderError();
    return data;
  }

  const db = await readDb();
  const exists = (db.workOrders || []).some((item) =>
    item.id !== req.params.id &&
    normalizedUniqueValue(item.number) === number &&
    normalizedUniqueValue(item.client) === client
  );
  if (exists) throw duplicateWorkOrderError();
  return data;
}

async function prepareServiceCreate(data) {
  if (String(data.code || '').trim()) return data;
  if (hasDatabaseUrl) {
    const services = await prisma.service.findMany({ select: { code: true } });
    return { ...data, code: nextServiceCodeFrom(services) };
  }
  const { readDb } = require('../db/jsonStore');
  const db = await readDb();
  return { ...data, code: nextServiceCodeFrom(db.services || []) };
}

const resources = {
  clients: createController('clients', ['name', 'legalName', 'cnpj', 'contact', 'city', 'status'], 'client'),
  employees: createController('employees', ['name', 'role', 'location', 'shift', 'regime', 'status'], 'employee'),
  services: createController('services', ['code', 'description', 'category'], 'service', { prepareCreate: prepareServiceCreate }),
  equipment: createController('equipment', ['code', 'type', 'model', 'status'], 'equipment'),
  locations: createController('locations', ['code', 'description', 'client', 'address', 'status'], 'location'),
  workOrders: createController('workOrders', workOrderSearchFields, 'workOrder', {
    dateField: 'date',
    filterKeys: workOrderFilterKeys,
    applyPrismaWhere: applyWorkOrderPrismaWhere,
    applyJsonFilters: applyWorkOrderJsonFilters,
    metaPrisma: workOrderMetaPrisma,
    metaJson: workOrderMetaJson,
    prepareCreate: ensureUniqueWorkOrderByClient,
    prepareUpdate: ensureUniqueWorkOrderByClient
  }),
  measurements: createController('measurements', ['number', 'client', 'workOrder', 'status'], 'measurement'),
  occurrences: createController('occurrences', ['workOrder', 'employeeName', 'attendanceDate', 'type', 'description', 'status'], 'occurrence', {
    filterKeys: ['workOrders'],
    applyPrismaWhere: (where, query) => query.workOrders ? { ...where, workOrder: { in: JSON.parse(query.workOrders) } } : where,
    applyJsonFilters: (items, query) => query.workOrders ? items.filter((item) => JSON.parse(query.workOrders).includes(item.workOrder)) : items
  }),
  schedules: createController('schedules', ['employee', 'role', 'base', 'status'], 'schedule'),
  settings: createController('settings', ['key'], 'setting')
};

router.use(requireAuth);

// Compact option lists: no employee personal details or full customer records.
for (const [route, collection, model, fields] of [
  ['clients', 'clients', 'client', ['id', 'name', 'legalName']],
  ['equipment', 'equipment', 'equipment', ['id', 'code', 'type']],
  ['services', 'services', 'service', ['id', 'description', 'code']],
  ['leaders', 'employees', 'employee', ['id', 'name']]
]) {
  router.get(`/lookups/${route}`, createController(collection, ['name'], model, {
    select: Object.fromEntries(fields.map((key) => [key, true])),
    ...(route === 'leaders' ? {
      applyPrismaWhere: (where) => appendAnd(where, { OR: ['lider', 'líder'].map((term) => ({ role: { contains: term, mode: 'insensitive' } })) }),
      applyJsonFilters: (items) => items.filter((item) => normalize(item.role).includes('lider'))
    } : {})
  }).list);
}

router.get('/notificationOccurrences', async (req, res, next) => {
  try {
    if (!hasDatabaseUrl && normalize(req.user?.role).includes('lider')) {
      const db = await readDb();
      req.notificationNumbers = new Set(applyWorkOrderJsonFilters(db.workOrders || [], { mine: true }, req).map((order) => order.number));
    }
    next();
  } catch (error) { next(error); }
}, createController('occurrences', [], 'occurrence', {
  applyPrismaWhere: async (where, query, req) => {
    const pending = { ...where, NOT: { OR: ['Resolvida', 'Aprovada'].map((status) => ({ status: { equals: status, mode: 'insensitive' } })) } };
    if (!normalize(req.user?.role).includes('lider')) return pending;
    const terms = [req.user?.name, req.user?.email].filter(Boolean);
    const orders = terms.length ? await prisma.workOrder.findMany({ where: { OR: terms.map((term) => ({ responsible: { contains: term, mode: 'insensitive' } })) }, select: { number: true } }) : [];
    return { ...pending, workOrder: { in: orders.map((order) => order.number) } };
  },
  applyJsonFilters: (items, query, req) => items.filter((item) => !['resolvida', 'aprovada'].includes(normalize(item.status)) && (!req.notificationNumbers || req.notificationNumbers.has(item.workOrder))),
}).list);


// Apply daily-operation filters before pagination; keep permission restrictions.
router.get('/dailyWorkOrders', createController('workOrders', workOrderSearchFields, 'workOrder', {
  dateField: 'date',
  filterKeys: [...workOrderFilterKeys, 'clients', 'dailyStatus', 'search', 'tableSearch'],
  orderBy: [{ date: 'desc' }, { id: 'desc' }],
  sortJson: (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)),
  applyPrismaWhere: (where, query, req) => dailyFilters(applyWorkOrderPrismaWhere(where, query, req), query),
  applyJsonFilters: (items, query, req) => dailyJsonFilters(applyWorkOrderJsonFilters(items, query, req), query),
  metaPrisma: async (query, req) => {
    const rows = await prisma.workOrder.groupBy({ by: ['client'], where: workOrderMineWhere(query, req) || {} });
    return { clients: rows.map((row) => row.client).filter(Boolean).sort() };
  },
  metaJson: async (items, query, req) => ({ clients: [...new Set(applyWorkOrderJsonFilters(items, { mine: query.mine }, req).map((item) => item.client).filter(Boolean))].sort() })
}).list);

for (const [route, controller] of Object.entries(resources)) {
  router.get(`/${route}`, controller.list);
  router.post(`/${route}`, controller.create);
  router.get(`/${route}/:id`, controller.get);
  router.put(`/${route}/:id`, controller.update);
  router.delete(`/${route}/:id`, controller.remove);
}

module.exports = router;
