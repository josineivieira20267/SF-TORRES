const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { createController, buildWhere, normalize } = require('../utils/crud');

const router = express.Router();

const workOrderSearchFields = ['number', 'client', 'equipment', 'service', 'status', 'carrier', 'responsible', 'product'];
const workOrderFilterKeys = ['mine', 'statusGroup'];

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
  return String(query.mine || '').toLowerCase() === 'true' && !normalize(req.user?.role).includes('administrador');
}

function workOrderMineWhere(query, req) {
  if (!shouldRestrictToLoggedUser(query, req)) return null;
  const terms = [req.user?.name, req.user?.email].filter(Boolean);
  if (!terms.length) return { id: '__none__' };
  return {
    OR: terms.flatMap((term) => [
      { responsible: { contains: String(term), mode: 'insensitive' } },
      { carrier: { contains: String(term), mode: 'insensitive' } }
    ])
  };
}

function workOrderStatusWhere(statusGroup) {
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
    result = result.filter((item) => terms.some((term) => normalize(`${item.responsible} ${item.carrier}`).includes(term)));
  }
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
  const rows = await prisma.workOrder.findMany({ where: baseWhere, select: { status: true } });
  return { statusCounts: workOrderStatusCountsFromItems(rows) };
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
  return { statusCounts: workOrderStatusCountsFromItems(filtered) };
}

function nextServiceCodeFrom(items) {
  const nextNumber = items.reduce((max, item) => {
    const match = String(item.code || '').match(/^SV-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `SV-${String(nextNumber).padStart(3, '0')}`;
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
    metaJson: workOrderMetaJson
  }),
  measurements: createController('measurements', ['number', 'client', 'workOrder', 'status'], 'measurement'),
  occurrences: createController('occurrences', ['workOrder', 'employeeName', 'attendanceDate', 'type', 'description', 'status'], 'occurrence'),
  schedules: createController('schedules', ['employee', 'role', 'base', 'status'], 'schedule'),
  settings: createController('settings', ['key'], 'setting')
};

router.use(requireAuth);

for (const [route, controller] of Object.entries(resources)) {
  router.get(`/${route}`, controller.list);
  router.post(`/${route}`, controller.create);
  router.get(`/${route}/:id`, controller.get);
  router.put(`/${route}/:id`, controller.update);
  router.delete(`/${route}/:id`, controller.remove);
}

module.exports = router;
