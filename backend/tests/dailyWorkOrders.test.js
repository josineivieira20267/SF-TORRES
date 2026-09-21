const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { dailyFilters, dailyJsonFilters } = require('../src/utils/dailyWorkOrders');

function controller(items, database = false, prisma = {}) {
  const sandbox = { module: { exports: {} }, require: (name) => {
    if (name === 'nanoid') return { nanoid: () => 'id' };
    if (name === '../db/jsonStore') return { readDb: async () => ({ workOrders: items }) };
    if (name === '../db/prisma') return { hasDatabaseUrl: database, prisma };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/utils/crud'), 'utf8'), sandbox);
  return sandbox.module.exports.createController('workOrders', [], 'workOrder', {
    dateField: 'date', filterKeys: ['clients', 'search', 'tableSearch', 'dailyStatus'],
    applyJsonFilters: dailyJsonFilters, applyPrismaWhere: dailyFilters,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    sortJson: (a, b) => b.id.localeCompare(a.id)
  });
}

test('old Michelin orders remain reachable beyond 500 orders, with bounded pages and correct total', async () => {
  const items = Array.from({ length: 720 }, (_, i) => ({
    id: String(i).padStart(4, '0'), number: `09-${i}`, client: i < 120 ? 'MICHELIN' : 'OUTRO',
    date: '2026-09-01T10:00:00', status: 'Finalizado'
  }));
  const list = controller(items);
  const ids = [];
  for (const offset of [0, 50, 100]) {
    await list.list({ query: { clients: '["MICHELIN"]', limit: '50', offset: String(offset), from: '2026-09-01', to: '2026-09-30' } }, {
      json: (payload) => {
        assert.equal(payload.meta.total, 120);
        assert.ok(payload.data.length <= 50);
        ids.push(...payload.data.map((row) => row.id));
      }
    }, (error) => { throw error; });
  }
  assert.equal(new Set(ids).size, 120);
  assert.ok(ids.includes('0008'));
});

test('multiple clients, status and both searches filter before pagination', () => {
  const items = [
    { client: 'MICHELIN', number: '09-08', equipment: 'CARRETA', status: 'Finalizado' },
    { client: 'OUTRO', number: '09-08', equipment: 'CARRETA', status: 'Programado' }
  ];
  assert.deepEqual(dailyJsonFilters(items, { clients: '["MICHELIN","OUTRO"]', dailyStatus: 'Finalizado', search: '09-08', tableSearch: 'carreta' }), [items[0]]);
});

test('database query applies filters, stable ordering and pagination together', async () => {
  let args;
  const list = controller([], true, { workOrder: {
    findMany: async (query) => { args = query; return []; }, count: async () => 120
  } });
  await list.list({ query: { clients: '["MICHELIN"]', limit: '50', offset: '100', from: '2026-09-01' } }, {
    json: (payload) => assert.equal(payload.meta.total, 120)
  }, (error) => { throw error; });
  assert.equal(args.take, 50);
  assert.equal(args.skip, 100);
  assert.equal(args.where.AND[0].OR[0].client.equals, 'MICHELIN');
  assert.equal(args.where.date.gte, '2026-09-01');
  assert.equal(args.orderBy[1].id, 'desc');
  const restricted = dailyFilters({ AND: [{ responsible: 'Lider' }] }, { clients: '["MICHELIN"]' });
  assert.equal(restricted.AND[0].responsible, 'Lider');
});
