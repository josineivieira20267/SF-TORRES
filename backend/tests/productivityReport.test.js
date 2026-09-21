const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createProductivityReport } = require('../src/utils/productivityReport');

function dashboard(prisma = {}, database = false, db = {}) {
  const routes = {};
  const router = { use() {}, get: (path, handler) => { routes[path] = handler; } };
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === 'express') return { Router: () => router };
    if (name === '../middlewares/auth') return {};
    if (name === '../db/jsonStore') return { readDb: async () => db };
    if (name === '../db/prisma') return { prisma, hasDatabaseUrl: database };
    if (name === '../utils/productivityReport') return { createProductivityReport };
    throw new Error(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/routes/dashboard'), 'utf8') + '\nmodule.exports = { normalize, specialBonusForEntry, rulesForAssignment, bonusDiscountFor, mergeProductivityRules };', sandbox);
  return { routes, helpers: sandbox.module.exports, rules: sandbox.module.exports.mergeProductivityRules() };
}

const baseOrder = { date: '2026-09-01T10:00:00', client: 'OUTRO', teamMembers: ['Ana'], teamRoles: { Ana: ['Batedores'] } };
const employees = [{ name: 'Ana', role: 'Batedor', team: 'Equipe' }];

test('aggregates 720 orders while returning only the requested 50 details', () => {
  const { helpers, rules } = dashboard();
  const report = createProductivityReport({ employees, absences: { ana: 1 }, rules, helpers, query: { details: 'true', detailOffset: '650' } });
  for (let i = 0; i < 720; i++) report.add({ ...baseOrder, id: String(i), number: `09-${i}` });
  const result = report.finish();
  assert.equal(result.totals.orders, 720);
  assert.equal(result.totals.entries, 720);
  assert.equal(result.totals.bonus, 720 * 8 * 0.75);
  assert.equal(result.rows[0].os, 720);
  assert.equal(result.details.length, 50);
  assert.equal(result.details[0].number, '09-650');
  assert.equal(result.details[0].payable, 6);
});

test('preserves multi-criterion, monthly, Michelin and Daikin calculations', () => {
  const { helpers, rules } = dashboard();
  const report = createProductivityReport({ employees, absences: { ana: 2 }, rules, helpers, query: {} });
  report.add({ ...baseOrder, id: '1', teamRoles: { Ana: ['Equipe PA', 'Batedores', 'Apoio'] } });
  report.add({ ...baseOrder, id: '2', teamRoles: { Ana: ['Equipe PA'] } });
  report.add({ ...baseOrder, id: '3', client: 'MICHELIN', equipment: 'CAMINHÃO' });
  report.add({ ...baseOrder, id: '4', client: 'DAIKIN' });
  const result = report.finish();
  assert.equal(result.rows[0].os, 4);
  assert.equal(result.rows[0].present, 6);
  assert.equal(result.totals.bonus, 75 + 6.5 + 28.09 + 12);
  assert.equal(result.details.length, 0);
});

test('filters old OS and paginates employees without truncating totals or options', () => {
  const { helpers, rules } = dashboard();
  const make = (query) => createProductivityReport({ employees: [], absences: {}, rules, helpers, query });
  const report = make({ offset: '50' });
  const searched = make({ q: '09-08', client: 'MICHELIN', criterion: 'MICHELIN' });
  for (let i = 0; i < 120; i++) {
    const order = { ...baseOrder, id: String(i), number: i === 0 ? '09-08' : `09-${i + 100}`, client: 'MICHELIN', teamMembers: [`Pessoa ${i}`] };
    report.add(order); searched.add(order);
  }
  assert.equal(report.finish().rows.length, 50);
  assert.equal(report.finish().totals.employees, 120);
  assert.equal(searched.finish().totals.orders, 1);
  assert.equal(searched.finish().options.employees.length, 120);
});

test('database endpoint traverses every batch and preserves leader restrictions', async () => {
  const orders = Array.from({ length: 1205 }, (_, i) => ({ ...baseOrder, id: String(i), number: `OS-${i}` }));
  const queries = [];
  const { routes } = dashboard({
    employee: { findMany: async () => employees },
    setting: { findUnique: async () => null },
    employeeAttendance: { findMany: async () => [] },
    workOrder: { findMany: async (query) => {
      queries.push(query);
      const start = query.cursor ? Number(query.cursor.id) + 1 : 0;
      return orders.slice(start, start + query.take);
    } }
  }, true);
  let result;
  await routes['/productivity']({ query: { from: '2026-09-01', to: '2026-09-30', details: 'true', detailOffset: '1200' }, user: { role: 'Líder', name: 'Ana' } }, { json: (payload) => { result = payload.data; } }, (error) => { throw error; });
  assert.equal(queries.length, 3);
  assert.equal(result.totals.orders, 1205);
  assert.equal(result.details.length, 5);
  assert.equal(result.totals.bonus, 1205 * 8);
  assert.ok(queries.every((query) => query.take === 500 && query.where.AND[0].OR[0].responsible.contains === 'Ana'));
  assert.equal(queries[0].where.date.gte, '2026-09-01T00:00:00');
});

test('JSON endpoint restricts the period and includes legacy absence discounts', async () => {
  const { routes } = dashboard({}, false, {
    employees, workOrders: [{ ...baseOrder, id: '1' }, { ...baseOrder, id: '2', date: '2026-08-01T10:00:00' }],
    settings: [{ key: 'leaderAttendance:2026-09-01', value: { attendance: { Ana: { status: 'Falta' } } } }]
  });
  let result;
  await routes['/productivity']({ query: { from: '2026-09-01', to: '2026-09-30' }, user: { role: 'Administrador' } }, { json: (payload) => { result = payload.data; } }, (error) => { throw error; });
  assert.equal(result.totals.orders, 1);
  assert.equal(result.totals.absences, 1);
  assert.equal(result.totals.bonus, 6);
});
