import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from '@babel/parser';
import { transformSync } from 'esbuild';

const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
function component(name, states = new Map()) {
  const node = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === name);
  const code = transformSync(`${source.slice(node.start, node.end)}; module.exports = ${name};`, { loader: 'jsx' }).code;
  let index = 0;
  const sandbox = {
    module: { exports: {} }, React,
    useState: (initial) => [states.has(index) ? states.get(index++) : (index++, initial), () => {}],
    useRef: (current) => ({ current }), useEffect: () => {},
    defaultProductivityRules: { standard: [] },
    monthRange: () => ({ from: '2026-09-01T00:00:00', to: '2026-09-30T23:59:59' }),
    currentMonthValue: () => '2026-09', money: String, date: String, dateTime: String,
    PageHead: ({ title }) => React.createElement('h1', null, title),
    Panel: ({ children }) => React.createElement('section', null, children),
    Kpi: ({ label, value }) => React.createElement('span', null, `${label}: ${value}`),
    Pill: ({ value }) => React.createElement('span', null, value),
    DataTable: ({ rows }) => React.createElement('div', null, rows.flat().map((cell, i) => React.createElement('span', { key: i }, cell)))
  };
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
}

test('Productivity renders its initial loading state without removed variables', () => {
  const html = renderToStaticMarkup(React.createElement(component('Productivity')));
  assert.match(html, /Produtividade dos colaboradores/);
  assert.match(html, /Carregando/);
});

test('Productivity renders loaded totals, criteria and OS details with correct pagination text', () => {
  const report = {
    rows: [{ name: 'Ana', role: 'Apoio', team: 'PA', criterion: 'Apoio', os: 720, present: 720, absences: 0, adjustedValue: 3600, factor: 1, total: 3600 }],
    details: [{ number: '09-08', date: '2026-09-01', client: 'MICHELIN', name: 'Ana', team: 'PA', criterion: 'MICHELIN', status: 'Presente', payable: 28.09 }],
    totals: { employees: 1, orders: 720, entries: 720, absences: 0, pending: 0, bonus: 3600 },
    options: { employees: ['Ana'], clients: ['MICHELIN'], services: [] }
  };
  const states = new Map([[0, report], [2, 50], [4, true], [5, true], [6, false]]);
  const html = renderToStaticMarkup(React.createElement(component('Productivity', states)));
  assert.match(html, /720 lançamentos/);
  assert.match(html, /09-08/);
  assert.match(html, /Página 2 de 15/);
  assert.match(html, /Próxima/);
});

test('shared pagination renders accented labels and enables the next page', () => {
  const html = renderToStaticMarkup(React.createElement(component('ListPagination'), { offset: 50, total: 120, onChange() {} }));
  assert.match(html, /Página 2 de 3/);
  assert.match(html, /Próxima/);
  assert.doesNotMatch(html, /P\?gina|Pr\?xima|disabled/);
});

test('daily operation pagination labels retain their UTF-8 accents', () => {
  const node = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'DailyOps');
  const text = source.slice(node.start, node.end);
  assert.match(text, /Paginação das ordens de serviço/);
  assert.match(text, /Página/);
  assert.match(text, /Próxima/);
  assert.doesNotMatch(text, /P\?gina|Pr\?xima/);
});
