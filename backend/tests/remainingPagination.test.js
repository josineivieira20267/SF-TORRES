const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

function resources(db, prisma = null) {
  const routes = {};
  const router = { use() {}, get: (route, ...handlers) => { routes[route] = handlers; }, post() {}, put() {}, delete() {} };
  const dependencies = {
    nanoid: { nanoid: () => 'id' },
    express: { Router: () => router },
    '../middlewares/auth': {},
    '../db/prisma': { prisma, hasDatabaseUrl: Boolean(prisma) },
    '../db/jsonStore': { readDb: async () => db },
    '../utils/dailyWorkOrders': require('../src/utils/dailyWorkOrders'),
    '../utils/operationOverview': require('../src/utils/operationOverview')
  };
  function load(file) {
    const sandbox = { module: { exports: {} }, require: (name) => {
      if (!(name in dependencies)) throw new Error(name);
      return dependencies[name];
    } };
    vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), sandbox);
    return sandbox.module.exports;
  }
  dependencies['../utils/crud'] = load('../src/utils/crud');
  load('../src/routes/resources');
  return async (route, query = {}, user = { role: 'Administrador' }) => {
    const req = { query, user };
    let response;
    for (const handler of routes[route]) await handler(req, { json: (payload) => { response = payload; } }, (error) => { if (error) throw error; });
    return response;
  };
}

const orders = Array.from({ length: 720 }, (_, i) => ({ id: String(i), number: `09-${i}`, date: '2026-09-21T10:00:00', client: 'MICHELIN', responsible: 'Ana', status: i < 600 ? 'Finalizado' : 'Programado', teamMembers: ['Ana'] }));

test('tower queue filters before pagination and indicators cover all 720 orders', async () => {
  const request = resources({ workOrders: orders });
  const response = await request('/workOrders', { statusGroup: 'Fila', overview: 'tower', limit: '50', offset: '100' });
  assert.equal(response.data.length, 20);
  assert.equal(response.meta.total, 120);
  assert.equal(response.meta.totals.done, 600);
  assert.equal(response.meta.totals.queue, 120);
  assert.equal(response.meta.statusCounts.todos, 720);
  const pending = await request('/workOrders', { statusGroup: 'Aguardando', limit: '1' });
  assert.equal(pending.data[0].number, '09-600');
});

test('schedules aggregates every matching OS and retains leader scope', async () => {
  const request = resources({ workOrders: [...orders, { ...orders[0], id: 'other', responsible: 'Outro' }] });
  const response = await request('/workOrders', { mine: 'true', statusGroup: 'Finalizados', overview: 'schedules', today: '2026-09-21', limit: '50', offset: '550' }, { role: 'Líder', name: 'Ana' });
  assert.equal(response.data.length, 50);
  assert.equal(response.meta.total, 600);
  assert.equal(response.meta.members[0].total, 600);
  assert.equal(response.meta.members[0].today, 600);
  assert.equal(response.meta.totals.total, 600);
  assert.equal(response.meta.statusCounts.todos, 720);
});

test('database overview reads bounded batches independently of the visible page', async () => {
  const calls = [];
  const request = resources({}, { workOrder: {
    count: async () => 120,
    findMany: async (query) => {
      calls.push(query);
      if (!query.select) return orders.slice(600, 650);
      const start = query.cursor ? Number(query.cursor.id) + 1 : 0;
      return orders.slice(start, start + query.take);
    }
  } });
  const result = await request('/workOrders', { overview: 'tower', statusGroup: 'Fila', limit: '50' });
  assert.equal(result.meta.totals.done, 600);
  assert.equal(result.meta.totals.queue, 120);
  assert.equal(calls.filter((call) => call.select).length, 2);
  assert.ok(calls.filter((call) => call.select).every((call) => call.take === 500));
});

test('occurrences scope is applied before paging, including old records', async () => {
  const occurrences = Array.from({ length: 650 }, (_, i) => ({ id: String(i), workOrder: i < 520 ? 'OUTRA' : '09-08' }));
  const response = await resources({ occurrences })('/occurrences', { workOrders: '["09-08"]', limit: '50', offset: '100' });
  assert.equal(response.meta.total, 130);
  assert.equal(response.data.length, 30);
});

test('compact selectors traverse all records and find leaders beyond employee 500', async () => {
  const employees = Array.from({ length: 650 }, (_, i) => ({ id: String(i), name: `Pessoa ${i}`, role: i === 649 ? 'Líder' : 'Apoio', cpf: 'private' }));
  const request = resources({ employees, clients: employees });
  const leaders = await request('/lookups/leaders');
  assert.equal(leaders.meta.total, 1);
  assert.equal(leaders.data[0].name, 'Pessoa 649');
  assert.equal(leaders.data[0].cpf, undefined);
  const clients = await request('/lookups/clients', { limit: '500', offset: '500' });
  assert.equal(clients.data.length, 150);
  assert.equal(clients.meta.total, 650);
  assert.equal(clients.data[0].role, undefined);
});

test('notifications retain older pending occurrences and enforce leader ownership', async () => {
  const occurrences = Array.from({ length: 620 }, (_, i) => ({ id: String(i), status: i < 600 ? 'Resolvida' : 'Aberta', workOrder: i === 619 ? '09-08' : 'OUTRA' }));
  const request = resources({ occurrences, workOrders: [{ number: '09-08', responsible: 'Ana' }] });
  const result = await request('/notificationOccurrences', {}, { role: 'Líder', name: 'Ana' });
  assert.equal(result.meta.total, 1);
  assert.equal(result.data[0].id, '619');
});

test('export helper traverses pages while preserving query and cancellation signal', async () => {
  const { fetchAllPages } = await import(pathToFileURL(path.resolve(__dirname, '../../frontend/src/pagination.js')));
  const calls = [];
  const signal = new AbortController().signal;
  const result = await fetchAllPages(async (endpoint, options) => {
    const url = new URL(endpoint, 'http://local');
    calls.push(url);
    assert.equal(options.signal, signal);
    const offset = Number(url.searchParams.get('offset'));
    return { data: orders.slice(offset, offset + 500), meta: { total: 720 } };
  }, '/api/workOrders?client=MICHELIN&from=2026-09-01', { signal });
  assert.equal(result.data.length, 720);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].searchParams.get('client'), 'MICHELIN');
  assert.equal(calls[1].searchParams.get('offset'), '500');
  await assert.rejects(fetchAllPages(async () => ({ data: [], meta: { total: 3 } }), '/api/workOrders'));
});
