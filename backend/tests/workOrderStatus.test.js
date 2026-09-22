const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../src/routes/resources'), 'utf8');
function prepare(database, current) {
  const sandbox = {
    hasDatabaseUrl: database,
    prisma: { workOrder: { findUnique: async () => current, findMany: async () => [] } },
    require: () => ({ readDb: async () => ({ workOrders: current ? [current] : [] }) }),
    normalize: (value) => String(value || '').toLowerCase(),
  };
  vm.runInNewContext(source.slice(source.indexOf('function normalizedUniqueValue'), source.indexOf('async function prepareServiceCreate')), sandbox);
  return (data) => sandbox.ensureUniqueWorkOrderByClient(data, { params: current ? { id: current.id } : {} });
}

for (const database of [false, true]) {
  test(`operation dates determine persisted status (${database ? 'Postgres' : 'JSON'})`, async () => {
    const create = prepare(database);
    assert.equal((await create({ status: 'Programado', operationEnd: '2026-09-22T12:00' })).status, 'Finalizado');
    assert.equal((await create({ status: 'Finalizado', operationStart: '2026-09-22T10:00' })).status, 'Em execucao');
    assert.equal((await create({ status: 'Cancelado' })).status, 'Cancelado');
    const update = prepare(database, { id: '1', number: 'OS1', client: 'Cliente', operationStart: '2026-09-22T10:00', operationEnd: '2026-09-22T12:00', status: 'Programado' });
    assert.equal((await update({ status: 'Em execucao' })).status, 'Finalizado');
    assert.equal((await update({ operationEnd: '' })).status, 'Em execucao');
    assert.equal((await update({ operationStart: '', operationEnd: '' })).status, 'Programado');
    assert.equal((await update({ carrier: 'Transportador' })).status, 'Finalizado');
  });
}
