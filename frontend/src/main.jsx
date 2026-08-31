import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './system.css';
import stLogoTransparent from './assets/sf-torres-logo-transparent.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333';

const defaultSettings = {
  legalName: 'ST Serviços de Logística LTDA',
  fantasyName: 'SF TORRES',
  cnpj: '00.000.000/0001-00',
  stateRegistration: '04.123.456-7',
  address: 'Av. Brigadeiro, 4500 - Manaus/AM - CEP 69000-000',
  phone: '(92) 99267-8067',
  email: 'sosthenes.torres@gmail.com',
  primaryColor: '#1B3A6B',
  accentColor: '#C8102E',
  successColor: '#1F8A4C',
  dangerColor: '#B3261E',
  sidebarColor: '#0F2447',
  sidebarDarkColor: '#0B1E3D',
  topbarLogo: 'none',
  primaryLogo: '',
  secondaryLogo: ''
};

const routes = {
  dashboard: { title: 'Painel Corporativo', group: 'Principal' },
  tower: { title: 'Torre Operacional', group: 'Operações' },
  dailyOps: { title: 'Operação Diária', group: 'Operações' },
  schedules: { title: 'Programação de Equipes', group: 'Operações' },
  leaderAttendance: { title: 'Chamada de Ponto', group: 'Operações' },
  productivity: { title: 'Produtividade', group: 'Gestão' },
  bonusCriteria: { title: 'Critérios de Bonificação', group: 'Gestão' },
  employees: { title: 'Funcionários', group: 'Gestão' },
  reports: { title: 'Relatórios', group: 'Movimentações' },
  clients: { title: 'Clientes', group: 'Cadastros' },
  services: { title: 'Serviços', group: 'Cadastros' },
  equipment: { title: 'Equipamentos', group: 'Cadastros' },
  users: { title: 'Usuários & Perfis', group: 'Administração' },
  settings: { title: 'Configurações', group: 'Administração' },
  talentDashboard: { title: 'Dashboard', group: 'Banco de Talentos' },
  talents: { title: 'Banco de Talentos', group: 'Banco de Talentos' },
  talentNew: { title: 'Novo Candidato', group: 'Banco de Talentos' },
  talentJobs: { title: 'Vagas', group: 'Banco de Talentos' },
  talentApplications: { title: 'Candidaturas', group: 'Banco de Talentos' },
  talentUsers: { title: 'Usuários & Perfis', group: 'Administração' },
  talentSettings: { title: 'Configurações', group: 'Administração' }
};

const routeKeys = Object.keys(routes);
const talentRouteKeys = ['talentDashboard', 'talents', 'talentNew', 'talentJobs', 'talentApplications', 'talentUsers', 'talentSettings'];
const defaultAdminPermissions = Object.fromEntries(routeKeys.map((key) => [key, 'edit']));

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('sfTorresUser') || '{}');
  } catch {
    return {};
  }
}

function permissionFor(route, user = currentUser()) {
  if (user.role === 'Administrador') return 'edit';
  const permissions = user.permissions || defaultUserPermissions(user.role);
  return permissions?.[route] || 'none';
}

function canView(route, user = currentUser()) {
  return permissionFor(route, user) !== 'none';
}

function currentEnvironment() {
  return localStorage.getItem('sfTorresEnvironment') === 'talents' ? 'talents' : 'operational';
}

function routeEnvironment(route) {
  return talentRouteKeys.includes(route) ? 'talents' : 'operational';
}

function canUseRoute(route, user = currentUser(), environment = currentEnvironment()) {
  const routeEnv = routeEnvironment(route);
  return Boolean(routes[route]) && routeEnv === environment && canView(route, user);
}

function isLeaderUser(user = currentUser()) {
  return normalize(user.role).includes('lider');
}

function canApproveAttendance(user = currentUser()) {
  const role = normalize(user.role);
  return role.includes('administrador') || role.includes('operacional');
}

function canEdit(route, user = currentUser()) {
  return permissionFor(route, user) === 'edit';
}

function defaultUserPermissions(role = 'Operacional') {
  if (role === 'Administrador') return { ...defaultAdminPermissions };
  if (normalize(role).includes('rh') || normalize(role).includes('recrut')) return { talentDashboard: 'edit', talents: 'edit', talentNew: 'edit', talentJobs: 'edit', talentApplications: 'edit', talentUsers: 'edit', talentSettings: 'edit' };
  if (normalize(role).includes('consulta')) return { talentDashboard: 'view', talents: 'view', talentJobs: 'view', talentApplications: 'view', talentUsers: 'view', talentSettings: 'view' };
  if (normalize(role).includes('lider')) return { schedules: 'edit', leaderAttendance: 'edit' };
  if (normalize(role).includes('operacional')) return { dashboard: 'view', dailyOps: 'view', leaderAttendance: 'edit' };
  return { dashboard: 'view', dailyOps: 'view' };
}

function absenceCount(order) {
  if (!order?.attendance) return 0;
  return Object.values(order.attendance).filter((value) => normalize(typeof value === 'object' ? value.status : value) === 'falta').length;
}

function isFinalStatus(status) {
  const value = normalize(status);
  return value.includes('finalizado') || value.includes('conclu');
}

function isOpenQueueStatus(status) {
  return ['programado', 'rascunho', 'enviada', 'aprovada'].includes(normalize(status));
}

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

const occurrenceFields = [
  ['type', 'Tipo', 'select', ['Operacional', 'Segurança', 'Atraso', 'Equipamento', 'Correção']],
  ['description', 'Descrição', 'textarea'],
  ['status', 'Status', 'select', ['Aberta', 'Em analise', 'Resolvida']]
];

const crudConfigs = {
  clients: {
    title: 'Clientes',
    subtitle: 'Cadastro de clientes, contratos, contatos e condições comerciais.',
    endpoint: '/api/clients',
    newLabel: 'Novo cliente',
    ghostLabel: 'Importar',
    panelTitle: 'clientes ativos',
    noToolbar: true,
    columns: [
      { label: 'Razão social', render: (i) => <><b>{i.name}</b><div className="soft">{i.city} / {i.state}</div></> },
      { label: 'CNPJ', key: 'cnpj', mono: true },
      { label: 'Contato', render: (i) => `${i.contact || '-'} · ${i.phone || '-'}` },
      { label: 'Contrato', key: 'contract', mono: true },
      { label: 'Faturado', render: (i) => money(i.monthRevenue), right: true },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [
      ['name', 'Nome fantasia'], ['legalName', 'Razão social'], ['cnpj', 'CNPJ'], ['contact', 'Contato'],
      ['phone', 'Telefone'], ['city', 'Cidade'], ['state', 'UF'], ['contract', 'Contrato'],
      ['monthRevenue', 'Faturado no mês', 'number'], ['status', 'Status', 'select', ['', 'Ativo', 'Inativo'], null, true]
    ]
  },
  employees: {
    title: 'Funcionários',
    subtitle: 'Cadastro de colaboradores, funções, turnos, locais e regime de contratação.',
    endpoint: '/api/employees',
    newLabel: 'Novo funcionário',
    ghostLabel: 'Importar Excel',
    panelTitle: 'Funcionários',
    toolbar: [
      ['Buscar', 'Nome, função, local...', 'input'],
      ['Função', ['Todas', 'AUXILIAR DE APOIO LOGISTICO', 'Líder'], 'select'],
      ['Local', ['Todos', 'SEMP TCL', 'ADF Logistica', 'Porto CSF', 'Patio 2', 'Patio 3'], 'select'],
      ['Turno', ['Todos', 'Manhã', 'Tarde', 'Noite', 'Administrativo'], 'select'],
      ['Status', ['Todos', 'Ativo', 'Férias', 'Afastado'], 'select']
    ],
    columns: [
      { label: '#', key: 'code', mono: true }, { label: 'Nome', key: 'name' },
      { label: 'Função', key: 'role' }, { label: 'Turno', key: 'shift' },
      { label: 'Local', key: 'location' }, { label: 'Regime', key: 'regime' },
      { label: 'Admissão', render: (i) => date(i.admissionDate) }, { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [
      ['code', 'Código', 'text', null, null, true],
      ['name', 'Nome', 'personName', null, null, true],
      ['role', 'Função', 'select', ['', 'AUXILIAR DE APOIO LOGISTICO', 'Líder'], null, true],
      ['shift', 'Turno', 'uppercaseText'],
      ['location', 'Local', 'uppercaseText'],
      ['regime', 'Regime', 'select', ['', 'CLT', 'PJ', 'Temporário', 'Aprendiz', 'Estágio']],
      ['admissionDate', 'Admissão', 'date', null, null, true],
      ['status', 'Status', 'select', ['', 'Ativo', 'Férias', 'Afastado', 'Cadastro'], null, true]
    ],
    importRows: employeeRowsFromSpreadsheet,
    beforeSave: (data) => ({
      ...data,
      name: formatPersonName(data.name),
      role: normalize(data.role).includes('lider') ? 'Líder' : data.role
    })
  },
  services: {
    title: 'Serviços',
    subtitle: 'Catálogo de tipos de serviço contratados, com tarifas e unidades de medição.',
    endpoint: '/api/services',
    newLabel: 'Novo serviço',
    ghostLabel: 'Histórico de tarifas',
    panelTitle: 'tipos cadastrados',
    noToolbar: true,
    columns: [
      { label: 'Código', key: 'code', mono: true }, { label: 'Descrição', key: 'description' },
      { label: 'Tarifa', render: (i) => money(i.price), right: true },
      { label: 'Categoria', key: 'category' }
    ],
    fields: [['description', 'Descrição'], ['price', 'Tarifa', 'number'], ['category', 'Categoria']]
  },
  equipment: {
    title: 'Equipamentos',
    subtitle: 'Cadastro de containers, veículos e equipamentos operacionais com status.',
    endpoint: '/api/equipment',
    newLabel: 'Novo equipamento',
    ghostLabel: 'Vincular OS',
    panelTitle: 'Equipamentos cadastrados',
    toolbar: [
      ['Tipo', ['Todos', "Container 40'", "Container 20'", 'Caminhão'], 'select'],
      ['Status', ['Todos', 'Disponível', 'Em uso', 'Manutenção'], 'select']
    ],
    columns: [
      { label: 'Código', key: 'code', mono: true }, { label: 'Tipo', key: 'type' }, { label: 'Marca / Modelo', key: 'model' },
      { label: 'Última manutenção', render: (i) => date(i.lastMaintenance) },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [['code', 'Código'], ['type', 'Tipo'], ['model', 'Marca / Modelo'], ['capacity', 'Capacidade'], ['lastMaintenance', 'Última manutenção', 'date'], ['status', 'Status', 'select', ['', 'Disponível', 'Em uso', 'Manutenção'], null, true]]
  }
};

function api(path, options = {}) {
  const token = localStorage.getItem('sfTorresToken');
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (response.status === 401) {
      localStorage.removeItem('sfTorresToken');
      localStorage.removeItem('sfTorresUser');
      window.location.hash = '#/login';
      throw new Error('Sessão expirada');
    }
    if (!response.ok) throw new Error(payload?.error?.message || 'Erro na API');
    return payload;
  });
}

function date(value) {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function dateTime(value) {
  if (!value) return '-';
  const raw = String(value);
  const brDate = raw.match(/^(\d{2}\/\d{2}\/\d{4})(?:,?\s+(\d{2}:\d{2}))?/);
  if (brDate) return brDate[2] ? `${brDate[1]}, ${brDate[2]}` : brDate[1];
  const formattedDate = date(raw);
  const time = raw.includes('T') ? raw.slice(11, 16) : (raw.match(/\b\d{2}:\d{2}\b/)?.[0] || '');
  return time ? `${formattedDate}, ${time}` : formattedDate;
}

function occurrenceTime(item) {
  const value = item?.createdAt || item?.date || item?.updatedAt;
  if (!value) return 'Sem data registrada';
  const parsed = new Date(value);
  if (String(value).includes('T') && !Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  return dateTime(value);
}

function timestampValue(value) {
  if (!value) return 0;
  const raw = String(value);
  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2}))?/);
  const parsed = brDate
    ? new Date(`${brDate[3]}-${brDate[2]}-${brDate[1]}T${brDate[4] || '00'}:${brDate[5] || '00'}:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function occurrenceBelongsToOrder(occurrence, order) {
  if (!occurrence || !order || String(occurrence.workOrder) !== String(order.number)) return false;
  const orderCreatedAt = timestampValue(order.createdAt);
  if (!orderCreatedAt) return true;
  const occurrenceCreatedAt = timestampValue(occurrence.createdAt || occurrence.date || occurrence.updatedAt);
  if (!occurrenceCreatedAt) return false;
  return occurrenceCreatedAt >= orderCreatedAt - 60000;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function localDateValue(value) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

function monthRange(month = currentMonthValue()) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonth = monthNumber ? monthNumber - 1 : new Date().getMonth();
  const start = new Date(safeYear, safeMonth, 1);
  const end = new Date(safeYear, safeMonth + 1, 0);
  return {
    from: `${localDateValue(start)}T00:00:00`,
    to: `${localDateValue(end)}T23:59:59`
  };
}

function workOrdersEndpoint(month = currentMonthValue(), params = {}) {
  const range = monthRange(month);
  const query = new URLSearchParams({ from: range.from, to: range.to, limit: String(params.limit || 500) });
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'limit' && value !== undefined && value !== '') query.set(key, String(value));
  });
  return `/api/workOrders?${query.toString()}`;
}

function workOrdersRangeEndpoint(from, to, params = {}) {
  const query = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59`, limit: String(params.limit || 500) });
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'limit' && value !== undefined && value !== '' && value !== 'Todos') query.set(key, String(value));
  });
  return `/api/workOrders?${query.toString()}`;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseMoney(value) {
  const raw = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatPersonName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
    .join(' ');
}

function formatPersonNameInput(value) {
  return String(value || '').toLowerCase().replace(/\S+/g, (part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`);
}

function initials(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || 'S') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || 'F')).toUpperCase();
}

function cpfDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function formatCpf(value) {
  const digits = cpfDigits(value);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

function isValidCpf(value) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const calc = (size) => {
    let sum = 0;
    for (let i = 0; i < size; i += 1) sum += Number(digits[i]) * (size + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function displayValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (React.isValidElement(value)) return value;
  if (Array.isArray(value)) return value.length ? value.map((item) => displayText(item)).join(', ') : '-';
  if (typeof value === 'object') return displayText(value);
  return value;
}

function displayText(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (React.isValidElement(value)) return '';
  if (Array.isArray(value)) return value.map((item) => displayText(item)).join(', ');
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== '');
    return entries.length ? entries.map(([key, item]) => `${key}: ${displayText(item)}`).join(' | ') : '-';
  }
  return String(value);
}

function occurrenceDetail(item) {
  const time = occurrenceTime(item);
  return <><span>{item.description || '-'}</span><small className="occurrence-time">{time}</small></>;
}

function listData(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function triggerAction(label) {
  window.dispatchEvent(new CustomEvent('sf:action', { detail: label }));
}

async function withBusy(task) {
  window.dispatchEvent(new CustomEvent('sf:busy', { detail: 1 }));
  try {
    return await task();
  } finally {
    window.dispatchEvent(new CustomEvent('sf:busy', { detail: -1 }));
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadWorkbook(filename, sheets) {
  const escapeXml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  const safeSheetName = (name) => escapeXml(String(name || 'Planilha').slice(0, 31));
  const worksheets = sheets.map(({ name, rows }) => `
    <Worksheet ss:Name="${safeSheetName(name)}">
      <Table>
        ${(rows || []).map((row) => `
          <Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(displayText(cell))}</Data></Cell>`).join('')}</Row>
        `).join('')}
      </Table>
    </Worksheet>
  `).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheets}
</Workbook>`;
  const blob = new Blob(['\ufeff', xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function parseDelimitedRows(text) {
  const lines = String(text || '').replace(/^\ufeff/, '').split(/\r?\n/).filter((line) => line.trim());
  const first = lines[0] || '';
  const delimiter = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  return lines.map((line) => splitCsvLine(line, delimiter));
}

function parseXmlSpreadsheetRows(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const rows = Array.from(doc.getElementsByTagNameNS('*', 'Row'));
  return rows.map((row) => Array.from(row.getElementsByTagNameNS('*', 'Cell')).map((cell) => {
    const data = cell.getElementsByTagNameNS('*', 'Data')[0];
    return data?.textContent?.trim() || '';
  })).filter((row) => row.some(Boolean));
}

function uint32(view, offset) {
  return view.getUint32(offset, true);
}

function uint16(view, offset) {
  return view.getUint16(offset, true);
}

async function inflateRaw(data) {
  if (!('DecompressionStream' in window)) throw new Error('Este navegador nao conseguiu abrir XLSX. Salve como CSV ou XLS.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzipXlsx(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (uint32(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo XLSX invalido.');
  const centralOffset = uint32(view, eocd + 16);
  const totalEntries = uint16(view, eocd + 10);
  const files = {};
  let pointer = centralOffset;
  for (let entry = 0; entry < totalEntries; entry += 1) {
    if (uint32(view, pointer) !== 0x02014b50) break;
    const method = uint16(view, pointer + 10);
    const compressedSize = uint32(view, pointer + 20);
    const nameLength = uint16(view, pointer + 28);
    const extraLength = uint16(view, pointer + 30);
    const commentLength = uint16(view, pointer + 32);
    const localOffset = uint32(view, pointer + 42);
    const name = new TextDecoder().decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
    const localNameLength = uint16(view, localOffset + 26);
    const localExtraLength = uint16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    files[name] = method === 8 ? await inflateRaw(compressed) : compressed;
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagNameNS('*', 'si')).map((item) =>
    Array.from(item.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '').join('').trim()
  );
}

function cellColumnIndex(ref) {
  const letters = String(ref || '').match(/[A-Z]+/i)?.[0] || 'A';
  return letters.toUpperCase().split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSheetRows(xml, sharedStrings = []) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.getElementsByTagNameNS('*', 'row')).map((row) => {
    const values = [];
    Array.from(row.getElementsByTagNameNS('*', 'c')).forEach((cell) => {
      const type = cell.getAttribute('t');
      const index = cellColumnIndex(cell.getAttribute('r'));
      const inline = cell.getElementsByTagNameNS('*', 't')[0]?.textContent;
      const raw = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent || inline || '';
      values[index] = type === 's' ? sharedStrings[Number(raw)] || '' : raw;
    });
    return values.map((value) => String(value || '').trim());
  }).filter((row) => row.some(Boolean));
}

async function readSpreadsheetRows(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const files = await unzipXlsx(await file.arrayBuffer());
    const decoder = new TextDecoder();
    const sharedStrings = parseSharedStrings(files['xl/sharedStrings.xml'] ? decoder.decode(files['xl/sharedStrings.xml']) : '');
    const sheetName = Object.keys(files).find((key) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(key));
    if (!sheetName) throw new Error('Nenhuma aba encontrada no XLSX.');
    return parseSheetRows(decoder.decode(files[sheetName]), sharedStrings);
  }
  const text = await file.text();
  if (name.endsWith('.xls') || text.trim().startsWith('<?xml')) return parseXmlSpreadsheetRows(text);
  return parseDelimitedRows(text);
}

function spreadsheetDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  if (/^\d+(\.\d+)?$/.test(text)) {
    const dateValue = new Date(Math.round((Number(text) - 25569) * 86400 * 1000));
    if (!Number.isNaN(dateValue.getTime())) return dateValue.toISOString().slice(0, 10);
  }
  return text;
}

function employeeRowsFromSpreadsheet(rows) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => ['nome', 'funcao', 'função'].includes(normalize(cell))));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((cell) => normalize(cell).replace(/[^a-z0-9#]/g, ''));
  const keyFor = (header) => ({
    '#': 'code',
    codigo: 'code',
    cod: 'code',
    nome: 'name',
    funcao: 'role',
    turno: 'shift',
    local: 'location',
    regime: 'regime',
    admissao: 'admissionDate',
    dataadmissao: 'admissionDate',
    status: 'status'
  })[header];
  return rows.slice(headerIndex + 1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      const key = keyFor(header);
      if (!key) return;
      item[key] = String(row[index] || '').trim();
    });
    return {
      code: item.code,
      name: formatPersonName(item.name),
      role: item.role,
      shift: item.shift,
      location: item.location,
      regime: item.regime,
      admissionDate: spreadsheetDate(item.admissionDate),
      status: item.status || 'Ativo'
    };
  }).filter((item) => item.name);
}

function readStoredSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsStorageKey()) || '{}') };
  } catch {
    return defaultSettings;
  }
}

function settingsStorageKey(environment = currentEnvironment()) {
  return `sfTorresSettings:${environment}`;
}

function scopedSettingsEndpoint(key = 'company', environment = currentEnvironment()) {
  return `/api/settings/${key}?environment=${encodeURIComponent(environment)}`;
}

function readStoredProfile() {
  try {
    const user = currentUser();
    const profile = JSON.parse(localStorage.getItem('sfTorresProfile') || '{}');
    return {
      name: user.name || profile.name || 'Administrador SF',
      role: user.displayRole || profile.role || user.role || 'Administrador',
      photo: user.profilePhoto || profile.photo || ''
    };
  } catch {
    return { name: 'Administrador SF', role: 'Administrador', photo: '' };
  }
}

function storeSettings(settings) {
  localStorage.setItem(settingsStorageKey(), JSON.stringify(settings));
}

function applySystemSettings(settings) {
  const root = document.documentElement;
  root.style.setProperty('--c-primary', settings.primaryColor || defaultSettings.primaryColor);
  root.style.setProperty('--c-primary-700', settings.primaryColor || defaultSettings.primaryColor);
  root.style.setProperty('--c-accent', settings.accentColor || defaultSettings.accentColor);
  root.style.setProperty('--c-success', settings.successColor || defaultSettings.successColor);
  root.style.setProperty('--c-danger', settings.dangerColor || defaultSettings.dangerColor);
  root.style.setProperty('--c-side', settings.sidebarColor || defaultSettings.sidebarColor);
  root.style.setProperty('--c-side-700', settings.sidebarDarkColor || defaultSettings.sidebarDarkColor);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

function downloadDataFile(file) {
  if (!file?.content) return;
  const link = document.createElement('a');
  link.href = file.content;
  link.download = file.name || 'curriculo';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function openProtectedFile(path, filename, download = false) {
  const token = localStorage.getItem('sfTorresToken');
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Nao foi possivel abrir o arquivo');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (download) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'curriculo';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function whatsappUrl(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message || '')}`;
}

function ActionMenu({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const menuRef = useRef(null);
  const available = actions.filter(Boolean);
  const updatePosition = () => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 180;
    const height = Math.max(42, available.length * 34 + 10);
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= height + gap ? rect.bottom + gap : Math.max(gap, rect.top - height - gap);
    const left = Math.min(Math.max(gap, rect.right - width), window.innerWidth - width - gap);
    setPosition({ top, left, width });
  };
  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const closeOnOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const reposition = () => updatePosition();
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);
  if (!available.length) return null;
  return <div className="action-menu" ref={menuRef}>
    <button type="button" className="btn btn-sm btn-icon-only action-menu-trigger" onClick={() => setOpen((value) => !value)} aria-label="Mais opcoes">...</button>
    {open && <div className="action-menu-popover" style={position || undefined}>
      {available.map((action) => <button key={action.label} type="button" className={action.danger ? 'danger' : ''} disabled={action.disabled} onClick={() => { setOpen(false); action.onClick?.(); }}>{action.label}</button>)}
    </div>}
  </div>;
}

function ConfirmModal({ title, text, confirmLabel = 'Confirmar', danger = false, onCancel, onConfirm }) {
  return <div className="modal-backdrop">
    <div className="modal confirm-modal">
      <div className="modal-head"><h3>{title}</h3><button className="btn btn-sm" onClick={onCancel}>Fechar</button></div>
      <div className="modal-body">
        <p className="soft multiline">{text}</p>
        <div className="modal-actions"><button className="btn" onClick={onCancel}>Cancelar</button><button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  </div>;
}

function cleanRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '') || defaultRouteForEnvironment();
  if (route === 'login') return 'login';
  if (!localStorage.getItem('sfTorresToken')) return 'login';
  if (!routes[route]) return firstAllowedRoute();
  return canUseRoute(route) ? route : firstAllowedRoute();
}

function firstAllowedRoute() {
  if (!localStorage.getItem('sfTorresToken')) return 'login';
  return firstAllowedRouteFor(currentUser());
}

function defaultRouteForEnvironment(environment = currentEnvironment()) {
  return environment === 'talents' ? 'talentDashboard' : 'dailyOps';
}

function firstAllowedRouteFor(user, environment = currentEnvironment()) {
  return routeKeys.find((key) => canUseRoute(key, user, environment)) || 'login';
}

function requestedRouteFromHash() {
  const route = String(window.location.hash || '').replace(/^#\/?/, '');
  return routes[route] ? route : '';
}

function publicRouteFromHash() {
  return String(window.location.hash || '').replace(/^#\/?/, '');
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retries: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, retries: 0 });
    }
  }

  componentDidCatch(error) {
    console.error('Falha recuperada na tela:', error);
    if (this.state.retries >= 3) return;
    window.setTimeout(() => {
      this.setState((state) => ({ error: null, retries: state.retries + 1 }));
    }, 300);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.retries < 3) {
      return (
        <div className="panel">
          <div className="panel-body">
            <LoadingSpinner />
          </div>
        </div>
      );
    }
    return (
      <div className="panel">
        <div className="panel-body">
          <h3>Atualizar painel</h3>
          <p className="soft">A tela precisa sincronizar novamente os dados mais recentes.</p>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null, retries: 0 })}>Tentar novamente</button>
        </div>
      </div>
    );
  }
}

function pillClass(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('ativo') || text.includes('aprov') || text.includes('fech') || text.includes('operacional') || text.includes('dispon')) return 'pill-success';
  if (text.includes('pend') || text.includes('envi') || text.includes('férias') || text.includes('ferias') || text.includes('manut') || text.includes('normal')) return 'pill-warning';
  if (text.includes('cancel') || text.includes('afast')) return 'pill-danger';
  if (text.includes('exec') || text.includes('uso') || text.includes('cadastro')) return 'pill-info';
  return 'pill-neutral';
}

function Pill({ value }) {
  return <span className={`pill ${pillClass(value)} pill-dot`}>{value || '-'}</span>;
}

function LoadingSpinner({ small = false }) {
  return <span className={`loading-spinner ${small ? 'loading-spinner-sm' : ''}`} aria-label="Carregando" role="status" />;
}

function LoadingCell({ colSpan = 1 }) {
  return <tr><td colSpan={colSpan} className="loading-cell"><LoadingSpinner /></td></tr>;
}

function LoadingBlock() {
  return <div className="loading-block"><LoadingSpinner /></div>;
}

function BusyOverlay() {
  return <div className="busy-overlay" aria-live="polite" aria-busy="true"><LoadingSpinner /></div>;
}

function App() {
  const [publicRoute, setPublicRoute] = useState(publicRouteFromHash);
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('sfTorresToken')));
  const [route, setRoute] = useState(() => localStorage.getItem('sfTorresToken') ? cleanRoute(window.location.hash) : 'login');
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState(readStoredSettings);
  const [profile, setProfile] = useState(readStoredProfile);
  const [panel, setPanel] = useState(null);
  const [busyCount, setBusyCount] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sfTorresSidebarCollapsed') === 'true');

  useEffect(() => {
    const onHash = () => {
      const hasToken = Boolean(localStorage.getItem('sfTorresToken'));
      setPublicRoute(publicRouteFromHash());
      setAuthenticated(hasToken);
      setRoute(hasToken ? cleanRoute(window.location.hash) : 'login');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    applySystemSettings(settings);
    storeSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (authenticated) setProfile(readStoredProfile());
  }, [authenticated]);

  useEffect(() => {
    if (!localStorage.getItem('sfTorresToken')) return;
    api(scopedSettingsEndpoint('company'))
      .then((payload) => {
        if (payload.data) setSettings((old) => ({ ...old, ...payload.data }));
      })
      .catch(() => {});
  }, [authenticated]);

  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  };

  useEffect(() => {
    const onAction = (event) => notify(`${event.detail} executado`);
    window.addEventListener('sf:action', onAction);
    return () => window.removeEventListener('sf:action', onAction);
  }, []);

  useEffect(() => {
    const onBusy = (event) => setBusyCount((count) => Math.max(0, count + Number(event.detail || 0)));
    window.addEventListener('sf:busy', onBusy);
    return () => window.removeEventListener('sf:busy', onBusy);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let focusTimer = null;
    const updateKeyboardState = () => {
      const viewportHeight = viewport?.height || window.innerHeight;
      const offsetTop = viewport?.offsetTop || 0;
      const inset = Math.max(0, Math.round(window.innerHeight - viewportHeight - offsetTop));
      const open = inset > 120;
      root.classList.toggle('keyboard-open', open);
      root.style.setProperty('--keyboard-inset', `${open ? inset : 0}px`);
    };
    const onFocusIn = (event) => {
      const target = event.target;
      if (!target?.matches?.('input, textarea, select')) return;
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        updateKeyboardState();
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }, 280);
    };
    const onFocusOut = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(updateKeyboardState, 180);
    };
    updateKeyboardState();
    viewport?.addEventListener('resize', updateKeyboardState);
    viewport?.addEventListener('scroll', updateKeyboardState);
    window.addEventListener('resize', updateKeyboardState);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(focusTimer);
      viewport?.removeEventListener('resize', updateKeyboardState);
      viewport?.removeEventListener('scroll', updateKeyboardState);
      window.removeEventListener('resize', updateKeyboardState);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);

  const goLogin = () => {
    localStorage.removeItem('sfTorresToken');
    localStorage.removeItem('sfTorresUser');
    setAuthenticated(false);
    setPanel(null);
    window.location.hash = '#/login';
    setRoute('login');
  };

  const saveProfile = async (data) => {
    const user = currentUser();
    const nextProfile = { name: data.name || user.name || 'Administrador SF', role: data.role || user.role || 'Usuário', photo: data.photo || '' };
    const payload = await withBusy(() => api(`/api/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: nextProfile.name, displayRole: nextProfile.role, profilePhoto: nextProfile.photo })
    }));
    const updatedUser = { ...user, ...(payload.data || {}) };
    localStorage.setItem('sfTorresProfile', JSON.stringify(nextProfile));
    localStorage.setItem('sfTorresUser', JSON.stringify(updatedUser));
    setProfile(nextProfile);
    setPanel(null);
    notify('Perfil atualizado');
  };

  const goAfterLogin = (user) => {
    setAuthenticated(true);
    const requestedRoute = requestedRouteFromHash();
    const preferredRoute = localStorage.getItem('sfTorresPreferredRoute') || '';
    const environment = currentEnvironment();
    localStorage.removeItem('sfTorresPreferredRoute');
    setSettings(readStoredSettings());
    const nextRoute = preferredRoute && canUseRoute(preferredRoute, user, environment)
      ? preferredRoute
      : requestedRoute && canUseRoute(requestedRoute, user, environment)
        ? requestedRoute
        : firstAllowedRouteFor(user, environment);
    window.history.replaceState(null, '', `#/${nextRoute}`);
    setRoute(nextRoute);
  };

  if (publicRoute === 'trabalhe-conosco') {
    return <PublicJobs settings={settings} />;
  }

  if (route === 'login' || !authenticated) {
    return <Login settings={settings} onLogin={goAfterLogin} />;
  }

  return (
    <div className={`app app-route-${route} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar route={route} setRoute={setRoute} settings={settings} profile={profile} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => {
        localStorage.setItem('sfTorresSidebarCollapsed', String(!value));
        return !value;
      })} onProfile={() => setPanel('profile')} onLogout={goLogin} />
      <Topbar route={route} settings={settings} profile={profile} openPanel={setPanel} />
      <main className="main">
        <div className="page">
          <ErrorBoundary resetKey={route}>
            <Screen route={route} notify={notify} settings={settings} setSettings={setSettings} />
          </ErrorBoundary>
        </div>
      </main>
      {panel === 'profile' && <ProfileModal profile={profile} onCancel={() => setPanel(null)} onSave={saveProfile} />}
      {panel && panel !== 'profile' && <ActionPanel type={panel} setRoute={setRoute} onClose={() => setPanel(null)} />}
      {busyCount > 0 && <BusyOverlay />}
      <div className={`sf-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function Login({ settings, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('SF TORRES - Matriz Manaus/AM');
  const [message, setMessage] = useState('Acesso restrito a colaboradores autorizados. As ações são auditadas conforme LGPD.');
  const [loading, setLoading] = useState(false);
  const loginPrimaryLogo = stLogoTransparent;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Validando credenciais...');
    try {
      const environment = company === 'SF TORRES - Banco de talentos' ? 'talents' : 'operational';
      const payload = await withBusy(() => fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, environment })
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error?.message || 'Falha no login');
        return data;
      }));
      localStorage.setItem('sfTorresToken', payload.data.token);
      localStorage.setItem('sfTorresUser', JSON.stringify(payload.data.user));
      localStorage.setItem('sfTorresEnvironment', environment);
      localStorage.setItem('sfTorresCompany', company);
      localStorage.setItem('sfTorresPreferredRoute', environment === 'talents' ? 'talentDashboard' : 'dailyOps');
      onLogin(payload.data.user);
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="login-logo-stage">
          <div className="login-logo-card login-logo-st"><LogoST src={loginPrimaryLogo} /></div>
          <div className="login-logo-card login-logo-sm"><LogoSM src={settings.secondaryLogo} /></div>
        </div>
        <footer>© 2026 SF TORRES · ST Serviços de Logística · CNPJ 00.000.000/0001-00</footer>
      </aside>
      <main className="login-main">
        <div className="login-card">
          <div className="brand-line">
            <div className="mark login-mini-logo"><LogoST src={loginPrimaryLogo} dark /></div>
            <div><div className="eyebrow">Centro Operacional</div><div className="brand-name">{settings.fantasyName}</div></div>
          </div>
          <h1>Acesse sua conta</h1>
          <p className="subtitle">Use suas credenciais corporativas para entrar no ambiente selecionado.</p>
          <form className="login-form" onSubmit={submit} autoComplete="off">
            <div className="form-field"><label>Usuário ou e-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
            <div className="form-field"><label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
            <div className="form-field"><label>Empresa / Filial</label><select value={company} onChange={(e) => setCompany(e.target.value)}><option>SF TORRES - Matriz Manaus/AM</option><option>SF TORRES - Banco de talentos</option></select></div>
            <div className="aux"><label className="row"><input type="checkbox" /> Manter conectado</label><a href="#/login">Esqueci minha senha</a></div>
            <button className="btn btn-primary" disabled={loading}>{loading ? <LoadingSpinner small /> : 'Entrar no sistema'}</button>
          </form>
          <div className="login-foot">{message}</div>
        </div>
      </main>
    </div>
  );
}

function PublicJobs({ settings }) {
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({ fullName: '', cpf: '', email: '', phone: '', city: 'Manaus', state: 'AM', education: '', experienceYears: '', lastRole: '', desiredSalary: '', availableStartDate: '', linkedinUrl: '', portfolioUrl: '', coverLetter: '', source: '', consentStorage: false, resume: null });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API_URL}/api/talents/public/jobs`).then((response) => response.json()).then((payload) => {
      const list = listData(payload);
      setJobs(list);
      setSelectedId(list[0]?.id || '');
    }).catch(() => setMessage('Nao foi possivel carregar as vagas publicadas.')).finally(() => setLoading(false));
  }, []);
  const selected = jobs.find((job) => job.id === selectedId);
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!selectedId) return setMessage('Selecione uma vaga para enviar sua candidatura.');
    if (!form.consentStorage) return setMessage('Para enviar a candidatura, confirme o consentimento de armazenamento dos dados.');
    setMessage('Enviando candidatura...');
    const payload = { ...form, jobId: selectedId, cpf: formatCpf(form.cpf), phone: formatPhone(form.phone), desiredSalary: parseMoney(form.desiredSalary) };
    const response = await fetch(`${API_URL}/api/talents/public/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error?.message || 'Nao foi possivel enviar sua candidatura.');
    setForm({ fullName: '', cpf: '', email: '', phone: '', city: 'Manaus', state: 'AM', education: '', experienceYears: '', lastRole: '', desiredSalary: '', availableStartDate: '', linkedinUrl: '', portfolioUrl: '', coverLetter: '', source: '', consentStorage: false, resume: null });
    setApplying(false);
    setMessage('Candidatura enviada. Nossa equipe ira analisar suas informacoes.');
  };
  const fileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return change('resume', null);
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const validExtension = /\.(pdf|doc|docx)$/i.test(file.name || '');
    if (file.type && !allowed.includes(file.type) && !validExtension) {
      event.target.value = '';
      change('resume', null);
      return setMessage('Envie o curriculo em PDF, DOC ou DOCX.');
    }
    if (file.size > 4 * 1024 * 1024) {
      event.target.value = '';
      change('resume', null);
      return setMessage('O curriculo deve ter no maximo 4 MB.');
    }
    setMessage('');
    const content = await fileToDataUrl(file);
    change('resume', { name: file.name, size: file.size, type: file.type, content, uploadedAt: new Date().toISOString() });
  };
  return (
    <div className="public-jobs-page">
      <header className="public-jobs-head">
        <div className="brand"><div className="brand-emblem"><img src={stLogoTransparent} alt="SF Torres" /></div><div className="brand-text"><strong>{settings.fantasyName}</strong><span>Trabalhe Conosco</span></div></div>
        <a className="btn" href="#/login">Acesso interno</a>
      </header>
      <main className="public-jobs-main">
        <section className="public-jobs-intro">
          <h1>Trabalhe Conosco</h1>
          <p>Cadastre-se em uma vaga publicada pela SF TORRES. Suas informacoes serao avaliadas pela equipe interna antes de entrar no Banco de Talentos.</p>
        </section>
        <div className="public-jobs-grid">
          <section className="public-job-list">
            <h2>Vagas abertas</h2>
            {loading ? <LoadingBlock /> : jobs.length ? jobs.map((job) => <button type="button" key={job.id} className={selectedId === job.id ? 'active' : ''} onClick={() => setSelectedId(job.id)}><b>{job.title}</b><span>{[job.department, job.location, job.contractType].filter(Boolean).join(' · ')}</span></button>) : <div className="talent-empty"><b>Nenhuma vaga publicada</b><span>Novas oportunidades aparecerao aqui quando forem abertas.</span></div>}
          </section>
          <section className="public-job-detail">
            {selected ? <>
              <div className="public-job-summary"><h2>{selected.title}</h2><Pill value={selected.contractType || 'Vaga'} /><p>{selected.summary || 'Oportunidade publicada pela SF TORRES.'}</p><div className="public-job-tags"><span>{selected.location || 'Local a definir'}</span><span>{selected.workMode || 'Presencial'}</span>{selected.salaryRange && <span>{selected.salaryRange}</span>}</div><button className="btn btn-primary public-apply-btn" onClick={() => setApplying(true)}>Candidatar-se</button></div>
              <div className="public-job-columns">
                <div><h3>Requisitos</h3><ul>{(selected.requirements || []).map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h3>Beneficios</h3><ul>{(selected.benefits || []).map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
            </> : <div className="talent-empty"><b>Selecione uma vaga</b><span>Escolha uma oportunidade para visualizar os detalhes.</span></div>}
          </section>
        </div>
        {message && !applying && <div className="public-message">{message}</div>}
        {applying && <div className="modal-backdrop public-application-backdrop"><form className="public-application-form" onSubmit={submit}>
          <div className="modal-head"><h2>Enviar candidatura</h2><button type="button" className="btn btn-sm" onClick={() => setApplying(false)}>Fechar</button></div>
          <div className="public-application-body">
            <div className="form-grid">
              <div className="form-field full"><label>Vaga</label><select value={selectedId} required onChange={(e) => setSelectedId(e.target.value)}>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div>
              <div className="form-field full"><label>Nome completo *</label><input required value={form.fullName} onChange={(e) => change('fullName', formatPersonNameInput(e.target.value))} /></div>
              <div className="form-field"><label>CPF</label><input value={form.cpf} maxLength={14} onChange={(e) => change('cpf', formatCpf(e.target.value))} /></div>
              <div className="form-field"><label>E-mail *</label><input type="email" required value={form.email} onChange={(e) => change('email', e.target.value)} /></div>
              <div className="form-field"><label>Telefone / WhatsApp</label><input value={form.phone} onChange={(e) => change('phone', formatPhone(e.target.value))} /></div>
              <div className="form-field"><label>Cidade</label><input value={form.city} onChange={(e) => change('city', e.target.value)} /></div>
              <div className="form-field"><label>UF</label><input value={form.state} maxLength={2} onChange={(e) => change('state', e.target.value.toUpperCase())} /></div>
              <div className="form-field"><label>Escolaridade</label><select value={form.education} onChange={(e) => change('education', e.target.value)}>{talentEducationOptions.map((item) => <option key={item || '-'}>{item || '-'}</option>)}</select></div>
              <div className="form-field"><label>Anos de experiencia</label><select value={form.experienceYears} onChange={(e) => change('experienceYears', e.target.value)}><option></option><option>Sem experiencia</option><option>1 a 2 anos</option><option>3 a 5 anos</option><option>Mais de 5 anos</option></select></div>
              <div className="form-field"><label>Ultima funcao</label><input value={form.lastRole} onChange={(e) => change('lastRole', e.target.value)} /></div>
              <div className="form-field"><label>Pretensao salarial</label><input value={form.desiredSalary} onChange={(e) => change('desiredSalary', e.target.value)} onBlur={(e) => change('desiredSalary', money(parseMoney(e.target.value)))} /></div>
              <div className="form-field"><label>Disponibilidade de inicio</label><input type="date" value={form.availableStartDate} onChange={(e) => change('availableStartDate', e.target.value)} /></div>
              <div className="form-field"><label>LinkedIn</label><input value={form.linkedinUrl} onChange={(e) => change('linkedinUrl', e.target.value)} /></div>
              <div className="form-field"><label>Curriculo</label><input type="file" accept=".pdf,.doc,.docx" onChange={fileChange} />{form.resume?.name && <small className="soft">{form.resume.name} - {formatFileSize(form.resume.size)}</small>}</div>
              <div className="form-field full"><label>Apresentacao</label><textarea value={form.coverLetter} onChange={(e) => change('coverLetter', e.target.value)} placeholder="Conte rapidamente sua experiencia e disponibilidade." /></div>
              <div className="form-field full"><label>Consentimento LGPD *</label><label className="public-consent"><input type="checkbox" checked={form.consentStorage} onChange={(e) => change('consentStorage', e.target.checked)} /> Autorizo o armazenamento dos meus dados para processos seletivos e futuras oportunidades profissionais.</label></div>
            </div>
            <div className="modal-actions"><span className="soft">{message}</span><button className="btn btn-primary">Enviar candidatura</button></div>
          </div>
        </form></div>}
      </main>
    </div>
  );
}

function profileInitials(name = 'SF') {
  const parts = String(name || 'SF').trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) || 'SF').toUpperCase();
}

function UserAvatar({ profile, className = '' }) {
  return (
    <div className={className}>
      {profile?.photo ? <img src={profile.photo} alt={profile.name || 'Perfil'} /> : profileInitials(profile?.name)}
    </div>
  );
}

function ProfileModal({ profile, onCancel, onSave }) {
  const [form, setForm] = useState(profile);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const choosePhoto = () => inputRef.current?.click();
  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const photo = await fileToDataUrl(file);
    setForm((old) => ({ ...old, photo }));
  };
  const save = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await onSave(form);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal profile-modal">
        <div className="modal-head"><h3>Editar perfil</h3><button className="btn btn-sm" onClick={onCancel} disabled={submitting}>Fechar</button></div>
        <div className="modal-body">
          <div className="profile-editor">
            <UserAvatar profile={form} className="profile-photo" />
            <div className="profile-photo-actions">
              <b>{form.name || 'Usuário'}</b>
              <span>Foto exibida no menu e na barra superior.</span>
              <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={changePhoto} />
              <div className="actions">
                <button type="button" className="btn btn-sm" onClick={choosePhoto}>Trocar foto</button>
                {form.photo && <button type="button" className="btn btn-sm" onClick={() => setForm((old) => ({ ...old, photo: '' }))}>Remover</button>}
              </div>
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Nome exibido</label><input value={form.name || ''} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} /></div>
            <div className="form-field"><label>Perfil</label><input value={form.role || ''} onChange={(event) => setForm((old) => ({ ...old, role: event.target.value }))} /></div>
          </div>
          <div className="modal-actions"><button className="btn" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={submitting}>{submitting ? <LoadingSpinner small /> : 'Salvar perfil'}</button></div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ route, setRoute, settings, profile, collapsed, onToggle, onProfile, onLogout }) {
  const groups = [
    ['Principal', [['dashboard', 'PR', 'Principal']]],
    ['Operações', [['tower', 'TO', 'Torre Operacional'], ['dailyOps', 'OD', 'Operação Diária'], ['schedules', 'PD', 'Programação de Equipes'], ['leaderAttendance', 'CP', 'Chamada de Ponto']]],
    ['Gestão', [['productivity', 'PD', 'Produtividade'], ['bonusCriteria', 'CB', 'Critérios de Bonificação'], ['employees', 'FE', 'Funcionários']]],
    ['Movimentações', [['reports', 'RP', 'Relatórios']]],
    ['Cadastros', [['clients', 'CL', 'Clientes'], ['services', 'SV', 'Serviços'], ['equipment', 'EQ', 'Equipamentos']]],
    ['Administração', [['users', 'AD', 'Usuários & Perfis'], ['settings', 'CF', 'Configurações']]],
    ['Banco de Talentos', [['talentDashboard', 'BT', 'Dashboard'], ['talents', 'BC', 'Candidatos'], ['talentJobs', 'VG', 'Vagas'], ['talentApplications', 'CA', 'Candidaturas'], ['talentUsers', 'US', 'Usuários'], ['talentSettings', 'CF', 'Configurações']]]
  ];
  const user = currentUser();
  const environment = currentEnvironment();
  const visibleGroups = environment === 'talents'
    ? groups.filter(([title]) => title === 'Banco de Talentos')
    : groups.filter(([title]) => title !== 'Banco de Talentos');
  const go = (key) => {
    if (!canUseRoute(key, user, environment)) return;
    window.location.hash = `#/${key}`;
    setRoute(key);
  };
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-emblem"><img src={stLogoTransparent} alt="SF Torres" /></div><div className="brand-text"><strong>{settings.fantasyName}</strong><span>{environment === 'talents' ? 'Banco de Talentos' : 'Centro Operacional'}</span></div><button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>{collapsed ? '›' : '‹'}</button></div>
      <div className="search"><span>⌕</span><input placeholder="Buscar módulo, tela ou ação..." /></div>
      <nav className="nav">
        {visibleGroups.map(([title, items]) => {
          const visibleItems = items.filter(([key]) => canUseRoute(key, user, environment));
          if (!visibleItems.length) return null;
          return (
            <div className="nav-group" key={title}>
              <div className="nav-title">{title}</div>
              {visibleItems.map(([key, code, label]) => <div key={key} className={`nav-item ${route === key ? 'active' : ''}`} onClick={() => go(key)}><span className="num">{code}</span>{label}</div>)}
            </div>
          );
        })}
      </nav>
      <div className="user-card" onClick={onProfile} title="Editar perfil">
        <UserAvatar profile={profile} className="avatar" />
        <div className="info"><b>{profile.name || user.name || 'Administrador SF'}</b><span>{profile.role || user.role || 'Usuário do sistema'}</span></div>
        <button className="logout" onClick={(event) => { event.stopPropagation(); onLogout(); }} title="Sair">↪</button>
      </div>
    </aside>
  );
}

function Topbar({ route, settings, profile, openPanel }) {
  const def = routes[route] || routes.dailyOps;
  return (
    <header className="topbar">
      <div className="crumbs"><span className="crumb-icon"><Icon name="grid" /></span><span>Painel Corporativo</span><span className="sep">›</span><span>{def.group}</span><span className="sep">›</span><span className="here">{def.title}</span></div>
      <div className="topbar-actions">
        <button className="btn-icon" title="Pesquisar (Ctrl+K)" onClick={() => openPanel('search')}><Icon name="search" /></button>
        <button className="btn-icon" title="Notificações" onClick={() => openPanel('notifications')}><Icon name="bell" /><span className="badge-dot" /></button>
        <button className="btn-icon" title="Mensagens" onClick={() => openPanel('messages')}><Icon name="message" /></button>
        <span className="topbar-divider" />
        <button className="btn-icon" title="Ajuda" onClick={() => openPanel('help')}><Icon name="help" /></button>
        {settings.topbarLogo !== 'none' && <div className="top-logo">{settings.topbarLogo !== 'sm' && <LogoST src={settings.primaryLogo} />}{settings.topbarLogo !== 'st' && <LogoSM small src={settings.secondaryLogo} />}</div>}
        <button className="who who-name-only" onClick={() => openPanel('profile')} title="Editar perfil"><UserAvatar profile={profile} className="ava" /><b>{profile.name}</b></button>
      </div>
    </header>
  );
}

function Screen({ route, notify, settings, setSettings }) {
  const editable = canEdit(route);
  if (!canView(route)) return <AccessDenied />;
  if (route === 'dailyOps') return <DailyOps notify={notify} editable={editable} />;
  if (route === 'schedules') return <Schedules notify={notify} editable={editable} />;
  if (route === 'leaderAttendance') return <LeaderAttendance notify={notify} editable={editable} />;
  if (route === 'users') return <Users notify={notify} editable={editable} />;
  if (route === 'talentDashboard') return <TalentDashboard notify={notify} />;
  if (route === 'talents') return <TalentBank notify={notify} editable={editable} mode="list" />;
  if (route === 'talentNew') return <TalentBank notify={notify} editable={editable} mode="new" />;
  if (route === 'talentJobs') return <TalentJobs notify={notify} editable={editable} />;
  if (route === 'talentApplications') return <TalentApplications notify={notify} editable={editable} />;
  if (route === 'talentUsers') return <Users notify={notify} editable={editable} />;
  if (route === 'talentSettings') return <Settings notify={notify} settings={settings} setSettings={setSettings} editable={editable} />;
  if (crudConfigs[route]) return <CrudScreen config={crudConfigs[route]} notify={notify} editable={editable} />;
  if (route === 'dashboard') return <OperationsDashboard />;
  if (route === 'tower') return <Tower />;
  if (route === 'productivity') return <Productivity />;
  if (route === 'bonusCriteria') return <BonusCriteria notify={notify} editable={editable} />;
  if (route === 'reports') return <Reports />;
  if (route === 'settings') return <Settings notify={notify} settings={settings} setSettings={setSettings} editable={editable} />;
  return <Placeholder route={route} />;
}

function AccessDenied() {
  return <Panel title="Acesso restrito" padded><p>Seu usuario nao tem permissao para abrir esta tela.</p><p className="soft">Peça ao administrador para liberar acesso de visualizacao ou edicao em Usuarios & Perfis.</p></Panel>;
}

const talentStatuses = ['Novo cadastro', 'Disponivel', 'Em analise', 'Entrevista', 'Aprovado', 'Banco de reserva', 'Contratado', 'Reprovado', 'Indisponivel', 'Arquivado'];
const talentEducationOptions = ['', 'Ensino Fundamental Incompleto', 'Ensino Fundamental Completo', 'Ensino Medio Incompleto', 'Ensino Medio Completo', 'Ensino Tecnico', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pos-graduacao', 'Mestrado', 'Doutorado', 'Outro'];
const talentAvailabilityOptions = ['', 'Imediata', 'Ate 7 dias', 'Ate 15 dias', 'Ate 30 dias', 'A combinar'];
const talentScheduleOptions = ['Comercial', 'Primeiro turno', 'Segundo turno', 'Terceiro turno', 'Noturno', 'Escala', 'Qualquer horario'];
const talentCompanyOptions = ['Banco Geral', 'SF TORRES', 'ST Servicos de Logistica', 'Ambas'];
const talentCnhCategories = ['', 'A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];

function talentInitialForm() {
  return {
    fullName: '',
    cpf: '',
    rg: '',
    birthDate: '',
    phone: '',
    email: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: 'Manaus',
    state: 'AM',
    education: '',
    coursesText: '',
    experiencesText: '',
    lastRole: '',
    desiredRole: '',
    startAvailability: 'Imediata',
    scheduleAvailability: ['Comercial'],
    salaryExpectation: '',
    hasCnh: false,
    cnhCategory: '',
    cnhNumber: '',
    cnhExpiration: '',
    internalNotes: '',
    status: 'Novo cadastro',
    relatedCompany: 'Banco Geral',
    consentStorage: true,
    consentDate: localDateValue(new Date()),
    consentOrigin: 'Cadastro interno',
    source: 'Indicado internamente'
  };
}

function talentToForm(candidate = {}) {
  const courses = Array.isArray(candidate.courses) ? candidate.courses : [];
  const experiences = Array.isArray(candidate.experiences) ? candidate.experiences : [];
  return {
    ...talentInitialForm(),
    ...candidate,
    cpf: formatCpf(candidate.cpf || ''),
    phone: formatPhone(candidate.phone || ''),
    salaryExpectation: candidate.salaryExpectation ? money(candidate.salaryExpectation) : '',
    coursesText: courses.map((item) => [item.name, item.institution, item.year].filter(Boolean).join(' - ')).join('\n'),
    experiencesText: experiences.map((item) => [item.company, item.role, item.period].filter(Boolean).join(' - ')).join('\n'),
    scheduleAvailability: Array.isArray(candidate.scheduleAvailability) ? candidate.scheduleAvailability : []
  };
}

function parseLines(value, type) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [first, second, third] = line.split(' - ').map((item) => item?.trim()).filter(Boolean);
    return type === 'course'
      ? { name: first || line, institution: second || '', year: third || '' }
      : { company: first || '', role: second || line, period: third || '' };
  });
}

function talentPayload(form) {
  const experiences = parseLines(form.experiencesText, 'experience');
  const { coursesText, experiencesText, id, createdAt, updatedAt, history, ...rest } = form;
  return {
    ...rest,
    fullName: formatPersonName(form.fullName),
    cpf: formatCpf(form.cpf),
    phone: formatPhone(form.phone),
    salaryExpectation: parseMoney(form.salaryExpectation),
    courses: parseLines(coursesText, 'course'),
    experiences,
    lastRole: form.lastRole || experiences[0]?.role || '',
    resume: form.resume?.name ? form.resume : null
  };
}

function TalentDashboard({ notify }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    api('/api/talents/summary').then((payload) => setSummary(payload.data)).catch((error) => notify(error.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const total = summary?.total || 0;
  const roles = (summary?.roles || []).map((item) => [item.desiredRole || 'Nao informado', item._count?.desiredRole || 0]);
  const movements = (summary?.movements || []).map((item) => [dateTime(item.createdAt), item.candidate?.fullName || '-', item.action, item.toStatus ? <Pill value={item.toStatus} /> : '-']);
  const latest = (summary?.latest || []).map((item) => [item.fullName, formatPhone(item.phone), item.desiredRole || '-', <Pill value={item.status} />, date(item.createdAt)]);
  const statusCounts = Object.fromEntries((summary?.statusBreakdown || []).map((item) => [item.status, item._count?.status || 0]));
  const pipeline = [
    ['Novo cadastro', statusCounts['Novo cadastro'] || 0, 'Entrada'],
    ['Disponivel', statusCounts.Disponivel || 0, 'Pronto para contato'],
    ['Em analise', statusCounts['Em analise'] || 0, 'Triagem'],
    ['Entrevista', statusCounts.Entrevista || 0, 'Agenda'],
    ['Aprovado', statusCounts.Aprovado || 0, 'Selecionado'],
    ['Contratado', statusCounts.Contratado || 0, 'Fechado']
  ];
  const cityRows = (summary?.cityBreakdown || []).map((item) => [item.city || 'Nao informado', item._count?.city || 0]);
  const educationRows = (summary?.educationBreakdown || []).map((item) => [item.education || 'Nao informado', item._count?.education || 0]);
  const quickSearches = ['Motorista CNH D', 'Auxiliar operacional', 'Disponibilidade imediata', 'Manaus AM'];
  const goSearch = (term) => {
    window.location.hash = `#/talents`;
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('sf:talent-search', { detail: term })), 0);
  };
  return (
    <>
      <PageHead title="Banco de Talentos" subtitle="Painel de acompanhamento de candidatos, disponibilidade, status e cadastros recentes." action="Novo candidato" onAction={() => { window.location.hash = '#/talentNew'; }} ghostAction="Atualizar" onGhostAction={load} />
      <div className="kpi-grid talent-kpis">
        <Kpi icon="users" label="Total de candidatos" value={total} delta="base cadastrada" />
        <Kpi icon="check" label="Disponiveis" value={summary?.available || 0} delta="aptos para contato" success />
        <Kpi icon="clock" label="Em analise" value={summary?.analysis || 0} delta="avaliacao em andamento" warning />
        <Kpi icon="star" label="Selecionados" value={summary?.selected || 0} delta="aprovados ou reserva" />
        <Kpi icon="home" label="Contratados" value={summary?.hired || 0} delta="efetivados" success />
        <Kpi icon="file" label="Recentes" value={summary?.recent || 0} delta="ultimos 30 dias" />
      </div>
      {total === 0 && !loading && <div className="talent-start-panel">
        <div>
          <span className="eyebrow">Base em implantacao</span>
          <h3>Comece pelos perfis mais recorrentes da operacao</h3>
          <p>Cadastre candidatos para funcoes criticas, registre CNH e disponibilidade, e use status para manter a triagem organizada.</p>
        </div>
        <div className="talent-start-actions">
          <button className="btn btn-primary" onClick={() => { window.location.hash = '#/talentNew'; }}>Cadastrar primeiro candidato</button>
          <button className="btn" onClick={() => { window.location.hash = '#/talents'; }}>Abrir pesquisa</button>
        </div>
      </div>}
      <div className="talent-command-grid">
        <Panel title="Funil de triagem" padded>
          <div className="talent-pipeline">{pipeline.map(([label, value, sub]) => <button type="button" key={label} onClick={() => goSearch(label)}><b>{value}</b><span>{label}</span><small>{sub}</small></button>)}</div>
        </Panel>
        <Panel title="Busca rapida" padded>
          <div className="talent-search-chips">{quickSearches.map((term) => <button type="button" key={term} onClick={() => goSearch(term)}>{term}</button>)}</div>
          <div className="talent-readiness">
            <div><b>{summary?.cnhCount || 0}</b><span>com CNH registrada</span></div>
            <div><b>{summary?.available || 0}</b><span>disponiveis para contato</span></div>
          </div>
        </Panel>
      </div>
      <div className="talent-dashboard-grid">
        <Panel title="Cadastros recentes">{latest.length || loading ? <DataTable columns={['Nome', 'Telefone', 'Funcao de interesse', 'Status', 'Cadastro']} rows={latest} loading={loading} /> : <TalentEmptyState title="Nenhum cadastro recente" text="Os candidatos cadastrados nos ultimos dias aparecem aqui para triagem rapida." action="Novo candidato" onAction={() => { window.location.hash = '#/talentNew'; }} />}</Panel>
        <Panel title="Funcoes mais procuradas" padded>{roles.length ? <BarChart data={roles.map(([label, value]) => ({ label, value }))} /> : <TalentEmptyState title="Sem funcoes mapeadas" text="Ao preencher a funcao de interesse, o sistema mostra onde existe maior disponibilidade." />}</Panel>
      </div>
      <div className="talent-dashboard-grid compact">
        <Panel title="Candidatos por cidade"><DataTable columns={['Cidade', 'Total']} rows={cityRows} loading={loading} /></Panel>
        <Panel title="Escolaridade"><DataTable columns={['Escolaridade', 'Total']} rows={educationRows} loading={loading} /></Panel>
      </div>
      <Panel title="Ultimas movimentacoes">{movements.length || loading ? <DataTable columns={['Data', 'Candidato', 'Movimento', 'Status']} rows={movements} loading={loading} /> : <TalentEmptyState title="Sem movimentacoes ainda" text="Alteracoes de status, edicoes e arquivamentos ficarao registrados neste historico." />}</Panel>
    </>
  );
}

function TalentEmptyState({ title, text, action, onAction }) {
  return <div className="talent-empty"><b>{title}</b><span>{text}</span>{action && <button className="btn btn-sm" onClick={onAction}>{action}</button>}</div>;
}

function TalentBank({ notify, editable = true, mode = 'list' }) {
  const baseFilters = { q: '', status: 'Todos', desiredRole: '', city: '', state: '', hasCnh: 'Todos', sort: 'createdAt', direction: 'desc' };
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(baseFilters);
  const [formOpen, setFormOpen] = useState(mode === 'new');
  const [profileId, setProfileId] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const load = (next = filters, offset = meta.offset || 0) => {
    const query = new URLSearchParams({ limit: String(meta.limit || 25), offset: String(offset), sort: next.sort, direction: next.direction });
    Object.entries(next).forEach(([key, value]) => {
      if (value && !['Todos', 'Todas'].includes(value)) query.set(key, value);
    });
    setLoading(true);
    api(`/api/talents?${query.toString()}`).then((payload) => {
      setItems(listData(payload));
      setMeta(payload.meta || { total: listData(payload).length, limit: 25, offset });
    }).catch((error) => notify(error.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(filters, 0); }, [filters.q, filters.status, filters.desiredRole, filters.city, filters.state, filters.hasCnh, filters.sort, filters.direction]);
  useEffect(() => { if (mode === 'new') setFormOpen(true); }, [mode]);
  useEffect(() => {
    const onSearch = (event) => setFilters((old) => ({ ...old, q: event.detail || '' }));
    window.addEventListener('sf:talent-search', onSearch);
    return () => window.removeEventListener('sf:talent-search', onSearch);
  }, []);
  const save = async (form) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!isValidCpf(form.cpf)) return notify('Informe um CPF valido');
    await withBusy(() => api(editing?.id ? `/api/talents/${editing.id}` : '/api/talents', { method: editing?.id ? 'PUT' : 'POST', body: JSON.stringify(talentPayload(form)) }));
    notify(editing?.id ? 'Cadastro atualizado' : 'Candidato cadastrado');
    setFormOpen(false);
    setEditing(null);
    load(filters, 0);
    if (mode === 'new') window.location.hash = '#/talents';
  };
  const changeStatus = async (item, status = '') => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const nextStatus = status || prompt('Novo status do candidato:', item.status);
    if (!nextStatus || nextStatus === item.status) return;
    await withBusy(() => api(`/api/talents/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }));
    notify('Status atualizado');
    load();
  };
  const archive = (item) => {
    if (!confirm('Deseja realmente arquivar este candidato? O cadastro permanecera disponivel no historico.')) return;
    changeStatus(item, 'Arquivado');
  };
  const deleteCandidate = async (item) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await withBusy(() => api(`/api/talents/${item.id}`, { method: 'DELETE' }));
    setConfirmDelete(null);
    setProfileId('');
    notify('Candidato apagado');
    load(filters, 0);
  };
  const exportRows = () => downloadCsv('banco-de-talentos.csv', [['Nome', 'Telefone', 'Cidade', 'Funcao de interesse', 'Ultima funcao', 'Escolaridade', 'Disponibilidade', 'Pretensao salarial', 'Status', 'Cadastro'], ...items.map((item) => [item.fullName, item.phone, item.city, item.desiredRole, item.lastRole, item.education, item.startAvailability, money(item.salaryExpectation), item.status, date(item.createdAt)])]);
  const page = Math.floor((meta.offset || 0) / (meta.limit || 25)) + 1;
  return (
    <>
      <PageHead title="Banco de Talentos" subtitle="Pesquisa, filtros e acompanhamento dos candidatos cadastrados." ghostActions={['Exportar CSV', 'Limpar filtros']} onGhostAction={(label) => label === 'Exportar CSV' ? exportRows() : setFilters(baseFilters)} action={editable ? 'Novo candidato' : null} onAction={() => { setEditing(null); setFormOpen(true); }} />
      <div className="toolbar talent-toolbar">
        <div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="Nome, CPF, telefone, funcao..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option>{talentStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="filter"><label>Funcao</label><input value={filters.desiredRole} onChange={(event) => setFilters((old) => ({ ...old, desiredRole: event.target.value }))} placeholder="Motorista, auxiliar..." /></div>
        <div className="filter"><label>Cidade</label><input value={filters.city} onChange={(event) => setFilters((old) => ({ ...old, city: event.target.value }))} /></div>
        <div className="filter"><label>UF</label><input value={filters.state} onChange={(event) => setFilters((old) => ({ ...old, state: event.target.value.toUpperCase().slice(0, 2) }))} /></div>
        <div className="filter"><label>CNH</label><select value={filters.hasCnh} onChange={(event) => setFilters((old) => ({ ...old, hasCnh: event.target.value }))}><option>Todos</option><option>Sim</option><option>Nao</option></select></div>
        <div className="filter"><label>Ordenar</label><select value={filters.sort} onChange={(event) => setFilters((old) => ({ ...old, sort: event.target.value }))}><option value="createdAt">Cadastro</option><option value="fullName">Nome</option><option value="startAvailability">Disponibilidade</option><option value="salaryExpectation">Pretensao</option><option value="status">Status</option></select></div>
        <span className="spacer" /><span className="soft">{meta.total || 0} registros</span>
      </div>
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-head"><h3>Candidatos cadastrados</h3><div className="actions"><button className="btn btn-sm" disabled={(meta.offset || 0) <= 0} onClick={() => load(filters, Math.max((meta.offset || 0) - (meta.limit || 25), 0))}>Anterior</button><span className="soft">Pagina {page}</span><button className="btn btn-sm" disabled={(meta.offset || 0) + (meta.limit || 25) >= (meta.total || 0)} onClick={() => load(filters, (meta.offset || 0) + (meta.limit || 25))}>Proxima</button></div></div>
        <div className="panel-body talent-list-body">{loading ? <LoadingBlock /> : items.length ? <div className="talent-list">{items.map((item) => <div className="talent-row" key={item.id}>
          <div className="talent-person">
            <b>{item.fullName}</b>
            <span>{[formatPhone(item.phone), item.email].filter(Boolean).join(' · ') || 'Contato nao informado'}</span>
            <small>{[item.city, item.state].filter(Boolean).join(' / ') || 'Cidade nao informada'} · {item.relatedCompany || 'Banco Geral'}</small>
          </div>
          <div className="talent-role">
            <span>Funcao de interesse</span>
            <b>{item.desiredRole || '-'}</b>
            <small>Ultima funcao: {item.lastRole || '-'}</small>
          </div>
          <div className="talent-profile-summary">
            <span>{item.education || 'Escolaridade nao informada'}</span>
            <b>{item.startAvailability || 'Disponibilidade nao informada'}</b>
            <small>{money(item.salaryExpectation)}</small>
          </div>
          <div className="talent-status-cell">
            <Pill value={item.status} />
            <small>Cadastro: {date(item.createdAt)}</small>
          </div>
          <div className="talent-row-actions">
            <button className="btn btn-sm" onClick={() => setProfileId(item.id)}>Visualizar</button>
            {editable && <button className="btn btn-sm" onClick={() => { setEditing(item); setFormOpen(true); }}>Editar</button>}
            {editable && <ActionMenu actions={[{ label: 'Alterar status', onClick: () => changeStatus(item) }, item.status !== 'Arquivado' && { label: 'Arquivar', danger: true, onClick: () => archive(item) }, { label: 'Apagar candidato', danger: true, onClick: () => setConfirmDelete(item) }]} />}
          </div>
        </div>)}</div> : <div className="empty-state"><b>Nenhum candidato encontrado</b><span>Nao encontramos candidatos utilizando os filtros selecionados.</span><button className="btn btn-sm" onClick={() => setFilters(baseFilters)}>Limpar filtros</button></div>}</div>
      </div>
      {formOpen && <TalentForm initial={editing ? talentToForm(editing) : talentInitialForm()} onCancel={() => { setFormOpen(false); setEditing(null); if (mode === 'new') window.location.hash = '#/talents'; }} onSave={save} />}
      {profileId && <TalentProfile id={profileId} onClose={() => setProfileId('')} onEdit={(candidate) => { setProfileId(''); setEditing(candidate); setFormOpen(true); }} onStatus={changeStatus} editable={editable} />}
      {confirmDelete && <ConfirmModal title="Apagar candidato" text={`Deseja apagar o cadastro de ${confirmDelete.fullName}? Essa acao remove o candidato e o historico dele do Banco de Talentos.`} confirmLabel="Apagar candidato" danger onCancel={() => setConfirmDelete(null)} onConfirm={() => deleteCandidate(confirmDelete)} />}
    </>
  );
}

function TalentForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const toggleSchedule = (value) => setForm((old) => {
    const selected = new Set(old.scheduleAvailability || []);
    selected.has(value) ? selected.delete(value) : selected.add(value);
    return { ...old, scheduleAvailability: Array.from(selected) };
  });
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal talent-modal">
        <div className="modal-head"><h3>{initial.id ? 'Editar candidato' : 'Novo candidato'}</h3><button className="btn btn-sm" onClick={onCancel} disabled={submitting}>Fechar</button></div>
        <form className="modal-body talent-form" onSubmit={submit}>
          <h4>Dados pessoais</h4>
          <div className="form-grid">
            <div className="form-field full"><label>Nome completo *</label><input value={form.fullName} required onChange={(e) => change('fullName', formatPersonNameInput(e.target.value))} /></div>
            <div className="form-field"><label>CPF *</label><input value={form.cpf} required maxLength={14} onChange={(e) => change('cpf', formatCpf(e.target.value))} /></div>
            <div className="form-field"><label>RG / Identidade</label><input value={form.rg || ''} onChange={(e) => change('rg', e.target.value)} /></div>
            <div className="form-field"><label>Data de nascimento</label><input type="date" value={form.birthDate || ''} onChange={(e) => change('birthDate', e.target.value)} /></div>
            <div className="form-field"><label>Telefone / WhatsApp</label><input value={form.phone || ''} onChange={(e) => change('phone', formatPhone(e.target.value))} /></div>
            <div className="form-field"><label>E-mail</label><input type="email" value={form.email || ''} onChange={(e) => change('email', e.target.value)} /></div>
          </div>
          <h4>Endereco</h4>
          <div className="form-grid">
            <div className="form-field"><label>CEP</label><input value={form.zipCode || ''} onChange={(e) => change('zipCode', e.target.value)} /></div>
            <div className="form-field"><label>Logradouro</label><input value={form.street || ''} onChange={(e) => change('street', e.target.value)} /></div>
            <div className="form-field"><label>Numero</label><input value={form.number || ''} onChange={(e) => change('number', e.target.value)} /></div>
            <div className="form-field"><label>Complemento</label><input value={form.complement || ''} onChange={(e) => change('complement', e.target.value)} /></div>
            <div className="form-field"><label>Bairro</label><input value={form.district || ''} onChange={(e) => change('district', e.target.value)} /></div>
            <div className="form-field"><label>Cidade</label><input value={form.city || ''} onChange={(e) => change('city', e.target.value)} /></div>
            <div className="form-field"><label>Estado</label><input value={form.state || ''} maxLength={2} onChange={(e) => change('state', e.target.value.toUpperCase())} /></div>
          </div>
          <h4>Formacao e experiencia</h4>
          <div className="form-grid">
            <div className="form-field"><label>Escolaridade</label><select value={form.education || ''} onChange={(e) => change('education', e.target.value)}>{talentEducationOptions.map((item) => <option key={item || '-'}>{item || '-'}</option>)}</select></div>
            <div className="form-field"><label>Ultima funcao exercida</label><input value={form.lastRole || ''} onChange={(e) => change('lastRole', e.target.value)} /></div>
            <div className="form-field full"><label>Cursos e qualificacoes</label><textarea value={form.coursesText || ''} onChange={(e) => change('coursesText', e.target.value)} placeholder="Curso - Instituicao - Ano" /></div>
            <div className="form-field full"><label>Experiencia profissional</label><textarea value={form.experiencesText || ''} onChange={(e) => change('experiencesText', e.target.value)} placeholder="Empresa - Funcao - Periodo" /></div>
          </div>
          <h4>Interesse e disponibilidade</h4>
          <div className="form-grid">
            <div className="form-field"><label>Funcao de interesse</label><input value={form.desiredRole || ''} onChange={(e) => change('desiredRole', e.target.value)} /></div>
            <div className="form-field"><label>Disponibilidade para inicio</label><select value={form.startAvailability || ''} onChange={(e) => change('startAvailability', e.target.value)}>{talentAvailabilityOptions.map((item) => <option key={item || '-'}>{item || '-'}</option>)}</select></div>
            <div className="form-field"><label>Pretensao salarial</label><input value={form.salaryExpectation || ''} onChange={(e) => change('salaryExpectation', e.target.value)} onBlur={(e) => change('salaryExpectation', money(parseMoney(e.target.value)))} /></div>
            <div className="form-field"><label>Empresa / Unidade relacionada</label><select value={form.relatedCompany || 'Banco Geral'} onChange={(e) => change('relatedCompany', e.target.value)}>{talentCompanyOptions.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="form-field full"><label>Disponibilidade de horario</label><div className="check-grid">{talentScheduleOptions.map((item) => <label key={item}><input type="checkbox" checked={(form.scheduleAvailability || []).includes(item)} onChange={() => toggleSchedule(item)} /> {item}</label>)}</div></div>
          </div>
          <h4>CNH, LGPD e observacoes</h4>
          <div className="form-grid">
            <div className="form-field"><label>Possui CNH?</label><select value={form.hasCnh ? 'Sim' : 'Nao'} onChange={(e) => change('hasCnh', e.target.value === 'Sim')}><option>Nao</option><option>Sim</option></select></div>
            {form.hasCnh && <><div className="form-field"><label>Categoria</label><select value={form.cnhCategory || ''} onChange={(e) => change('cnhCategory', e.target.value)}>{talentCnhCategories.map((item) => <option key={item || '-'}>{item || '-'}</option>)}</select></div><div className="form-field"><label>Numero da CNH</label><input value={form.cnhNumber || ''} onChange={(e) => change('cnhNumber', e.target.value)} /></div><div className="form-field"><label>Validade da CNH</label><input type="date" value={form.cnhExpiration || ''} onChange={(e) => change('cnhExpiration', e.target.value)} /></div></>}
            <div className="form-field"><label>Status</label><select value={form.status || 'Novo cadastro'} onChange={(e) => change('status', e.target.value)}>{talentStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="form-field"><label>Origem do cadastro</label><input value={form.source || ''} onChange={(e) => change('source', e.target.value)} /></div>
            <div className="form-field"><label>Consentimento LGPD</label><select value={form.consentStorage ? 'Sim' : 'Nao'} onChange={(e) => change('consentStorage', e.target.value === 'Sim')}><option>Sim</option><option>Nao</option></select></div>
            <div className="form-field"><label>Data do consentimento</label><input type="date" value={form.consentDate || ''} onChange={(e) => change('consentDate', e.target.value)} /></div>
            <div className="form-field full"><label>Observacoes internas</label><textarea value={form.internalNotes || ''} onChange={(e) => change('internalNotes', e.target.value)} /></div>
          </div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="btn btn-primary" disabled={submitting}>{submitting ? <LoadingSpinner small /> : 'Salvar candidato'}</button></div>
        </form>
      </div>
    </div>
  );
}

function TalentProfile({ id, onClose, onEdit, onStatus, editable }) {
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api(`/api/talents/${id}`).then((payload) => setCandidate(payload.data)).finally(() => setLoading(false));
  }, [id]);
  if (loading || !candidate) return <div className="modal-backdrop"><div className="modal"><div className="modal-body"><LoadingBlock /></div></div></div>;
  const info = [
    ['CPF', formatCpf(candidate.cpf)], ['RG', candidate.rg], ['Nascimento', date(candidate.birthDate)], ['Telefone', formatPhone(candidate.phone)], ['E-mail', candidate.email],
    ['Endereco', [candidate.street, candidate.number, candidate.district, candidate.city, candidate.state].filter(Boolean).join(', ')],
    ['Escolaridade', candidate.education], ['Funcao de interesse', candidate.desiredRole], ['Ultima funcao', candidate.lastRole], ['Disponibilidade', candidate.startAvailability],
    ['Horario', candidate.scheduleAvailability], ['Pretensao', money(candidate.salaryExpectation)], ['CNH', candidate.hasCnh ? candidate.cnhCategory || 'Sim' : 'Nao'],
    ['Empresa / Unidade', candidate.relatedCompany], ['Consentimento', candidate.consentStorage ? `Sim - ${date(candidate.consentDate)}` : 'Nao'], ['Origem', candidate.source]
  ];
  const historyRows = (candidate.history || []).map((item) => [dateTime(item.createdAt), item.action, item.fromStatus || '-', item.toStatus ? <Pill value={item.toStatus} /> : '-', item.userName || '-']);
  return (
    <div className="modal-backdrop">
      <div className="modal talent-profile-modal">
        <div className="modal-head"><h3>{candidate.fullName}</h3><button className="btn btn-sm" onClick={onClose}>Fechar</button></div>
        <div className="modal-body">
          <div className="talent-profile-head"><div><div className="eyebrow">Perfil do candidato</div><h2>{candidate.fullName}</h2><Pill value={candidate.status} /></div><div className="actions">{editable && <button className="btn" onClick={() => onEdit(candidate)}>Editar cadastro</button>}{editable && <button className="btn btn-primary" onClick={() => onStatus(candidate)}>Alterar status</button>}</div></div>
          <Panel title="Dados do candidato" padded><div className="profile-info-grid">{info.map(([label, value]) => <div key={label} className="field-row"><b>{label}</b><span>{displayValue(value)}</span></div>)}</div></Panel>
          <div className="talent-profile-grid">
            <Panel title="Cursos e qualificacoes" padded>{Array.isArray(candidate.courses) && candidate.courses.length ? candidate.courses.map((item, index) => <p key={index}><b>{item.name}</b><br /><span className="soft">{[item.institution, item.year].filter(Boolean).join(' - ')}</span></p>) : <p className="soft">Nenhum curso registrado.</p>}</Panel>
            <Panel title="Experiencia profissional" padded>{Array.isArray(candidate.experiences) && candidate.experiences.length ? candidate.experiences.map((item, index) => <p key={index}><b>{item.role}</b><br /><span className="soft">{[item.company, item.period].filter(Boolean).join(' - ')}</span></p>) : <p className="soft">Nenhuma experiencia registrada.</p>}</Panel>
          </div>
          <Panel title="Observacoes internas" padded><p>{candidate.internalNotes || '-'}</p></Panel>
          <Panel title="Historico"><DataTable columns={['Data', 'Acao', 'De', 'Para', 'Usuario']} rows={historyRows} /></Panel>
        </div>
      </div>
    </div>
  );
}

function TalentJobs({ notify, editable = true }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: 'Todos' });
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const load = () => {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.status !== 'Todos') query.set('status', filters.status);
    setLoading(true);
    api(`/api/talents/jobs?${query.toString()}`).then((payload) => setJobs(listData(payload))).catch((error) => notify(error.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filters.q, filters.status]);
  const save = async (form) => {
    const payload = { ...form, status: form.status || 'Rascunho' };
    await withBusy(() => api(form.id ? `/api/talents/jobs/${form.id}` : '/api/talents/jobs', { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }));
    setModal(null);
    notify('Vaga salva');
    load();
  };
  const deleteJob = async (job) => {
    await withBusy(() => api(`/api/talents/jobs/${job.id}`, { method: 'DELETE' }));
    setConfirmDelete(null);
    notify('Vaga apagada');
    load();
  };
  const publicJobsUrl = () => `${location.origin}${location.pathname}#/trabalhe-conosco`;
  const copyPublicJobsUrl = () => {
    navigator.clipboard?.writeText(publicJobsUrl());
    notify('Link publico copiado');
  };
  return (
    <>
      <PageHead title="Vagas" subtitle="Cadastro interno de vagas publicadas na pagina Trabalhe Conosco." action={editable ? 'Nova vaga' : null} onAction={() => setModal({ status: 'Rascunho', companyUnit: 'SF TORRES', workMode: 'Presencial', contractType: 'CLT' })} ghostAction="Abrir pagina publica" onGhostAction={() => { window.location.hash = '#/trabalhe-conosco'; }} />
      <div className="toolbar"><div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="Funcao, setor, local..." /></div><div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Rascunho</option><option>Publicada</option><option>Pausada</option><option>Encerrada</option></select></div><span className="spacer" /><span className="soft">{jobs.length} vagas</span></div>
      <Panel title="Vagas cadastradas"><DataTable columns={['Vaga', 'Status', 'Contrato', 'Modelo', 'Candidaturas', 'Publicacao', 'Acoes']} rows={jobs.map((job) => [<><b>{job.title}</b><div className="soft">{[job.department, job.location].filter(Boolean).join(' - ')}</div></>, <Pill value={job.status} />, job.contractType || '-', job.workMode || '-', job._count?.applications || 0, date(job.publishedAt), editable ? <div className="table-action-row"><button className="btn btn-sm" onClick={() => setModal(job)}>Editar</button><ActionMenu actions={[{ label: 'Copiar link publico', onClick: copyPublicJobsUrl }, { label: 'Apagar vaga', danger: true, disabled: (job._count?.applications || 0) > 0, onClick: () => setConfirmDelete(job) }]} /></div> : '-'])} loading={loading} /></Panel>
      {modal && <TalentJobForm initial={modal} onCancel={() => setModal(null)} onSave={save} />}
      {confirmDelete && <ConfirmModal title="Apagar vaga" text={`Deseja apagar a vaga "${confirmDelete.title}"? Essa acao nao pode ser desfeita.`} confirmLabel="Apagar vaga" danger onCancel={() => setConfirmDelete(null)} onConfirm={() => deleteJob(confirmDelete)} />}
    </>
  );
}

function TalentJobForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState({
    responsibilitiesText: Array.isArray(initial.responsibilities) ? initial.responsibilities.join('\n') : '',
    requirementsText: Array.isArray(initial.requirements) ? initial.requirements.join('\n') : '',
    benefitsText: Array.isArray(initial.benefits) ? initial.benefits.join('\n') : '',
    ...initial
  });
  const [submitting, setSubmitting] = useState(false);
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="modal-backdrop"><div className="modal talent-modal"><div className="modal-head"><h3>{form.id ? 'Editar vaga' : 'Nova vaga'}</h3><button className="btn btn-sm" onClick={onCancel}>Fechar</button></div><form className="modal-body talent-form" onSubmit={submit}>
    <div className="form-grid">
      <div className="form-field full"><label>Titulo da vaga *</label><input required value={form.title || ''} onChange={(e) => change('title', e.target.value)} /></div>
      <div className="form-field"><label>Setor</label><input value={form.department || ''} onChange={(e) => change('department', e.target.value)} /></div>
      <div className="form-field"><label>Local</label><input value={form.location || ''} onChange={(e) => change('location', e.target.value)} placeholder="Manaus / AM" /></div>
      <div className="form-field"><label>Contrato</label><select value={form.contractType || ''} onChange={(e) => change('contractType', e.target.value)}><option>CLT</option><option>Temporario</option><option>Estagio</option><option>Prestador</option></select></div>
      <div className="form-field"><label>Modelo</label><select value={form.workMode || ''} onChange={(e) => change('workMode', e.target.value)}><option>Presencial</option><option>Hibrido</option><option>Remoto</option></select></div>
      <div className="form-field"><label>Faixa salarial</label><input value={form.salaryRange || ''} onChange={(e) => change('salaryRange', e.target.value)} placeholder="A combinar ou R$ 2.000 - R$ 2.500" /></div>
      <div className="form-field"><label>Status</label><select value={form.status || 'Rascunho'} onChange={(e) => change('status', e.target.value)}><option>Rascunho</option><option>Publicada</option><option>Pausada</option><option>Encerrada</option></select></div>
      <div className="form-field full"><label>Resumo da vaga</label><textarea value={form.summary || ''} onChange={(e) => change('summary', e.target.value)} /></div>
      <div className="form-field full"><label>Responsabilidades</label><textarea value={form.responsibilitiesText || ''} onChange={(e) => change('responsibilitiesText', e.target.value)} placeholder="Uma responsabilidade por linha" /></div>
      <div className="form-field full"><label>Requisitos</label><textarea value={form.requirementsText || ''} onChange={(e) => change('requirementsText', e.target.value)} placeholder="Um requisito por linha" /></div>
      <div className="form-field full"><label>Beneficios</label><textarea value={form.benefitsText || ''} onChange={(e) => change('benefitsText', e.target.value)} placeholder="Um beneficio por linha" /></div>
    </div>
    <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancelar</button><button className="btn btn-primary" disabled={submitting}>{submitting ? <LoadingSpinner small /> : 'Salvar vaga'}</button></div>
  </form></div></div>;
}

function TalentApplicationsLegacy({ notify, editable = true }) {
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: 'Todos', jobId: 'Todos' });
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const load = () => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && value !== 'Todos' && query.set(key, value));
    setLoading(true);
    Promise.all([api(`/api/talents/applications?${query.toString()}`), api('/api/talents/jobs')]).then(([apps, jobPayload]) => {
      setItems(listData(apps));
      setJobs(listData(jobPayload));
    }).catch((error) => notify(error.message)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filters.q, filters.status, filters.jobId]);
  const setStatus = async (item, status, internalNotes = item.internalNotes || '') => {
    const payload = await withBusy(() => api(`/api/talents/applications/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, internalNotes }) }));
    notify('Candidatura atualizada');
    setReview(status === 'Em analise' && internalNotes === (item.internalNotes || '') ? payload.data : null);
    load();
    return payload.data;
  };
  const convert = async (item) => {
    await withBusy(() => api(`/api/talents/applications/${item.id}/convert`, { method: 'POST', body: JSON.stringify({}) }));
    notify('Candidatura enviada para o Banco de Talentos');
    setReview(null);
    load();
  };
  const rows = items.map((item) => [<><b>{item.fullName}</b><div className="soft">{item.email} · {formatPhone(item.phone)}</div></>, item.job?.title || '-', <Pill value={item.status} />, [item.city, item.state].filter(Boolean).join(' / ') || '-', item.experienceYears || '-', money(item.desiredSalary), date(item.createdAt), editable ? <><button className="btn btn-sm" onClick={() => setStatus(item, 'Em analise')}>Analisar</button> <button className="btn btn-sm btn-primary" onClick={() => convert(item)}>Aprovar para banco</button> <button className="btn btn-sm btn-danger" onClick={() => setStatus(item, 'Reprovada')}>Reprovar</button></> : '-']);
  return <>
    <PageHead title="Candidaturas externas" subtitle="Triagem das inscricoes recebidas pela pagina publica antes de entrar no Banco de Talentos." action="Atualizar" onAction={load} />
    <div className="toolbar"><div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="Nome, email, cidade..." /></div><div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Nova</option><option>Em analise</option><option>Convertida</option><option>Reprovada</option></select></div><div className="filter"><label>Vaga</label><select value={filters.jobId} onChange={(event) => setFilters((old) => ({ ...old, jobId: event.target.value }))}><option>Todos</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div><span className="spacer" /><span className="soft">{items.length} candidaturas</span></div>
    <Panel title="Candidaturas recebidas"><DataTable columns={['Candidato', 'Vaga', 'Status', 'Cidade', 'Experiencia', 'Pretensao', 'Recebida em', 'Acoes']} rows={rows} loading={loading} /></Panel>
    {review && <TalentApplicationReview item={review} onClose={() => setReview(null)} onSaveStatus={setStatus} onConvert={convert} />}
  </>;
}

function TalentApplications({ notify, editable = true }) {
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ q: '', status: 'Todos', jobId: 'Todos' });
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && value !== 'Todos' && query.set(key, value));
    setLoading(true);
    Promise.all([api(`/api/talents/applications?${query.toString()}`), api('/api/talents/jobs')]).then(([apps, jobPayload]) => {
      setItems(listData(apps));
      setJobs(listData(jobPayload));
    }).catch((error) => notify(error.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters.q, filters.status, filters.jobId]);

  const setStatus = async (item, status, internalNotes = item.internalNotes || '') => {
    try {
      setBusyId(item.id);
      const payload = await withBusy(() => api(`/api/talents/applications/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status, internalNotes }) }));
      notify('Candidatura atualizada');
      setReview(null);
      load();
      return payload.data;
    } finally {
      setBusyId('');
    }
  };

  const openReview = async (item) => {
    try {
      setBusyId(item.id);
      const detail = await withBusy(() => api(`/api/talents/applications/${item.id}`));
      const current = detail.data;
      if (current.status === 'Nova') {
        const updated = await api(`/api/talents/applications/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Em analise', internalNotes: current.internalNotes || '' }) });
        notify('Candidatura em analise');
        setReview(updated.data);
        load();
        return;
      }
      setReview(current);
    } catch (error) {
      notify(error.message);
    } finally {
      setBusyId('');
    }
  };

  const convert = async (item) => {
    try {
      setBusyId(item.id);
      await withBusy(() => api(`/api/talents/applications/${item.id}/convert`, { method: 'POST', body: JSON.stringify({}) }));
      notify('Candidatura enviada para o Banco de Talentos');
      setReview(null);
      load();
    } finally {
      setBusyId('');
    }
  };
  const deleteApplication = async (item) => {
    try {
      setBusyId(item.id);
      await withBusy(() => api(`/api/talents/applications/${item.id}`, { method: 'DELETE' }));
      setConfirmDelete(null);
      setReview(null);
      notify('Candidatura apagada');
      load();
    } finally {
      setBusyId('');
    }
  };

  return <>
    <PageHead title="Candidaturas externas" subtitle="Triagem das inscricoes recebidas pela pagina publica antes de entrar no Banco de Talentos." action="Atualizar" onAction={load} />
    <div className="toolbar"><div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="Nome, email, cidade..." /></div><div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Nova</option><option>Em analise</option><option>Convertida</option><option>Reprovada</option></select></div><div className="filter"><label>Vaga</label><select value={filters.jobId} onChange={(event) => setFilters((old) => ({ ...old, jobId: event.target.value }))}><option>Todos</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div><span className="spacer" /><span className="soft">{items.length} candidaturas</span></div>
    <Panel title="Candidaturas recebidas">
      {loading ? <LoadingBlock /> : items.length ? <div className="application-list">{items.map((item) => <div className="application-card" key={item.id}>
        <div className="application-main">
          <div className="application-person"><b>{item.fullName}</b><span>{item.email} · {formatPhone(item.phone)}</span><small>{[item.city, item.state].filter(Boolean).join(' / ') || 'Cidade nao informada'} · Recebida em {date(item.createdAt)}</small></div>
          <div className="application-job"><span>Vaga</span><b>{item.job?.title || '-'}</b><small>{item.experienceYears || 'Experiencia nao informada'} · {money(item.desiredSalary)}</small></div>
          <div className="application-status"><Pill value={item.status} />{item.resume?.name && <small>Curriculo anexado</small>}</div>
        </div>
        <div className="application-actions">
          <button className="btn btn-sm" disabled={!editable || busyId === item.id} onClick={() => openReview(item)}>{busyId === item.id ? 'Abrindo...' : 'Analisar'}</button>
          <button className="btn btn-sm btn-primary" disabled={!editable || busyId === item.id || item.status === 'Convertida'} onClick={() => convert(item)}>Aprovar para banco</button>
          <ActionMenu actions={[{ label: 'Reprovar', danger: true, disabled: !editable || busyId === item.id || item.status === 'Reprovada', onClick: () => setStatus(item, 'Reprovada') }, { label: 'Apagar candidatura', danger: true, disabled: !editable || busyId === item.id, onClick: () => setConfirmDelete(item) }]} />
        </div>
      </div>)}</div> : <TalentEmptyState title="Nenhuma candidatura recebida" text="As inscricoes vindas da pagina publica aparecerao aqui para triagem." />}
    </Panel>
    {review && <TalentApplicationReview item={review} onClose={() => setReview(null)} onSaveStatus={setStatus} onConvert={convert} notify={notify} />}
    {confirmDelete && <ConfirmModal title="Apagar candidatura" text={`Deseja apagar a candidatura de ${confirmDelete.fullName}? Essa acao remove a inscricao externa e nao pode ser desfeita.`} confirmLabel="Apagar candidatura" danger onCancel={() => setConfirmDelete(null)} onConfirm={() => deleteApplication(confirmDelete)} />}
  </>;
}

function TalentApplicationReview({ item, onClose, onSaveStatus, onConvert, notify }) {
  const [status, setStatus] = useState(item.status || 'Em analise');
  const [internalNotes, setInternalNotes] = useState(item.internalNotes || '');
  const [openingResume, setOpeningResume] = useState(false);
  const resume = item.resume || null;
  const whatsapp = whatsappUrl(item.phone, `Ola, ${item.fullName}. Somos da SF TORRES e estamos falando sobre sua candidatura para a vaga ${item.job?.title || 'Trabalhe Conosco'}. Podemos conversar?`);
  const info = [
    ['Candidato', item.fullName],
    ['CPF', formatCpf(item.cpf)],
    ['E-mail', item.email],
    ['Telefone', formatPhone(item.phone)],
    ['Cidade', [item.city, item.state].filter(Boolean).join(' / ')],
    ['Vaga', item.job?.title],
    ['Escolaridade', item.education],
    ['Experiencia', item.experienceYears],
    ['Ultima funcao', item.lastRole],
    ['Pretensao', money(item.desiredSalary)],
    ['Disponibilidade', date(item.availableStartDate)],
    ['LinkedIn', item.linkedinUrl],
    ['Portfolio', item.portfolioUrl],
    ['Recebida em', date(item.createdAt)]
  ];
  const save = () => onSaveStatus(item, status, internalNotes);
  const openResume = async (download = false) => {
    try {
      setOpeningResume(true);
      await openProtectedFile(`/api/talents/applications/${item.id}/resume`, resume?.name || 'curriculo', download);
    } catch (error) {
      notify?.(error.message);
    } finally {
      setOpeningResume(false);
    }
  };
  return <div className="modal-backdrop">
    <div className="modal talent-application-modal">
      <div className="modal-head"><h3>Analisar candidatura</h3><button className="btn btn-sm" onClick={onClose}>Fechar</button></div>
      <div className="modal-body">
        <div className="talent-profile-head">
          <div><h2>{item.fullName}</h2><Pill value={status} /></div>
          <div className="talent-row-actions">{whatsapp && <a className="btn btn-sm btn-success" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}<button className="btn btn-sm btn-primary" onClick={() => onConvert(item)}>Aprovar para banco</button><button className="btn btn-sm btn-danger" onClick={() => onSaveStatus(item, 'Reprovada', internalNotes)}>Reprovar</button></div>
        </div>
        <Panel title="Dados recebidos" padded><div className="profile-info-grid">{info.map(([label, value]) => <div key={label} className="field-row"><b>{label}</b><span>{displayValue(value)}</span></div>)}</div></Panel>
        <Panel title="Curriculo" padded>
          {resume?.name ? <div className="resume-box"><div><b>{resume.name}</b><span>{formatFileSize(resume.size)} {resume.type ? `- ${resume.type}` : ''}</span></div><div className="resume-actions"><button className="btn btn-sm btn-primary" disabled={openingResume} onClick={() => openResume(false)}>{openingResume ? 'Abrindo...' : 'Abrir curriculo'}</button><button className="btn btn-sm" disabled={openingResume} onClick={() => openResume(true)}>Baixar</button></div></div> : <p className="soft">Nenhum curriculo anexado.</p>}
        </Panel>
        <Panel title="Apresentacao do candidato" padded><p className="soft multiline">{item.coverLetter || 'Sem apresentacao informada.'}</p></Panel>
        <Panel title="Parecer interno" padded>
          <div className="form-grid">
            <div className="form-field"><label>Status</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option>Nova</option><option>Em analise</option><option>Convertida</option><option>Reprovada</option></select></div>
            <div className="form-field full"><label>Observacoes da triagem</label><textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Registre retorno, pontos fortes, restricoes ou proximo passo." /></div>
          </div>
        </Panel>
        <div className="modal-actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save}>Salvar analise</button></div>
      </div>
    </div>
  </div>;
}

function LeaderMobileNav({ active, title, onRefresh }) {
  const user = currentUser();
  const logout = () => {
    localStorage.removeItem('sfTorresToken');
    localStorage.removeItem('sfTorresUser');
    window.location.hash = '#/login';
  };
  const firstName = (user.name || user.email || 'Líder').split(/\s+/)[0];
  return (
    <div className="schedule-mobile-head">
      <div className="leader-mobile-title">
        <h2>Olá, {firstName}</h2>
        <span>{title}</span>
      </div>
      <div className="leader-mobile-actions">
        <button className="leader-icon-btn" onClick={onRefresh} title="Atualizar"><Icon name="refresh" /></button>
        <button className="leader-icon-btn" onClick={logout} title="Sair">⋮</button>
      </div>
    </div>
  );
}

function LeaderBottomNav({ active }) {
  const go = (key) => {
    if (!canView(key)) return;
    window.location.hash = `#/${key}`;
  };
  return (
    <nav className="leader-bottom-nav">
      <button type="button" className={active === 'schedules' ? 'active' : ''} onClick={() => go('schedules')}><Icon name="file" /><span>Minhas OS</span></button>
      <button type="button" className={active === 'leaderAttendance' ? 'active' : ''} onClick={() => go('leaderAttendance')}><Icon name="users" /><span>Chamada</span></button>
    </nav>
  );
}

function OperationsDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonthValue());
  const load = () => {
    setLoading(true);
    api(`/api/dashboard/summary?month=${encodeURIComponent(month)}`)
      .then((payload) => setSummary(payload.data))
      .catch((error) => triggerAction(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [month]);
  const totalOrders = summary?.workOrders?.total || 0;
  const activeOrders = summary?.workOrders?.active || 0;
  const finalOrders = summary?.workOrders?.final || 0;
  const pendingAndAbsences = summary?.workOrders?.pendingAndAbsences || 0;
  const pendingCalls = summary?.workOrders?.pendingCalls || 0;
  const productivityRate = Number(summary?.productivityRate || 0);
  const avgDuration = Number(summary?.avgDurationHours || 0);
  const exportRows = [
    ['OS', 'Cliente', 'Servico', 'Responsavel', 'Integrantes', 'Status', 'Faltas', 'Data programada', 'Inicio', 'Fim'],
    ...(summary?.exportRows || [])
  ];
  const productivityRows = (summary?.ranking || []).map((item) => [item.index, <EmployeeCell item={item} />, item.employee.team || '-', item.criterion.name, item.os, item.present, item.absences, <ProgressValue value={item.percent} />, money(item.bonus)]);
  const statusChart = summary?.charts?.status || [];
  const dailyOrders = summary?.charts?.dailyOrders || [];
  const trendChart = summary?.charts?.trendChart || [];
  const clientChart = summary?.charts?.clientChart || [];
  const ranking = (summary?.ranking || []).slice(0, 6);
  const formatDuration = (hours) => {
    const totalMinutes = Math.round(Number(hours || 0) * 60);
    return `${Math.floor(totalMinutes / 60)}h ${pad2(totalMinutes % 60)}m`;
  };
  const percentOfTotal = (value) => totalOrders ? `${Math.round((Number(value || 0) / totalOrders) * 1000) / 10}% do total` : '0% do total';

  return (
    <>
      <PageHead title="Painel Corporativo" subtitle="Indicadores executivos das ordens de serviço, ocorrências e produtividade." ghostAction="Exportar" onGhostAction={() => downloadCsv('dashboard-operacional.csv', exportRows)} action="Atualizar agora" onAction={load} />
      <div className="toolbar">
        <div className="filter"><label>Periodo</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} /></div>
        <span className="spacer" /><span className="soft">Dados do mes filtrados no backend pela data programada da OS</span>
      </div>
      <div className="metric-grid">
        <MetricCard icon="file" label="Total de OS" value={totalOrders} sub="100% do periodo" color="#4466E8" progress={100} />
        <MetricCard icon="pulse" label="Em execucao" value={activeOrders} sub={percentOfTotal(activeOrders)} color="#395BDB" progress={totalOrders ? activeOrders / totalOrders * 100 : 0} />
        <MetricCard icon="check" label="Finalizadas" value={finalOrders} sub={percentOfTotal(finalOrders)} color="#08A86B" progress={totalOrders ? finalOrders / totalOrders * 100 : 0} />
        <MetricCard icon="clock" label="Pendentes / Faltas" value={pendingAndAbsences} sub={`${pendingCalls} pendentes na chamada`} color="#F29A1F" progress={totalOrders ? pendingAndAbsences / Math.max(totalOrders, pendingAndAbsences) * 100 : 0} />
        <MetricCard icon="chart" label="Produtividade" value={`${productivityRate.toFixed(1)}%`} sub="Indice de desempenho" color="#7048E8" progress={productivityRate} />
        <MetricCard icon="clock" label="Tempo medio" value={formatDuration(avgDuration)} sub="Por OS finalizada" color="#2598B8" progress={Math.min((avgDuration / 8) * 100, 100)} />
      </div>
      <div className="dashboard-showcase">
        <Panel title="Evolucao das OS" actions={<select className="panel-select"><option>Diario</option><option>Semanal</option></select>} padded className="dashboard-chart-panel"><TrendChart data={trendChart} /></Panel>
        <Panel title="Status das Operacoes" padded className="dashboard-chart-panel"><DonutChart data={statusChart} center={totalOrders} sub="Total de OS" /></Panel>
        <Panel title="OS por dia" padded className="dashboard-chart-panel"><ColumnChart data={dailyOrders} /></Panel>
      </div>
      <div className="dashboard-rank-grid">
        <Panel title="Ranking de colaboradores por finalizacoes" actions={<select className="panel-select"><option>Finalizadas</option><option>Presencas</option></select>} padded className="dashboard-chart-panel"><RankingBars data={ranking} /></Panel>
        <Panel title="OS por cliente" actions={<select className="panel-select"><option>Todos</option><option>Top 5</option></select>} padded className="dashboard-chart-panel"><BarChart data={clientChart} /></Panel>
      </div>
      <Panel title="Ranking geral de produtividade" padded><DataTable columns={['#', 'Colaborador', 'Equipe', 'Criterio', 'OS', 'Finalizadas', 'Faltas', '% Produtividade', 'Bonus Previsto']} rows={productivityRows.length ? productivityRows : [[1, '-', '-', '-', 0, 0, 0, <ProgressValue value={0} />, money(0)]]} loading={loading} /></Panel>
    </>
  );
}

function Tower() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Fila');
  const [month, setMonth] = useState(currentMonthValue());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = () => {
    setLoading(true);
    setError('');
    api(workOrdersEndpoint(month))
      .then((payload) => setOrders(listData(payload)))
      .catch((error) => {
        setOrders([]);
        setError(error.message);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [month]);
  const safeOrders = Array.isArray(orders) ? orders : [];
  const visible = statusFilter === 'Todos'
    ? safeOrders
    : safeOrders.filter((order) => isOpenQueueStatus(order.status) || order.status === 'Em execucao');
  const active = safeOrders.filter((order) => normalize(order.status).includes('exec')).length;
  const done = safeOrders.filter((order) => isFinalStatus(order.status)).length;
  const queue = safeOrders.filter((order) => isOpenQueueStatus(order.status)).length;
  const alertCount = safeOrders.filter((order) => ['Paralisada', 'Cancelada', 'Cancelado'].includes(order.status)).length;
  const assignTeam = async () => {
    const order = visible.find((item) => isOpenQueueStatus(item.status));
    if (!order) return triggerAction('Nenhuma OS na fila');
    await withBusy(() => api(`/api/workOrders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ...order, status: 'Em execucao', carrier: order.carrier || 'Equipe acionada pela torre', progress: Math.max(Number(order.progress || 0), 10) }) }));
    triggerAction(`Equipe acionada para OS ${order.number}`);
    load();
  };
  const rows = visible.map((order) => [
    order.number,
    order.client,
    `${Number(order.progress || 0)}%`,
    order.responsible || '-',
    order.equipment || '-',
    order.product || '-',
    order.service || '-',
    order.carrier || '-',
    dateTime(order.date),
    dateTime(order.operationStart),
    dateTime(order.operationEnd),
    <Pill value={order.status} />
  ]);
  return <><PageHead title="Torre Operacional" subtitle="Painel em tempo real das operações em andamento e fila de execução." ghostAction="Tempo real" onGhostAction={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')} action="Atualizar" onAction={load} /><div className="toolbar"><div className="filter"><label>Período</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} /></div><span className="spacer" /><span className="soft">Dados filtrados no banco pelo mês selecionado</span></div>{error ? <Panel title="Banco indisponível" padded actions={<button className="btn btn-sm btn-primary" onClick={load}>Tentar novamente</button>}><p className="soft">{error}</p></Panel> : <><div className="kpi-grid"><Kpi icon="pulse" label="Operações ativas" value={active} delta="em campo agora" /><Kpi icon="clock" label="Na fila" value={queue} delta="próximas 24h" warning /><Kpi icon="check" label="Concluídas" value={done} delta="ordens no sistema" success /><Kpi icon="alert" label="Alertas" value={alertCount} delta="atenção da torre" danger /></div><Panel title="Fila de execução" actions={<><button className="btn btn-sm" onClick={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')}>{statusFilter === 'Todos' ? 'Ver fila' : 'Ver todas'}</button><button className="btn btn-sm btn-primary" onClick={assignTeam}>Acionar equipe</button></>}><DataTable columns={['OS', 'Cliente', 'Percentual', 'Responsável', 'Equipamento', 'Produto', 'Serviço', 'Transportadora', 'Data programada', 'Início', 'Término', 'Status']} rows={rows} loading={loading} /></Panel></>}</>;
}

function Schedules({ notify, editable = true }) {
  const user = currentUser();
  const [items, setItems] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [productivityRules, setProductivityRules] = useState(defaultProductivityRules);
  const [statusCounts, setStatusCounts] = useState({ abertos: 0, finalizados: 0, todos: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: 'Abertos' });
  const [operationModal, setOperationModal] = useState(null);
  const [occurrenceModal, setOccurrenceModal] = useState(null);
  const load = (nextFilters = filters) => {
    setLoading(true);
    api(workOrdersEndpoint(currentMonthValue(), { mine: true, statusGroup: nextFilters.status, q: nextFilters.q, limit: 80 }))
      .then((p) => {
        setItems(listData(p));
        setStatusCounts(p.meta?.statusCounts || { abertos: 0, finalizados: 0, todos: 0 });
      })
      .catch((error) => { setItems([]); notify(error.message); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => load(filters), filters.q && filters.q.trim().length < 2 ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [filters.q, filters.status]);
  useEffect(() => {
    api('/api/equipment').then((payload) => setEquipment(listData(payload))).catch(() => {});
    api('/api/settings/productivityRules').then((payload) => setProductivityRules(mergeProductivityRules(payload.data))).catch(() => {});
  }, []);
  const belongsToLeader = (order) => {
    if (user.role === 'Administrador') return true;
    const haystack = normalize(`${order.responsible} ${order.carrier}`);
    return haystack.includes(normalize(user.name)) || haystack.includes(normalize(user.email));
  };
  const visibleOrders = items.filter(belongsToLeader);
  const updateOrder = async (order, patch, message) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await withBusy(() => api(`/api/workOrders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ...order, ...patch }) }));
    notify(message);
    setOperationModal(null);
    load();
  };
  const scheduledDateValue = (order) => {
    const raw = String(order.date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = new Date(order.date || Date.now());
    return Number.isNaN(parsed.getTime()) ? localDateValue(new Date()) : localDateValue(parsed);
  };
  const missingLeaderOperationFields = (order) => {
    const required = [['carrier', 'Transportador'], ['equipment', 'Equipamento'], ['product', 'Produto'], ['progress', 'Percentual']];
    const missing = required.find(([name]) => String(order[name] ?? '').trim() === '');
    if (missing) return missing[1];
    if (normalize(order.equipment).includes('container') && !String(order.containerNumber || '').trim()) return 'Número do container';
    if (normalize(order.equipment).includes('carreta') && !String(order.trailerPlate || '').trim()) return 'Placa da carreta';
    if (!Array.isArray(order.teamMembers) || !order.teamMembers.length) return 'Integrantes da equipe';
    return '';
  };
  const markStart = async (order) => {
    const missing = missingLeaderOperationFields(order);
    if (missing) return notify(`Preencha ${missing} antes de iniciar a OS`);
    return updateOrder(order, { operationStart: new Date().toLocaleString('pt-BR'), operationEnd: '', status: 'Em execucao', progress: Math.max(Number(order.progress || 0), 10) }, 'Inicio da operacao marcado');
  };
  const markEnd = async (order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
    if (!members.length) return notify('Inclua colaboradores na OS antes de finalizar');
    const date = scheduledDateValue(order);
    const results = await withBusy(() => Promise.all(members.map((name) => api(`/api/leader-attendance?date=${encodeURIComponent(date)}&q=${encodeURIComponent(name)}`).then((payload) => {
      const employee = (payload.data?.employees || []).find((item) => normalize(item.name) === normalize(name));
      return { name, status: employee?.status || '' };
    }).catch(() => ({ name, status: '' })))));
    const pending = results.filter((item) => !String(item.status || '').trim()).map((item) => item.name);
    if (pending.length) return notify(`Marque presença ou falta na chamada antes de finalizar: ${pending.join(', ')}`);
    return updateOrder(order, { operationEnd: new Date().toLocaleString('pt-BR'), status: 'Finalizado', progress: 100, correctionRequested: false, correctionApproved: false }, 'Fim da operacao marcado');
  };
  const requestLeaderCorrection = async (order) => {
    if (order.correctionRequested && !order.correctionApproved) return notify('Correção já solicitada ao administrativo');
    await updateOrder(order, { correctionRequested: true, correctionApproved: false }, 'Solicitacao de correcao enviada ao administrativo');
    await withBusy(() => api('/api/occurrences', { method: 'POST', body: JSON.stringify({ workOrder: order.number, type: 'Correção', description: `Líder solicitou correção após conclusão da OS`, status: 'Aguardando liberação', createdAt: new Date().toISOString() }) }));
  };
  const saveLeaderOccurrence = async (data) => {
    await withBusy(() => api('/api/occurrences', { method: 'POST', body: JSON.stringify({ ...data, workOrder: occurrenceModal.number, status: data.status || 'Aberta', createdAt: new Date().toISOString() }) }));
    notify('Ocorrência lançada na OS');
    setOccurrenceModal(null);
  };
  const exportRows = () => downloadCsv('programacao-os-lider.csv', [['OS', 'Cliente', 'Servico', 'Equipamento', 'Local', 'Lider', 'Status', 'Data'], ...visibleOrders.map((item) => [item.number, item.client, item.service, item.equipment, item.location, item.responsible, item.status, item.date])]);
  const equipmentOptions = ['', ...Array.from(new Set(equipment.map((item) => [item.code, item.type].filter(Boolean).join(' - ')).filter(Boolean)))];
  const saveOperationEdit = (data) => {
    const required = [['carrier', 'Transportador'], ['equipment', 'Equipamento'], ['product', 'Produto'], ['progress', 'Percentual']];
    const missing = required.find(([name]) => String(data[name] ?? '').trim() === '');
    if (missing) return notify(`Preencha o campo obrigatorio: ${missing[1]}`);
    const before = Array.isArray(operationModal.teamMembers) ? operationModal.teamMembers : [];
    const after = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    const changedTeam = before.length !== after.length || before.some((name) => !after.includes(name)) || after.some((name) => !before.includes(name));
    if (changedTeam && absenceCount(operationModal) > 0 && !String(data.teamNote || '').trim()) return notify('Informe a observacao/justificativa para alterar integrantes da equipe');
    const teamRoles = isMichelinOrder(operationModal, productivityRules) ? {} : Object.fromEntries(Object.entries(data.teamRoles || {}).filter(([name]) => after.includes(name)));
    return updateOrder(operationModal, { ...data, teamRoles, location: '', correctionRequested: false, correctionApproved: false }, 'Dados operacionais atualizados');
  };
  const leaderActions = (item) => {
    if (!editable) return <span className="soft">Somente leitura</span>;
    const done = isFinalStatus(item.status);
    if (done && !item.correctionApproved) return <button className="btn btn-sm" onClick={() => requestLeaderCorrection(item)}>{item.correctionRequested ? 'Correção solicitada' : 'Solicitar correção'}</button>;
    return (
      <div className="inline-actions">
        <button className="btn btn-sm" onClick={() => setOperationModal(item)}>Editar</button>
        {item.operationStart && !item.operationEnd && <button className="btn btn-sm btn-success" onClick={() => setOccurrenceModal(item)}>Ocorrência</button>}
        {!item.operationStart && !done && <button className="btn btn-sm btn-success" onClick={() => markStart(item)}>Iniciar</button>}
        {item.operationStart && !item.operationEnd && !done && <button className="btn btn-sm btn-primary" onClick={() => markEnd(item)}>Finalizar</button>}
      </div>
    );
  };
  const mobileActions = (item) => {
    if (!editable) return <span className="soft">Somente leitura</span>;
    const done = isFinalStatus(item.status);
    if (done && !item.correctionApproved) return <button className="btn schedule-touch-action" onClick={() => requestLeaderCorrection(item)}>{item.correctionRequested ? 'Correção solicitada' : 'Solicitar correção'}</button>;
    return (
      <div className="schedule-card-actions">
        <button className="btn schedule-touch-action" onClick={() => setOperationModal(item)}>Editar</button>
        {item.operationStart && !item.operationEnd && <button className="btn btn-success schedule-touch-action" onClick={() => setOccurrenceModal(item)}>Ocorrência</button>}
        {!item.operationStart && !done && <button className="btn btn-success schedule-touch-action primary-touch" onClick={() => markStart(item)}>Iniciar</button>}
        {item.operationStart && !item.operationEnd && !done && <button className="btn btn-primary schedule-touch-action primary-touch" onClick={() => markEnd(item)}>Finalizar</button>}
      </div>
    );
  };
  const scheduleCard = (item) => {
    const members = Array.isArray(item.teamMembers) && item.teamMembers.length ? item.teamMembers : [];
    const active = normalize(item.status).includes('exec');
    const done = isFinalStatus(item.status);
    return (
      <article className={`schedule-card ${active ? 'is-active' : ''}`} key={item.id || item.number}>
        <div className="schedule-card-top">
          <div>
            <span className="schedule-os">OS #{item.number}</span>
            <h3>{item.client || '-'}</h3>
          </div>
          <Pill value={item.status} />
        </div>
        <div className="schedule-main-info">
          <div><Icon name="file" /><span>Serviço</span><b>{item.service || '-'}</b></div>
          <div><Icon name="box" /><span>Produto</span><b>{item.product || '-'}</b></div>
          <div><Icon name="clock" /><span>{done ? 'Data' : 'Data agendada'}</span><b>{dateTime(item.date)}</b></div>
          <div><Icon name="clock" /><span>{done ? 'Início' : 'Início previsto'}</span><b>{item.operationStart || '-'}</b></div>
        </div>
        <div className="schedule-members">
          <span><Icon name="users" /> Equipe</span>
          <p>{members.length ? members.join(', ') : 'Sem integrantes definidos'}</p>
        </div>
        {mobileActions(item)}
      </article>
    );
  };
  const rows = loading ? null : visibleOrders.map((item) => [<span className="mono">{item.number}</span>, item.client, item.service || '-', item.product || '-', Array.isArray(item.teamMembers) && item.teamMembers.length ? item.teamMembers.join(', ') : '-', <span className="soft">{dateTime(item.date)}</span>, <Pill value={item.status} />, <span className="soft">{item.operationStart || '-'}</span>, <span className="soft">{item.operationEnd || '-'}</span>, leaderActions(item)]);
  const openCount = statusCounts.abertos || 0;
  const finalCount = statusCounts.finalizados || 0;
  return (
    <>
      <PageHead title="Programação de Equipes" subtitle="Fila de OS criadas pela administração para o líder vincular e acompanhar pelo próprio usuário." ghostAction="Exportar OS" onGhostAction={exportRows} action="Atualizar" onAction={() => load(filters)} />
      <LeaderMobileNav active="schedules" title="Minhas ordens de serviço" onRefresh={() => load(filters)} />
      <div className="toolbar schedule-toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Abertos</option><option>Finalizados</option><option>Todos</option></select></div>
        <span className="spacer" /><span className="soft">{visibleOrders.length} OS para este usuario</span>
      </div>
      <div className="leader-filter-tabs schedule-status-tabs">
        {[
          ['Abertos', openCount],
          ['Finalizados', finalCount],
          ['Todos', statusCounts.todos || 0]
        ].map(([label, count]) => <button type="button" key={label} className={filters.status === label ? 'active' : ''} onClick={() => setFilters((old) => ({ ...old, status: label }))}>{label} <span>{count}</span></button>)}
      </div>
      <div className="kpi-grid">
        <Kpi icon="file" label="OS recebidas" value={visibleOrders.length} delta="vinculadas ao lider" />
        <Kpi icon="clock" label="Programadas" value={visibleOrders.filter((item) => item.status === 'Programado').length} delta="aguardando inicio" warning />
        <Kpi icon="home" label="Em campo" value={visibleOrders.filter((item) => item.status === 'Em execucao').length} delta="em execucao" />
        <Kpi icon="check" label="Finalizadas" value={visibleOrders.filter((item) => item.status === 'Finalizado').length} delta="finalizadas" success />
      </div>
      <div className="schedule-mobile-list">
        {loading ? <LoadingBlock /> : visibleOrders.map(scheduleCard)}
        {!loading && !visibleOrders.length && <div className="empty-chart">Nenhuma OS encontrada</div>}
      </div>
      <LeaderBottomNav active="schedules" />
      <div className="schedule-table-panel"><Panel title="OS direcionadas ao lider" actions={<Pill value={user.name || user.email || 'usuario'} />}><DataTable columns={['OS', 'Cliente', 'Servico', 'Produto', 'Integrantes', 'Data programada', 'Status', 'Inicio', 'Fim', 'Acao']} rows={rows} loading={loading} /></Panel></div>
      {operationModal && <Editor title="Editar operacao da OS" uppercase className="operation-modal" fields={[['carrier', 'Transportador', 'text', null, null, true], ['product', 'Produto', 'text', null, null, true], ['equipment', 'Equipamento', 'select', equipmentOptions, null, true], ['containerNumber', 'Número do container', 'text', null, (form) => normalize(form.equipment).includes('container')], ['trailerPlate', 'Placa da carreta', 'text', null, (form) => normalize(form.equipment).includes('carreta')], ['teamMembers', 'Incluir integrantes da equipe', 'employees', { endpoint: '/api/employees', roles: isMichelinOrder(operationModal, productivityRules) ? [] : productivityRules.standard }], ['teamNote', 'Observacao obrigatoria ao alterar equipe', 'textarea', null, () => absenceCount(operationModal) > 0], ['progress', 'Percentual', 'number', null, null, true]]} initial={operationModal} onCancel={() => setOperationModal(null)} onSave={saveOperationEdit} />}
      {occurrenceModal && <Editor title={`Lançar ocorrência · OS ${occurrenceModal.number}`} fields={occurrenceFields} initial={{ workOrder: occurrenceModal.number, type: 'Operacional', status: 'Aberta' }} onCancel={() => setOccurrenceModal(null)} onSave={saveLeaderOccurrence} />}
    </>
  );
}

function LeaderAttendance({ notify, editable = true }) {
  const user = currentUser();
  const leaderProfile = isLeaderUser(user);
  const approverProfile = canApproveAttendance(user);
  const [dateValue, setDateValue] = useState(localDateValue(new Date()));
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [query, setQuery] = useState('');
  const [mobileFilter, setMobileFilter] = useState('Todos');
  const [noteModal, setNoteModal] = useState(null);
  const [correctionModal, setCorrectionModal] = useState(null);
  const [correctionReviewModal, setCorrectionReviewModal] = useState(null);
  const [attendanceOccurrenceModal, setAttendanceOccurrenceModal] = useState(null);
  const [occurrenceDetailModal, setOccurrenceDetailModal] = useState(null);
  const [payload, setPayload] = useState(null);
  const [pointOccurrences, setPointOccurrences] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState({ employees: [] });
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [monthlyQuery, setMonthlyQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const load = (date = dateValue, q = query) => {
    setLoading(true);
    Promise.all([
      api(`/api/leader-attendance?date=${encodeURIComponent(date)}&q=${encodeURIComponent(q)}`),
      api(`/api/occurrences?attendanceDate=${encodeURIComponent(date)}&limit=500`).catch(() => ({ data: [] }))
    ])
      .then(([attendanceResponse, occurrenceResponse]) => {
        setPayload(attendanceResponse.data);
        setPointOccurrences(listData(occurrenceResponse));
      })
      .catch((error) => { setPayload(null); setPointOccurrences([]); notify(error.message); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    const timer = window.setTimeout(() => load(dateValue, query), query && query.trim().length < 2 ? 0 : 250);
    return () => window.clearTimeout(timer);
  }, [dateValue, query]);
  useEffect(() => {
    if (leaderProfile) return;
    setMonthlyLoading(true);
    api(`/api/leader-attendance/summary?month=${encodeURIComponent(monthValue)}`)
      .then((response) => setMonthlySummary(response.data || { employees: [] }))
      .catch((error) => { setMonthlySummary({ employees: [] }); notify(error.message); })
      .finally(() => setMonthlyLoading(false));
  }, [monthValue, leaderProfile]);
  const employees = payload?.employees || [];
  const occurrencesForEmployee = (item) => pointOccurrences.filter((occurrence) => {
    const occurrenceName = normalize(occurrence.employeeName);
    const employeeName = normalize(item.name);
    return occurrenceName && (occurrenceName.includes(employeeName) || employeeName.includes(occurrenceName));
  });
  const pendingOccurrence = (item) => occurrencesForEmployee(item).find((occurrence) => !['aprovada', 'resolvida'].includes(normalize(occurrence.status)));
  const occurrenceCell = (item) => {
    const occurrences = occurrencesForEmployee(item);
    if (!occurrences.length) return <span className="soft">-</span>;
    const latest = occurrences[0];
    return <div className="attendance-occurrence-cell"><Pill value={latest.type || 'Ocorrência'} /><span>{latest.description || '-'}</span></div>;
  };
  const approveOccurrence = async (occurrence) => {
    if (!occurrence?.id) return;
    await withBusy(() => api(`/api/occurrences/${occurrence.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'Aprovada',
        approvedByName: user.name || user.email || 'Administrativo',
        approvedAt: new Date().toISOString()
      })
    }));
    notify('Ocorrência aprovada');
    setOccurrenceDetailModal(null);
    load(dateValue, query);
  };
  const deleteOccurrence = async (occurrence) => {
    if (!occurrence?.id) return;
    if (!window.confirm('Apagar esta ocorrência do ponto?')) return;
    await withBusy(() => api(`/api/occurrences/${occurrence.id}`, { method: 'DELETE' }));
    notify('Ocorrência apagada');
    const nextOccurrences = pointOccurrences.filter((item) => item.id !== occurrence.id);
    setPointOccurrences(nextOccurrences);
    setOccurrenceDetailModal((current) => current ? { ...current, occurrences: current.occurrences.filter((item) => item.id !== occurrence.id) } : current);
    load(dateValue, query);
  };
  const attendanceCounts = {
    marked: employees.filter((item) => Boolean(item.status)).length,
    present: employees.filter((item) => normalize(item.status) === 'presente').length,
    absences: employees.filter((item) => normalize(item.status) === 'falta').length,
    results: employees.length
  };
  const filteredEmployees = employees.filter((item) => {
    if (mobileFilter === 'Presentes') return normalize(item.status) === 'presente';
    if (mobileFilter === 'Faltas') return normalize(item.status) === 'falta';
    if (mobileFilter === 'Resultados') return Boolean(item.status);
    return true;
  });
  const monthlyEmployees = [...(monthlySummary.employees || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const monthlySelected = selectedEmployee ? monthlyEmployees.find((item) => item.name === selectedEmployee) || null : null;
  const daysInSelectedMonth = (() => {
    const [year, month] = String(monthValue || currentMonthValue()).split('-').map(Number);
    const total = new Date(year, month, 0).getDate();
    return Array.from({ length: total }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
  })();
  const selectedDayMap = Object.fromEntries([...(monthlySelected?.days || [])].map((item) => [item.date, item]));
  const selectedDays = monthlySelected ? daysInSelectedMonth.map((day) => selectedDayMap[day] || { date: day, status: 'Sem marcação', note: '' }) : [];
  const selectedAbsences = selectedDays.filter((item) => normalize(item.status) === 'falta');
  const monthlyRows = selectedDays.map((item) => [
    date(item.date),
    normalize(item.status) === 'sem marcacao' ? <span className="soft">Sem marcação</span> : <Pill value={item.status} />,
    item.note || '-'
  ]);
  const monthlyMatches = monthlyQuery.trim()
    ? monthlyEmployees.filter((item) => normalize(`${item.name} ${item.role} ${item.team}`).includes(normalize(monthlyQuery))).slice(0, 8)
    : monthlyEmployees.slice(0, 8);
  const selectMonthlyEmployee = (item) => {
    setSelectedEmployee(item.name);
    setMonthlyQuery(item.name);
  };
  const updateEmployee = (name, patch) => setPayload((old) => ({
    ...old,
    employees: (old?.employees || []).map((item) => item.name === name ? { ...item, ...patch } : item)
  }));
  const mark = async (item, status, note = item.note || '', clear = false) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    updateEmployee(item.name, { status: clear ? '' : status, note: clear ? '' : note });
    const response = await withBusy(() => api('/api/leader-attendance', {
      method: 'PUT',
      body: JSON.stringify({ date: dateValue, q: query, attendance: { [item.name]: clear ? { clear: true } : { status, note } } })
    }));
    setPayload(response.data);
  };
  const saveNote = async (data) => {
    if (!noteModal) return;
    await mark(noteModal, noteModal.status || '', data.note || '');
    setNoteModal(null);
  };
  const requestCorrection = async (data) => {
    if (!correctionModal) return;
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const reason = String(data.reason || '').trim();
    if (!reason) return notify('Informe a justificativa da correção');
    const response = await withBusy(() => api('/api/leader-attendance/corrections', {
      method: 'PUT',
      body: JSON.stringify({ date: dateValue, q: query, name: correctionModal.name, reason })
    }));
    setPayload(response.data);
    setCorrectionModal(null);
    notify('Solicitação de correção enviada');
  };
  const saveAttendanceOccurrence = async (data) => {
    if (!attendanceOccurrenceModal) return;
    const description = String(data.description || '').trim();
    if (!description) return notify('Informe a descrição da ocorrência');
    await withBusy(() => api('/api/occurrences', {
      method: 'POST',
      body: JSON.stringify({
        workOrder: `Chamada ${dateValue}`,
        employeeName: attendanceOccurrenceModal.name,
        attendanceDate: dateValue,
        type: data.type || 'Ponto',
        description,
        status: data.status || 'Aberta',
        createdAt: new Date().toISOString()
      })
    }));
    setAttendanceOccurrenceModal(null);
    load(dateValue, query);
    notify('Ocorrência lançada');
  };
  const decideCorrection = async (item, approved = true) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const response = await withBusy(() => api('/api/leader-attendance/corrections/approve', {
      method: 'PUT',
      body: JSON.stringify({ date: dateValue, q: query, name: item.name, approved })
    }));
    setPayload(response.data);
    setCorrectionReviewModal(null);
    notify(approved ? 'Correção liberada para o líder' : 'Correção negada');
  };
  const canLeaderChange = (item) => !leaderProfile || !item.status || item.correctionRequest?.status === 'Aprovada';
  const extraAttendanceActions = (item) => [
    !leaderProfile && { label: 'Adicionar observação', onClick: () => setNoteModal(item) },
    !leaderProfile && { label: 'Ver solicitação de correção', onClick: () => setCorrectionReviewModal(item), disabled: item.correctionRequest?.status !== 'Pendente' },
    !leaderProfile && { label: 'Ver ocorrência', onClick: () => setOccurrenceDetailModal({ item, occurrences: occurrencesForEmployee(item) }), disabled: !occurrencesForEmployee(item).length },
    !leaderProfile && { label: 'Aprovar ocorrência', onClick: () => approveOccurrence(pendingOccurrence(item)), disabled: !pendingOccurrence(item) },
    !leaderProfile && { label: 'Apagar ocorrência', onClick: () => deleteOccurrence(occurrencesForEmployee(item)[0]), disabled: !occurrencesForEmployee(item).length, danger: true },
    !leaderProfile && { label: 'Limpar marcação', onClick: () => mark(item, '', '', true), disabled: !item.status && !item.note, danger: true },
    leaderProfile && { label: 'Lançar ocorrência', onClick: () => setAttendanceOccurrenceModal(item) }
  ];
  const markActions = (item, compact = false) => {
    const buttonClass = compact ? 'btn' : 'btn btn-sm';
    if (leaderProfile && !canLeaderChange(item)) {
      const correctionButton = item.correctionRequest?.status === 'Pendente'
        ? <button className={`${buttonClass}`} disabled>Correção solicitada</button>
        : <button className={`${buttonClass}`} onClick={() => setCorrectionModal(item)} disabled={!editable}>Solicitar correção</button>;
      if (compact) return correctionButton;
      return <div className="attendance-action-cluster">{correctionButton}<ActionMenu actions={extraAttendanceActions(item)} /></div>;
    }
    if (approverProfile && item.correctionRequest?.status === 'Pendente') {
      return <button className={`${buttonClass} btn-primary`} onClick={() => setCorrectionReviewModal(item)} disabled={!editable}>Ver solicitação</button>;
    }
    return (
      <>
        <button className={`${buttonClass} btn-success`} onClick={() => mark(item, 'Presente')} disabled={!editable}>Presente</button>
        <button className={`${buttonClass} btn-danger`} onClick={() => mark(item, 'Falta')} disabled={!editable}>Falta</button>
        {!compact && <ActionMenu actions={extraAttendanceActions(item)} />}
      </>
    );
  };
  const rows = loading ? null : filteredEmployees.map((item) => [
    <b>{item.name}</b>,
    item.role || '-',
    <div>{item.status ? <Pill value={item.status} /> : <span className="soft">Sem marcação</span>}{item.note && <div className="attendance-note">{item.note}</div>}</div>,
    occurrenceCell(item),
    <div className="inline-actions">{markActions(item)}</div>
  ]);
  const attendanceCard = (item) => (
    <article className="attendance-card" key={item.name}>
      <div className={`attendance-avatar ${normalize(item.status) === 'falta' ? 'danger' : ''}`}>{initials(item.name)}</div>
      <div className="attendance-card-main">
        <div>
          <h3>{item.name}</h3>
          <p>{item.role || 'Função não informada'}</p>
        </div>
        <div className="attendance-card-status">
          {item.correctionRequest?.status === 'Pendente' ? <Pill value="Correção pendente" /> : item.status ? <Pill value={item.status} /> : <span className="attendance-pending">Sem marcação</span>}
          {leaderProfile && <ActionMenu actions={extraAttendanceActions(item)} />}
        </div>
      </div>
      <div className="attendance-actions">
        {markActions(item, true)}
      </div>
    </article>
  );
  return (
    <>
      <LeaderMobileNav active="leaderAttendance" title="Chamada" onRefresh={() => load(dateValue, query)} />
      <PageHead title="Chamada de Ponto" subtitle="Pesquise o colaborador e marque presença ou falta, separado das ordens de serviço." action="Atualizar" onAction={() => load(dateValue, query)} />
      <div className="toolbar">
        <div className="filter"><label>Data</label><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value || localDateValue(new Date()))} /></div>
        <div className="filter grow"><label>Buscar colaborador</label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite nome, função ou equipe..." /></div>
        <span className="spacer" />
        <span className="soft">{user.name || user.email || 'Lider'}</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="users" label="Marcados" value={attendanceCounts.marked} delta="no dia selecionado" />
        <Kpi icon="check" label="Presentes" value={attendanceCounts.present} delta="confirmados na chamada" success />
        <Kpi icon="alert" label="Faltas" value={attendanceCounts.absences} delta="registradas no dia" warning />
        <Kpi icon="clock" label="Resultados" value={attendanceCounts.results} delta={query.trim() ? 'da busca no banco' : 'ja marcados'} />
      </div>
      {!leaderProfile && (
        <Panel title="Folha de ponto mensal" actions={<Pill value={monthValue} />} padded>
          <div className="monthly-point-toolbar">
            <div className="filter"><label>Mês</label><input type="month" value={monthValue} onChange={(event) => { setMonthValue(event.target.value || currentMonthValue()); setSelectedEmployee(''); setMonthlyQuery(''); }} /></div>
            <div className="filter grow monthly-search"><label>Pesquisar colaborador</label><input value={monthlyQuery} onChange={(event) => { setMonthlyQuery(event.target.value); setSelectedEmployee(''); }} placeholder="Digite o nome, função ou equipe..." disabled={monthlyLoading || !monthlyEmployees.length} /></div>
            <div className="monthly-point-summary"><span>Presentes</span><b>{monthlySelected?.present || 0}</b></div>
            <div className="monthly-point-summary danger"><span>Faltas</span><b>{monthlySelected?.absences || 0}</b></div>
          </div>
          {!monthlyLoading && !monthlySelected && monthlyEmployees.length > 0 && (
            <div className="monthly-search-results">
              {monthlyMatches.map((item) => (
                <button type="button" key={item.name} onClick={() => selectMonthlyEmployee(item)}>
                  <b>{item.name}</b>
                  <span>{[item.role, item.team].filter(Boolean).join(' · ') || 'Colaborador ativo'} · {item.present || 0} pres. · {item.absences || 0} faltas</span>
                </button>
              ))}
            </div>
          )}
          {monthlyLoading ? <LoadingBlock /> : monthlySelected ? (
            <>
              <div className="monthly-point-identity">
                <div><b>{monthlySelected.name}</b><span>{[monthlySelected.role, monthlySelected.team].filter(Boolean).join(' · ') || 'Colaborador ativo'}</span></div>
                <span>{selectedDays.length} dias no mês</span>
              </div>
              <div className="monthly-absence-list">
                <b>Datas com falta</b>
                <span>{selectedAbsences.length ? selectedAbsences.map((item) => date(item.date)).join(', ') : 'Nenhuma falta no mês selecionado.'}</span>
              </div>
              <DataTable columns={['Data', 'Status', 'Observação']} rows={monthlyRows} />
            </>
          ) : <div className="empty-chart">{monthlyEmployees.length ? 'Pesquise um colaborador para abrir a folha mensal.' : 'Nenhum colaborador ativo encontrado.'}</div>}
        </Panel>
      )}
      <div className="leader-filter-tabs">
        {[
          ['Todos', attendanceCounts.results],
          ['Presentes', attendanceCounts.present],
          ['Faltas', attendanceCounts.absences],
          ['Resultados', attendanceCounts.marked]
        ].map(([label, count]) => <button type="button" key={label} className={mobileFilter === label ? 'active' : ''} onClick={() => setMobileFilter(label)}>{label} <span>{count}</span></button>)}
      </div>
      <div className="attendance-mobile-list">
        {loading ? <LoadingBlock /> : filteredEmployees.map(attendanceCard)}
        {!loading && !filteredEmployees.length && <div className="empty-chart">{query.trim() ? 'Nenhum colaborador encontrado para a busca.' : 'Pesquise um colaborador para marcar presença ou falta.'}</div>}
        {!loading && filteredEmployees.length > 0 && <div className="attendance-finish-card"><Icon name="help" /><div><b>Finalize a chamada</b><span>Confira os registros e finalize a chamada do dia.</span></div><button className="btn btn-primary" onClick={() => notify('Chamada conferida')}>Finalizar chamada</button></div>}
      </div>
      {occurrenceDetailModal && (
        <div className="modal-backdrop">
          <div className="modal attendance-occurrence-modal">
            <div className="modal-head"><h3>Ocorrências do ponto</h3><button className="btn btn-sm" onClick={() => setOccurrenceDetailModal(null)}>Fechar</button></div>
            <div className="modal-body">
              <div className="occurrence-person"><b>{occurrenceDetailModal.item.name}</b><span>{date(dateValue)}</span></div>
              <div className="occurrence-detail-list">
                {occurrenceDetailModal.occurrences.map((occurrence) => (
                  <div className="occurrence-detail-card" key={occurrence.id}>
                    <div><Pill value={occurrence.type || 'Ocorrência'} /><Pill value={occurrence.status || 'Aberta'} /></div>
                    <p>{occurrence.description || '-'}</p>
                    <span>{occurrence.approvedByName ? `Aprovada por ${occurrence.approvedByName}` : 'Aguardando aprovação'}</span>
                    <div className="occurrence-detail-actions">
                      {!['aprovada', 'resolvida'].includes(normalize(occurrence.status)) && <button className="btn btn-primary" onClick={() => approveOccurrence(occurrence)}>Aprovar ocorrência</button>}
                      <button className="btn btn-danger" onClick={() => deleteOccurrence(occurrence)}>Apagar ocorrência</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {correctionReviewModal && (
        <div className="modal-backdrop">
          <div className="modal attendance-correction-modal">
            <div className="modal-head"><h3>Solicitação de correção</h3><button className="btn btn-sm" onClick={() => setCorrectionReviewModal(null)}>Fechar</button></div>
            <div className="modal-body">
              <div className="correction-review-head">
                <div><b>{correctionReviewModal.name}</b><span>{date(dateValue)}</span></div>
                <Pill value={correctionReviewModal.correctionRequest?.currentStatus || correctionReviewModal.status || 'Sem marcação'} />
              </div>
              <div className="correction-review-block">
                <span>Solicitado por</span>
                <b>{correctionReviewModal.correctionRequest?.requestedBy?.name || 'Líder'}</b>
              </div>
              <div className="correction-review-block">
                <span>Justificativa</span>
                <p>{correctionReviewModal.correctionRequest?.reason || 'Sem justificativa informada.'}</p>
              </div>
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={() => decideCorrection(correctionReviewModal, false)}>Negar</button>
                <button className="btn btn-primary" onClick={() => decideCorrection(correctionReviewModal, true)}>Aprovar correção</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {noteModal && <Editor title={`Observação: ${noteModal.name}`} fields={[['note', 'Observação', 'textarea', null, null, true]]} initial={{ note: noteModal.note || '' }} onCancel={() => setNoteModal(null)} onSave={saveNote} />}
      {correctionModal && <Editor title={`Justificar correção: ${correctionModal.name}`} fields={[['reason', 'Justificativa', 'textarea', null, null, true]]} initial={{ reason: correctionModal.correctionRequest?.reason || '' }} onCancel={() => setCorrectionModal(null)} onSave={requestCorrection} />}
      {attendanceOccurrenceModal && <Editor title={`Ocorrência: ${attendanceOccurrenceModal.name}`} fields={[
        ['type', 'Tipo', 'select', ['Saída antecipada', 'Mal-estar', 'Atraso', 'Outro'], null, true],
        ['description', 'Descrição', 'textarea', null, null, true],
        ['status', 'Status', 'select', ['Aberta', 'Em análise', 'Resolvida']]
      ]} initial={{ type: 'Saída antecipada', description: '', status: 'Aberta' }} onCancel={() => setAttendanceOccurrenceModal(null)} onSave={saveAttendanceOccurrence} />}
      <LeaderBottomNav active="leaderAttendance" />
      <div className="attendance-table-panel">
        <Panel title="Presença dos colaboradores" actions={<Pill value={date(dateValue)} />} padded>
          <DataTable columns={['Colaborador', 'Função', 'Status', 'Ocorrência', 'Marcar']} rows={rows} loading={loading} />
          {!loading && !filteredEmployees.length && <div className="empty-chart">{query.trim() ? 'Nenhum colaborador encontrado para a busca.' : 'Pesquise um colaborador para marcar presença ou falta.'}</div>}
        </Panel>
      </div>
    </>
  );
}

function Productivity() {
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [productivityRules, setProductivityRules] = useState(defaultProductivityRules);
  const [attendanceSummary, setAttendanceSummary] = useState({ employees: [] });
  const [compare, setCompare] = useState(false);
  const [showOsLaunches, setShowOsLaunches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', employee: 'Todos', criterion: 'Todos', status: 'Todos', client: 'Todos', service: 'Todos', period: 'Este mês', from: monthRange().from.slice(0, 10), to: monthRange().to.slice(0, 10) });
  const productivityRange = () => {
    const today = new Date();
    if (filters.period === 'Hoje') return { from: localDateValue(today), to: localDateValue(today) };
    if (filters.period === 'Esta semana') {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { from: localDateValue(start), to: localDateValue(end) };
    }
    if (filters.period === 'Personalizado') return { from: filters.from, to: filters.to };
    const range = monthRange(currentMonthValue());
    return { from: range.from.slice(0, 10), to: range.to.slice(0, 10) };
  };
  const loadProductivity = () => {
    const range = productivityRange();
    setLoading(true);
    api(workOrdersRangeEndpoint(range.from, range.to, { client: filters.client, service: filters.service, limit: 500 }))
      .then((payload) => setOrders(listData(payload)))
      .catch((error) => { setOrders([]); triggerAction(error.message); })
      .finally(() => setLoading(false));
    api(`/api/leader-attendance/summary?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`).then((payload) => setAttendanceSummary(payload.data || { employees: [] })).catch(() => {});
  };
  useEffect(() => {
    api('/api/employees').then((payload) => setEmployees(listData(payload))).catch((error) => triggerAction(error.message));
    api('/api/settings/productivityRules').then((payload) => setProductivityRules(mergeProductivityRules(payload.data))).catch(() => {});
  }, []);
  useEffect(() => { loadProductivity(); }, [filters.period, filters.from, filters.to, filters.client, filters.service]);
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const attendanceByName = Object.fromEntries((attendanceSummary.employees || []).map((item) => [normalize(item.name), item]));
  const discountFor = (absences) => absences <= 0 ? 1 : absences === 1 ? 0.75 : absences === 2 ? 0.5 : absences === 3 ? 0.25 : 0;
  const ruleRow = (rule) => [rule.name, money(rule.base), money(rule.base * 0.75), money(rule.base * 0.5), money(rule.base * 0.25), money(0)];
  const memberEntries = orders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
    return members.flatMap((name) => {
      if (isMichelinOrder(order, productivityRules)) return [{ order, name, criterion: { key: 'michelin', name: 'MICHELIN', base: 0, mode: 'per-os', match: 'michelin' }, status: 'Presente' }];
      const assignedRules = rulesForAssignment(order.teamRoles?.[name], productivityRules);
      const roles = assignedRules.length ? assignedRules : [{ key: 'none', name: 'Sem critério', base: 0, mode: 'per-os', match: '' }];
      return roles.map((criterion) => ({ order, name, criterion, status: 'Presente' }));
    });
  });
  const employeeOptions = ['Todos', ...Array.from(new Set(memberEntries.map((entry) => entry.name).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const clientOptions = ['Todos', ...Array.from(new Set(orders.map((order) => order.client).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const serviceOptions = ['Todos', ...Array.from(new Set(orders.map((order) => order.service).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const filteredEntries = memberEntries.filter((entry) => {
    const employee = employeeByName[normalize(entry.name)] || { name: entry.name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = michelinShare !== null ? { key: 'michelin', name: 'MICHELIN', base: michelinShare, mode: 'per-os', match: 'michelin' } : entry.criterion;
    const text = normalize(`${entry.order.number} ${entry.order.client} ${entry.order.service} ${entry.order.date} ${entry.name} ${entry.criterion.name}`);
    const queryOk = !filters.q || text.includes(normalize(filters.q));
    const employeeOk = filters.employee === 'Todos' || entry.name === filters.employee;
    const clientOk = filters.client === 'Todos' || entry.order.client === filters.client;
    const serviceOk = filters.service === 'Todos' || entry.order.service === filters.service;
    const criterionOk = filters.criterion === 'Todos' || normalize(criterion.name).includes(normalize(filters.criterion));
    const statusOk = filters.status === 'Todos' || normalize(entry.status) === normalize(filters.status);
    return queryOk && employeeOk && clientOk && serviceOk && criterionOk && statusOk;
  });
  const byEmployee = Object.values(filteredEntries.reduce((acc, entry) => {
    const key = normalize(entry.name);
    const employee = employeeByName[key] || { name: entry.name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = entry.criterion;
    acc[key] = acc[key] || { employee, criterion, criteria: new Set(), osSet: new Set(), michelinSet: new Set(), os: 0, present: 0, standardPresent: 0, absences: attendanceByName[key]?.absences || 0, pending: 0, customBonus: 0, standardBonus: 0 };
    acc[key].criteria.add(criterion.name);
    acc[key].osSet.add(entry.order.id || entry.order.number);
    acc[key].os += 1;
    acc[key].present += 1;
    const michelinKey = `${entry.order.id || entry.order.number}:${entry.name}`;
    if (michelinShare !== null && !acc[key].michelinSet.has(michelinKey)) {
      acc[key].customBonus += michelinShare;
      acc[key].michelinSet.add(michelinKey);
    }
    if (michelinShare === null) {
      acc[key].standardPresent += 1;
      acc[key].standardBonus += criterion.mode === 'monthly' ? 0 : criterion.base;
    }
    return acc;
  }, {})).map((item) => ({ ...item, os: item.osSet.size, criterion: { ...item.criterion, name: Array.from(item.criteria).join(' + ') } })).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  const productivityRows = byEmployee.map((item) => {
    const factor = discountFor(item.absences);
    const adjustedValue = item.standardBonus * factor;
    const monthlyBonus = item.criteria.has?.('Equipe PA') && item.present > 0 ? ((productivityRules.standard || []).find((rule) => rule.name === 'Equipe PA')?.base || 0) * factor : 0;
    const total = item.customBonus + adjustedValue + monthlyBonus;
    const criterionName = item.criterion.name;
    return [item.employee.name, item.employee.role || '-', item.employee.team || '-', criterionName, item.os, item.present, item.absences, money(adjustedValue), `${Math.round(factor * 100)}%`, money(total)];
  });
  const osRows = filteredEntries.map(({ order, name, status, criterion: assignedCriterion }) => {
    const employee = employeeByName[normalize(name)] || { name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(order, name, employeeByName, productivityRules);
    const criterion = assignedCriterion || { name: 'Sem critério', base: 0, mode: 'per-os' };
    const employeeSummary = byEmployee.find((item) => normalize(item.employee.name) === normalize(name));
    const payable = normalize(status) === 'falta' || normalize(status) === 'pendente' || criterion.mode === 'monthly' ? 0 : (michelinShare ?? (criterion.base * discountFor(employeeSummary?.absences || 0)));
    const label = michelinShare !== null ? 'MICHELIN' : criterion.name;
    return [order.number, dateTime(order.date), order.client, name, employee.team || '-', label, <Pill value={status} />, money(payable)];
  });
  const totalAbsences = byEmployee.reduce((sum, item) => sum + item.absences, 0);
  const pendingCalls = byEmployee.reduce((sum, item) => sum + item.pending, 0);
  const totalBonus = byEmployee.reduce((sum, item) => {
    const factor = discountFor(item.absences);
    const monthlyBonus = item.criteria.has?.('Equipe PA') && item.present > 0 ? ((productivityRules.standard || []).find((rule) => rule.name === 'Equipe PA')?.base || 0) * factor : 0;
    return sum + item.customBonus + (item.standardBonus * factor) + monthlyBonus;
  }, 0);
  const exportRows = [['Colaborador', 'Função', 'Equipe cadastro', 'Critério', 'OS', 'Presenças', 'Faltas', 'Valor base', 'Percentual', 'Total'], ...productivityRows.map((row) => row.map((cell) => displayText(cell)))];
  const exportOsRows = [['OS', 'Data', 'Cliente', 'Colaborador', 'Equipe', 'Critério', 'Chamada', 'Valor'], ...osRows.map((row) => row.map((cell) => displayText(cell)))];
  const exportProductivityWorkbook = () => downloadWorkbook('produtividade-colaboradores.xls', [
    { name: 'Produtividade', rows: exportRows },
    { name: 'Lançamentos por OS', rows: exportOsRows }
  ]);
  const range = productivityRange();
  return (
    <>
      <PageHead title="Produtividade dos colaboradores" subtitle="Apuração por período, OS, chamada, faltas e critérios de bonificação." ghostActions={[compare ? 'Ocultar critérios' : 'Ver critérios', showOsLaunches ? 'Ocultar lançamentos por OS' : 'Ver lançamentos por OS']} onGhostAction={(label) => label.includes('critério') || label.includes('critérios') ? setCompare((value) => !value) : setShowOsLaunches((value) => !value)} action="Exportar relatório" onAction={exportProductivityWorkbook} />
      <div className="toolbar productivity-toolbar">
        <div className="filter"><label>Período</label><select value={filters.period} onChange={(event) => setFilters((old) => ({ ...old, period: event.target.value }))}><option>Hoje</option><option>Esta semana</option><option>Este mês</option><option>Personalizado</option></select></div>
        {filters.period === 'Personalizado' && <><div className="filter"><label>De</label><input type="date" value={filters.from} onChange={(event) => setFilters((old) => ({ ...old, from: event.target.value || old.from }))} /></div><div className="filter"><label>Até</label><input type="date" value={filters.to} onChange={(event) => setFilters((old) => ({ ...old, to: event.target.value || old.to }))} /></div></>}
        <div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, colaborador..." /></div>
        <div className="filter"><label>Cliente</label><select value={filters.client} onChange={(event) => setFilters((old) => ({ ...old, client: event.target.value, employee: 'Todos' }))}>{clientOptions.map((name) => <option key={name}>{name}</option>)}</select></div>
        <div className="filter"><label>Serviço</label><select value={filters.service} onChange={(event) => setFilters((old) => ({ ...old, service: event.target.value, employee: 'Todos' }))}>{serviceOptions.map((name) => <option key={name}>{name}</option>)}</select></div>
        <div className="filter"><label>Colaborador</label><select value={filters.employee} onChange={(event) => setFilters((old) => ({ ...old, employee: event.target.value }))}>{employeeOptions.map((name) => <option key={name}>{name}</option>)}</select></div>
        <div className="filter"><label>Critério</label><select value={filters.criterion} onChange={(event) => setFilters((old) => ({ ...old, criterion: event.target.value }))}><option>Todos</option>{(productivityRules.standard || []).map((rule) => <option key={rule.key}>{rule.name}</option>)}<option>MICHELIN</option><option>Sem critério</option></select></div>
        <div className="filter"><label>Chamada</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Presente</option><option>Falta</option><option>Pendente</option></select></div>
        <span className="spacer" /><span className="soft">{filteredEntries.length} lançamentos · {date(range.from)} a {date(range.to)}</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="users" label="Colaboradores avaliados" value={byEmployee.length} delta="com OS no filtro" success />
        <Kpi icon="file" label="OS apuradas" value={new Set(filteredEntries.map((entry) => entry.order.id || entry.order.number)).size} delta="filtradas no banco pelo período" />
        <Kpi icon="alert" label="Faltas registradas" value={totalAbsences} delta={`${pendingCalls} chamadas pendentes`} warning />
        <Kpi icon="money" label="Bônus previsto" value={money(totalBonus)} delta="conforme critérios" />
      </div>
      {compare && <Panel title="Critérios de bonificação" padded><DataTable columns={['Equipe/Função', 'Valor integral', '1 ausência', '2 ausências', '3 ausências', '4+ ausências']} rows={(productivityRules.standard || []).map(ruleRow)} /></Panel>}
      <Panel title="Produtividade por colaborador" padded><DataTable columns={['Colaborador', 'Função', 'Equipe cadastro', 'Critério', 'OS', 'Pres.', 'Faltas', 'Valor base', '%', 'Total']} rows={productivityRows} loading={loading} /></Panel>
      {showOsLaunches && <Panel title="Lançamentos por OS" padded><DataTable columns={['OS', 'Data', 'Cliente', 'Colaborador', 'Equipe', 'Critério', 'Chamada', 'Valor']} rows={osRows} loading={loading} /></Panel>}
    </>
  );
  return <><PageHead title="Produtividade dos colaboradores" subtitle="Apuração mensal por OS, chamada, faltas e critérios de bonificação." ghostActions={[compare ? 'Ocultar critérios' : 'Ver critérios', showOsLaunches ? 'Ocultar lançamentos' : 'Ver lançamentos por OS']} onGhostAction={(label) => label.includes('critério') || label.includes('critérios') ? setCompare((value) => !value) : setShowOsLaunches((value) => !value)} action="Exportar relatório" onAction={() => downloadCsv('produtividade-colaboradores.csv', exportRows)} /><div className="toolbar"><div className="filter"><label>Buscar</label><input value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, colaborador..." /></div><div className="filter"><label>Colaborador</label><select value={filters.employee} onChange={(event) => setFilters((old) => ({ ...old, employee: event.target.value }))}>{employeeOptions.map((name) => <option key={name}>{name}</option>)}</select></div><div className="filter"><label>Critério</label><select value={filters.criterion} onChange={(event) => setFilters((old) => ({ ...old, criterion: event.target.value }))}><option>Todos</option>{(productivityRules.standard || []).map((rule) => <option key={rule.key}>{rule.name}</option>)}<option>MICHELIN</option><option>Sem critério</option></select></div><div className="filter"><label>Chamada</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Presente</option><option>Falta</option><option>Pendente</option></select></div><span className="spacer" /><span className="soft">{filteredEntries.length} lançamentos</span></div><div className="kpi-grid"><Kpi icon="users" label="Colaboradores avaliados" value={byEmployee.length} delta="com OS no filtro" success /><Kpi icon="file" label="OS apuradas" value={new Set(filteredEntries.map((entry) => entry.order.id || entry.order.number)).size} delta="mês atual filtrado no banco" /><Kpi icon="alert" label="Faltas registradas" value={totalAbsences} delta={`${pendingCalls} chamadas pendentes`} warning /><Kpi icon="money" label="Bônus previsto" value={money(totalBonus)} delta="conforme critérios" /></div>{compare && <Panel title="Critérios de bonificação" padded><DataTable columns={['Equipe/Função', 'Valor integral', '1 ausência', '2 ausências', '3 ausências', '4+ ausências']} rows={(productivityRules.standard || []).map(ruleRow)} /></Panel>}<Panel title="Produtividade por colaborador" padded><DataTable columns={['Colaborador', 'Função', 'Equipe cadastro', 'Critério', 'OS', 'Pres.', 'Faltas', 'Valor base', '%', 'Total']} rows={productivityRows} /></Panel>{showOsLaunches && <Panel title="Lançamentos por OS" padded><DataTable columns={['OS', 'Data', 'Cliente', 'Colaborador', 'Equipe', 'Critério', 'Chamada', 'Valor']} rows={osRows} /></Panel>}</>;
}

function BonusCriteria({ notify, editable = true }) {
  const [form, setForm] = useState(defaultProductivityRules);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    api('/api/settings/productivityRules')
      .then((payload) => setForm(mergeProductivityRules(payload.data)))
      .catch((error) => notify(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const updateRule = (index, patch) => setForm((old) => ({ ...old, standard: old.standard.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule) }));
  const updateMichelin = (patch) => setForm((old) => ({ ...old, michelin: { ...old.michelin, ...patch } }));
  const save = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await withBusy(() => api('/api/settings/productivityRules', { method: 'PUT', body: JSON.stringify(form) }));
    notify('Critérios de bonificação salvos');
  };
  const standardRows = (form.standard || []).map((rule, index) => [
    <input value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} />,
    <input type="number" step="0.01" value={rule.base} onChange={(event) => updateRule(index, { base: Number(event.target.value || 0) })} />,
    <select value={rule.mode} onChange={(event) => updateRule(index, { mode: event.target.value })}><option value="monthly">Mensal</option><option value="per-os">Por OS</option></select>,
    <input value={rule.match} onChange={(event) => updateRule(index, { match: event.target.value })} />
  ]);
  return <><PageHead title="Critérios de Bonificação" subtitle="Cadastro dos valores usados no cálculo de produtividade." action="Salvar critérios" onAction={save} /><Panel title="Critérios padrão" padded><DataTable columns={['Critério', 'Valor integral', 'Tipo', 'Palavras-chave de equipe/função']} rows={loading ? [] : standardRows} loading={loading} /></Panel><Panel title="Regra MICHELIN" padded><div className="form-grid"><SwitchField label="Ativar regra MICHELIN" text="Usar valores por faixa e veículo" checked={form.michelin.enabled} onChange={(value) => updateMichelin({ enabled: value })} /><SwitchField label="Somente segunda a sexta" text="Ignorar sábados e domingos" checked={form.michelin.weekdayOnly} onChange={(value) => updateMichelin({ weekdayOnly: value })} /><Field label="Cliente" value={form.michelin.client} onChange={(value) => updateMichelin({ client: value })} /><Field label="Início faixa 1" type="time" value={form.michelin.commercialStart} onChange={(value) => updateMichelin({ commercialStart: value })} /><Field label="Fim faixa 1" type="time" value={form.michelin.commercialEnd} onChange={(value) => updateMichelin({ commercialEnd: value })} /><Field label="Container/Carreta faixa 1" type="number" value={form.michelin.commercialContainer} onChange={(value) => updateMichelin({ commercialContainer: Number(value || 0) })} /><Field label="Caminhão faixa 1" type="number" value={form.michelin.commercialTruck} onChange={(value) => updateMichelin({ commercialTruck: Number(value || 0) })} /><Field label="Início faixa 2" type="time" value={form.michelin.afterStart} onChange={(value) => updateMichelin({ afterStart: value })} /><Field label="Fim faixa 2" type="time" value={form.michelin.afterEnd} onChange={(value) => updateMichelin({ afterEnd: value })} /><Field label="Container/Carreta faixa 2" type="number" value={form.michelin.afterContainer} onChange={(value) => updateMichelin({ afterContainer: Number(value || 0) })} /><Field label="Caminhão faixa 2" type="number" value={form.michelin.afterTruck} onChange={(value) => updateMichelin({ afterTruck: Number(value || 0) })} /></div></Panel></>;
}

function Reports() {
  const cards = [
    ['Ordens de Serviço', 'Listagem detalhada com filtros por período, cliente, status e equipamento.', '/api/workOrders'],
    ['Produtividade por Equipe', 'Indicadores de t/h, eficiência, OS concluídas e tempo médio.', '/api/workOrders'],
    ['Ocorrências Operacionais', 'Histórico de incidentes por tipo, equipe e local, com SLA.', '/api/occurrences'],
    ['Movimentação de Pessoal', 'Admissões, desligamentos, férias, afastamentos por período.', '/api/employees'],
    ['Equipamentos', 'Utilização, manutenções e vida útil por container/veículo.', '/api/equipment']
  ];
  const [selected, setSelected] = useState(cards[0]);
  const [config, setConfig] = useState(false);
  const reportModels = {
    'Ordens de Serviço': {
      filename: 'ordens-de-servico.csv',
      columns: [
        ['OS', (row) => row.number],
        ['Cliente', (row) => row.client],
        ['Serviço', (row) => row.service],
        ['Equipamento', (row) => row.equipment],
        ['Produto', (row) => row.product],
        ['Local', (row) => row.location],
        ['Responsável', (row) => row.responsible],
        ['Status', (row) => row.status],
        ['Data programada', (row) => dateTime(row.date)],
        ['Início da operação', (row) => dateTime(row.operationStart)],
        ['Fim da operação', (row) => dateTime(row.operationEnd)],
        ['Percentual', (row) => `${row.progress || 0}%`]
      ]
    },
    'Produtividade por Equipe': {
      filename: 'produtividade-por-equipe.csv',
      columns: [
        ['OS', (row) => row.number],
        ['Cliente', (row) => row.client],
        ['Serviço', (row) => row.service],
        ['Equipe / Transportador', (row) => row.carrier],
        ['Integrantes', (row) => Array.isArray(row.teamMembers) ? row.teamMembers.join(', ') : ''],
        ['Status', (row) => row.status],
        ['Faltas', (row) => absenceCount(row)],
        ['Data programada', (row) => dateTime(row.date)],
        ['Início', (row) => dateTime(row.operationStart)],
        ['Fim', (row) => dateTime(row.operationEnd)]
      ]
    },
    'Ocorrências Operacionais': {
      filename: 'ocorrencias-operacionais.csv',
      columns: [
        ['OS', (row) => row.workOrder],
        ['Tipo', (row) => row.type],
        ['Descrição', (row) => row.description],
        ['Status', (row) => row.status],
        ['Data / Hora', (row) => occurrenceTime(row)]
      ]
    },
    'Movimentação de Pessoal': {
      filename: 'movimentacao-de-pessoal.csv',
      columns: [
        ['Nome', (row) => row.name],
        ['CPF', (row) => row.cpf],
        ['Função', (row) => row.role],
        ['Equipe', (row) => row.team],
        ['Base', (row) => row.base],
        ['Admissão', (row) => date(row.admissionDate)],
        ['Status', (row) => row.status]
      ]
    },
    Equipamentos: {
      filename: 'equipamentos.csv',
      columns: [
        ['Código', (row) => row.code],
        ['Tipo', (row) => row.type],
        ['Modelo / Descrição', (row) => row.model],
        ['Capacidade', (row) => row.capacity],
        ['Última manutenção', (row) => date(row.lastMaintenance)],
        ['Status', (row) => row.status]
      ]
    }
  };
  const generate = async (card = selected) => {
    const payload = await withBusy(() => api(card[2] === '/api/workOrders' ? workOrdersEndpoint() : card[2]));
    const rows = listData(payload);
    const model = reportModels[card[0]];
    const headers = model.columns.map(([label]) => label);
    const body = rows.map((row) => model.columns.map(([, render]) => render(row) ?? '-'));
    downloadCsv(model.filename, [headers, ...body]);
  };
  return <><PageHead title="Relatórios" subtitle="Modelos de relatórios prontos e exportação em PDF, XLSX e CSV." ghostAction="Configurar modelos" onGhostAction={() => setConfig(true)} action="Gerar relatório" onAction={() => generate()} /><div className="section-list">{cards.map(([title, text, endpoint], index) => <div className={`section-card ${selected[0] === title ? 'selected-card' : ''}`} key={title} onClick={() => setSelected([title, text, endpoint])} onDoubleClick={() => generate([title, text, endpoint])}><div className="ico"><Icon name={['file', 'clock', 'money', 'box', 'users', 'monitor'][index]} /></div><div><h4>{title}</h4><p>{text}</p></div></div>)}</div>{config && <Editor title="Configurar modelo de relatório" fields={[['name', 'Modelo'], ['format', 'Formato', 'select', ['CSV', 'XLSX', 'PDF']], ['period', 'Período', 'select', ['Hoje', 'Esta semana', 'Este mês', 'Personalizado']]]} initial={{ name: selected[0], format: 'CSV', period: 'Este mês' }} onCancel={() => setConfig(false)} onSave={(data) => { localStorage.setItem('sfTorresReportConfig', JSON.stringify(data)); setConfig(false); triggerAction('Modelo de relatório salvo'); }} />}</>;
}

function Users({ notify, editable = true }) {
  const environment = currentEnvironment();
  const environmentLabel = environment === 'talents' ? 'Banco de Talentos' : 'Centro Operacional';
  return <CrudScreen config={{
    title: 'Usuários & Perfis',
    subtitle: `Gestão de usuários, perfis e permissões do ambiente ${environmentLabel}.`,
    endpoint: '/api/users',
    queryParams: { environment },
    newLabel: 'Novo usuário',
    ghostLabel: 'Configurar perfis',
    panelTitle: 'usuários ativos',
    noToolbar: true,
    columns: [
      { label: 'Usuário', render: (i) => <><b>{i.name}</b><div className="soft">@{String(i.email || '').split('@')[0]}</div></> },
      { label: 'E-mail', key: 'email' },
      { label: 'Perfil', render: (i) => <Pill value={i.role} /> },
      { label: 'Último acesso', render: () => '24/07/2026 09:42' },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [['name', 'Nome'], ['email', 'E-mail'], ['password', 'Senha'], ['role', 'Perfil', 'select', ['Administrador', 'RH / Recrutamento', 'Consulta', 'Líder', 'Operacional', 'Financeiro']], ['status', 'Status', 'select', ['Ativo', 'Inativo']], ['permissions', 'Permissões por tela', 'permissions']],
    beforeSave: (data) => ({ ...data, environment })
  }} notify={notify} editable={editable} />;
}

function Settings({ notify, settings, setSettings, editable = true }) {
  const [form, setForm] = useState(settings);
  useEffect(() => { setForm(settings); }, [settings]);
  const change = (key, value) => setForm((old) => {
    const next = { ...old, [key]: value };
    setSettings(next);
    return next;
  });
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const cards = [
    ['Empresa & Filiais', 'Razão social, CNPJ, endereço, marcas e logos.', 'building', 'empresa'],
    ['Sistema', 'Identidade visual, idioma, fuso horário e formatos.', 'gear', 'sistema'],
    ['Regras Operacionais', 'SLA, janelas de programação, alertas automáticos.', 'clock', 'regras'],
    ['Integrações', 'ERP, fiscal, transportadoras, mensageria.', 'link', 'integracoes'],
    ['Segurança & Auditoria', 'Senhas, 2FA, sessão, log de auditoria.', 'shield', 'seguranca'],
    ['Notificações', 'Canais, gatilhos e destinatários por evento.', 'bell', 'notificacoes']
  ];
  const defaultIntegrations = [
    { name: 'ERP - SAP B1', type: 'REST', endpoint: 'https://erp.sftorres.com.br/api/v1', lastSync: '24/07/2026 09:30', status: 'Ativo' },
    { name: 'Nota Fiscal eletrônica', type: 'SOAP', endpoint: 'https://nfe.sefaz.am.gov.br/ws', lastSync: '24/07/2026 09:25', status: 'Ativo' },
    { name: 'Rastreamento transportadora - Aliança', type: 'Webhook', endpoint: 'https://track.alianca.com.br/hook', lastSync: '24/07/2026 09:42', status: 'Ativo' },
    { name: 'WhatsApp Business', type: 'Official API', endpoint: 'https://graph.facebook.com/v18.0', lastSync: '-', status: 'Pendente' },
    { name: 'SMTP - envio de relatório', type: 'SMTP', endpoint: 'smtp.sftorres.com.br:587', lastSync: '23/07/2026 18:01', status: 'Ativo' }
  ];
  const [integrationEditor, setIntegrationEditor] = useState(null);
  const integrationItems = form.integrations || defaultIntegrations;
  const updateIntegration = (index, patch) => {
    const next = integrationItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    change('integrations', next);
  };
  const nowText = () => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const integrationRows = integrationItems.map((item, index) => [item.name, item.type, <span className="mono">{item.endpoint}</span>, item.lastSync, <Pill value={item.status} />, <><button className="btn btn-sm" onClick={() => { updateIntegration(index, { lastSync: nowText(), status: 'Ativo' }); notify(`${item.name} testada`); }}>Testar</button> <button className="btn btn-sm" onClick={() => setIntegrationEditor({ ...item, index })}>Editar</button> {item.status !== 'Ativo' && <button className="btn btn-sm btn-primary" onClick={() => { updateIntegration(index, { status: 'Ativo', lastSync: nowText() }); notify(`${item.name} conectada`); }}>Conectar</button>}</>]);
  const saveSettings = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar configuracoes');
    await withBusy(() => api(scopedSettingsEndpoint('company'), { method: 'PUT', body: JSON.stringify(form) }));
    setSettings(form);
    notify('Configurações salvas no banco');
  };
  const restoreDefaults = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar configuracoes');
    setForm(defaultSettings);
    setSettings(defaultSettings);
    await withBusy(() => api(scopedSettingsEndpoint('company'), { method: 'PUT', body: JSON.stringify(defaultSettings) }));
    notify('Padrões restaurados');
  };
  return <>
    <PageHead title="Configurações" subtitle="Parâmetros gerais da empresa, do sistema, integrações e políticas operacionais." ghostAction="Restaurar padrões" onGhostAction={restoreDefaults} action="Salvar alterações" onAction={saveSettings} />
    <div data-settings-form>
    <div className="section-list settings-jump">{cards.map(([name, text, icon, id]) => <div className="section-card" key={name} onClick={() => jump(id)}><div className="ico"><Icon name={icon} /></div><div><h4>{name}</h4><p>{text}</p></div></div>)}</div>
    <div id="empresa"><Panel title="Empresa & Filiais" padded actions={<span className="soft">Identidade institucional usada em relatórios e PDF</span>}>
      <div className="form-grid">
        <Field label="Razão social" value={form.legalName} onChange={(value) => change('legalName', value)} />
        <Field label="Nome fantasia" value={form.fantasyName} onChange={(value) => change('fantasyName', value)} />
        <Field label="CNPJ" value={form.cnpj} onChange={(value) => change('cnpj', value)} />
        <Field label="Inscrição estadual" value={form.stateRegistration} onChange={(value) => change('stateRegistration', value)} />
        <Field label="Endereço" value={form.address} onChange={(value) => change('address', value)} full />
        <Field label="Telefone principal" value={form.phone} onChange={(value) => change('phone', value)} />
        <Field label="E-mail corporativo" value={form.email} onChange={(value) => change('email', value)} />
        <LogoUpload title="Logo principal exibida no sidebar" name="assets/logo-st.svg" desc='Marca principal do sistema' value={form.primaryLogo} onChange={(value) => change('primaryLogo', value)} fallback={<LogoST />} />
        <LogoUpload title="Logo secundária (login/institucional)" name="assets/logo-sm.svg" desc='Marca exibida no login' value={form.secondaryLogo} onChange={(value) => change('secondaryLogo', value)} fallback={<LogoSM small />} />
        <div className="form-field full"><label>Marca exibida na barra superior</label><div className="radio-row">{[['none', 'Não exibir (texto)'], ['st', 'Logo ST'], ['sm', 'Logo SM'], ['both', 'Ambas lado a lado']].map(([value, label]) => <label key={value}><input type="radio" name="navbar-logo" checked={form.topbarLogo === value} onChange={() => change('topbarLogo', value)} /> {label}</label>)}</div></div>
      </div>
    </Panel></div>
    <div id="sistema"><Panel title="Sistema" padded><div className="form-grid"><Field label="Identificador interno" value="SF-TORRES-PROD" /><Field label="Ambiente" value="Produção" /><Field label="Idioma" value="Português (Brasil)" /><Field label="Fuso horário" value="America/Manaus (-04:00)" /><Field label="Moeda" value="BRL - Real Brasileiro" /><Field label="Formato de data" value="DD/MM/AAAA" /><Field label="Densidade da interface" value="Compacta (recomendada)" /><Field label="Tema" value="Personalizado" /><div className="form-field full"><label>Identidade visual</label><div className="color-row"><ColorToken label="Primária" value={form.primaryColor} onChange={(value) => change('primaryColor', value)} /><ColorToken label="Destaque" value={form.accentColor} onChange={(value) => change('accentColor', value)} /><ColorToken label="Sucesso" value={form.successColor} onChange={(value) => change('successColor', value)} /><ColorToken label="Erro" value={form.dangerColor} onChange={(value) => change('dangerColor', value)} /><ColorToken label="Sidebar" value={form.sidebarColor} onChange={(value) => change('sidebarColor', value)} /></div></div></div></Panel></div>
    <div id="regras"><Panel title="Regras Operacionais" padded><div className="form-grid"><Field label="SLA para aprovação de OS (horas)" value={form.approvalSla || '4'} type="number" onChange={(value) => change('approvalSla', value)} /><Field label="SLA de conclusão de OS (horas)" value={form.completionSla || '24'} type="number" onChange={(value) => change('completionSla', value)} /><Field label="Início da janela de programação" value={form.scheduleStart || '06:00'} type="time" onChange={(value) => change('scheduleStart', value)} /><Field label="Fim da janela de programação" value={form.scheduleEnd || '22:00'} type="time" onChange={(value) => change('scheduleEnd', value)} /><SwitchField label="Bloquear OS sem equipamento vinculado" text="Habilitado" checked={form.blockOrderWithoutEquipment ?? true} onChange={(value) => change('blockOrderWithoutEquipment', value)} /><SwitchField label="Notificar torre ao detectar paralisação > 30 min" text="Habilitado" checked={form.notifyStops ?? true} onChange={(value) => change('notifyStops', value)} /><Field label="Mensagem padrão em footer de relatórios" value={form.reportFooter || `${form.legalName} · CNPJ ${form.cnpj} · Uso interno.`} full onChange={(value) => change('reportFooter', value)} /></div></Panel></div>
    <div id="integracoes"><Panel title="Integrações"><DataTable columns={['Integração', 'Tipo', 'Endpoint', 'Última sincronização', 'Status', 'Ações']} rows={integrationRows} /></Panel></div>
    <div id="seguranca"><Panel title="Segurança & Auditoria" padded><div className="form-grid"><Field label="Política de senha" value={form.passwordPolicy || 'Padrão (mín. 8, 1 maiúscula, 1 número)'} onChange={(value) => change('passwordPolicy', value)} /><Field label="Expiração de senha (dias)" value={form.passwordExpiration || '90'} type="number" onChange={(value) => change('passwordExpiration', value)} /><Field label="Tempo máximo de sessão (min)" value={form.sessionTimeout || '120'} type="number" onChange={(value) => change('sessionTimeout', value)} /><Field label="Tentativas antes de bloqueio" value={form.maxAttempts || '5'} type="number" onChange={(value) => change('maxAttempts', value)} /><SwitchField label="Autenticação em duas etapas (2FA)" text="Habilitado para administradores" checked={form.twoFactor ?? true} onChange={(value) => change('twoFactor', value)} /><SwitchField label="Log de auditoria detalhado" text="Registra toda ação em OS" checked={form.auditLog ?? true} onChange={(value) => change('auditLog', value)} /><Field label="IPs liberados para acesso administrativo" value={form.allowedIps || '192.168.0.0/24&#10;10.0.0.0/8'} full onChange={(value) => change('allowedIps', value)} /></div></Panel></div>
    <div id="notificacoes"><Panel title="Notificações"><DataTable columns={['Evento', 'E-mail', 'Sistema', 'WhatsApp', 'Destinatários']} rows={[['Nova OS criada', <Switch checked={form.notifyNewOrderEmail ?? true} onChange={(value) => change('notifyNewOrderEmail', value)} />, <Switch checked={form.notifyNewOrderSystem ?? true} onChange={(value) => change('notifyNewOrderSystem', value)} />, <Switch checked={form.notifyNewOrderWhatsapp ?? false} onChange={(value) => change('notifyNewOrderWhatsapp', value)} />, 'Líder de turno, Torre'], ['OS concluída', <Switch checked={form.notifyDoneEmail ?? true} onChange={(value) => change('notifyDoneEmail', value)} />, <Switch checked={form.notifyDoneSystem ?? true} onChange={(value) => change('notifyDoneSystem', value)} />, <Switch checked={form.notifyDoneWhatsapp ?? true} onChange={(value) => change('notifyDoneWhatsapp', value)} />, 'Cliente, Operações'], ['Ocorrência crítica', <Switch checked={form.notifyCriticalEmail ?? true} onChange={(value) => change('notifyCriticalEmail', value)} />, <Switch checked={form.notifyCriticalSystem ?? true} onChange={(value) => change('notifyCriticalSystem', value)} />, <Switch checked={form.notifyCriticalWhatsapp ?? true} onChange={(value) => change('notifyCriticalWhatsapp', value)} />, 'Diretoria, Torre'], ['Medição fechada', <Switch checked={form.notifyMeasurementEmail ?? true} onChange={(value) => change('notifyMeasurementEmail', value)} />, <Switch checked={form.notifyMeasurementSystem ?? false} onChange={(value) => change('notifyMeasurementSystem', value)} />, <Switch checked={form.notifyMeasurementWhatsapp ?? false} onChange={(value) => change('notifyMeasurementWhatsapp', value)} />, 'Financeiro']]} /></Panel></div>
    </div>
    {integrationEditor && <Editor title="Editar integração" fields={[['name', 'Integração'], ['type', 'Tipo'], ['endpoint', 'Endpoint'], ['status', 'Status', 'select', ['Ativo', 'Pendente', 'Inativo']]]} initial={integrationEditor} onCancel={() => setIntegrationEditor(null)} onSave={(data) => { updateIntegration(integrationEditor.index, { ...data, lastSync: integrationEditor.lastSync }); setIntegrationEditor(null); notify('Integração atualizada'); }} />}
  </>;
}

function DailyOps({ notify, editable = true }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [services, setServices] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [productivityRules, setProductivityRules] = useState(defaultProductivityRules);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(null);
  const [occurrenceModal, setOccurrenceModal] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dados');
  const [filters, setFilters] = useState({ q: '', status: 'Todos', client: 'Todos', period: 'Este mês', from: monthRange().from.slice(0, 10), to: monthRange().to.slice(0, 10), table: '' });
  const optionValues = (list, ...keys) => list.map((item) => keys.map((key) => item[key]).find(Boolean)).filter(Boolean);
  const equipmentTypes = ['', ...Array.from(new Set(equipment.map((item) => [item.code, item.type].filter(Boolean).join(' - ')).filter(Boolean)))];
  const fields = [
    ['number', 'Número da OS', 'text', null, null, true],
    ['client', 'Cliente', 'select', ['', ...optionValues(clients, 'name', 'legalName')], null, true],
    ['equipment', 'Equipamento', 'select', equipmentTypes],
    ['containerNumber', 'Número do container', 'text', null, (form) => normalize(form.equipment).includes('container')],
    ['trailerPlate', 'Placa da carreta', 'text', null, (form) => normalize(form.equipment).includes('carreta')],
    ['status', 'Status', 'select', ['Programado', 'Em execucao', 'Finalizado', 'Cancelado']],
    ['date', 'Data programada', 'datetime-local', null, null, true],
    ['carrier', 'Transportador'],
    ['service', 'Serviço', 'select', ['', ...optionValues(services, 'description', 'code')], null, true],
    ['responsible', 'Responsável', 'select', ['', ...optionValues(leaders, 'name')], null, true],
    ['teamMembers', 'Integrantes da equipe', 'employees', { endpoint: '/api/employees', roles: (form) => isMichelinOrder(form, productivityRules) ? [] : productivityRules.standard }],
    ['product', 'Produto'],
    ['operationStart', 'Início da operação', 'datetime-local'],
    ['operationEnd', 'Fim da operação', 'datetime-local'],
    ['progress', 'Percentual', 'number']
  ];
  const clientOptions = ['Todos', ...Array.from(new Set(items.map((item) => item.client).filter(Boolean)))];
  const periodRange = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (filters.period === 'Esta semana') {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - start.getDay());
      return { from: localDateValue(weekStart), to: localDateValue(today) };
    }
    if (filters.period === 'Hoje') return { from: localDateValue(today), to: localDateValue(today) };
    if (filters.period === 'Personalizado') return { from: filters.from, to: filters.to };
    return { from: monthRange().from.slice(0, 10), to: monthRange().to.slice(0, 10) };
  };
  const filteredItems = items.filter((item) => {
    const text = normalize(`${item.number} ${item.client} ${item.equipment} ${item.service} ${item.carrier}`);
    const query = normalize(`${filters.q} ${filters.table}`);
    const statusOk = filters.status === 'Todos' || normalize(item.status) === normalize(filters.status);
    const clientOk = filters.client === 'Todos' || item.client === filters.client;
    return text.includes(query.trim()) && statusOk && clientOk;
  });
  const selected = filteredItems.find((i) => i.id === selectedId) || filteredItems[0];
  const load = () => {
    const range = periodRange();
    setLoading(true);
    api(workOrdersRangeEndpoint(range.from, range.to)).then((p) => { const data = listData(p); setItems(data); setSelectedId((old) => old || data[0]?.id || ''); }).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false));
  };
  const loadOccurrences = () => api('/api/occurrences').then((p) => setOccurrences(listData(p))).catch(() => setOccurrences([]));
  useEffect(() => { load(); }, [filters.period, filters.from, filters.to]);
  useEffect(() => { loadOccurrences(); }, []);
  useEffect(() => {
    api('/api/clients').then((payload) => setClients(listData(payload))).catch(() => {});
    api('/api/equipment').then((payload) => setEquipment(listData(payload))).catch(() => {});
    api('/api/services').then((payload) => setServices(listData(payload))).catch(() => {});
    api('/api/employees?limit=500').then((payload) => setLeaders(listData(payload).filter((item) => normalize(item.role).includes('lider')))).catch(() => {});
    api('/api/settings/productivityRules').then((payload) => setProductivityRules(mergeProductivityRules(payload.data))).catch(() => {});
  }, []);
  useEffect(() => {
    if (filteredItems.length && !filteredItems.some((item) => item.id === selectedId)) setSelectedId(filteredItems[0].id);
  }, [filters, items]);
  const save = async (data) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const user = currentUser();
    if (items.some((item) => item.id !== modal?.id && normalize(item.number) === normalize(data.number))) return notify('Ja existe uma OS com este numero');
    const members = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    const teamRoles = isMichelinOrder(data, productivityRules) ? {} : Object.fromEntries(Object.entries(data.teamRoles || {}).filter(([name]) => members.includes(name)));
    const cleanData = { ...data, teamRoles, location: '' };
    const payload = modal?.id ? cleanData : { ...cleanData, progress: data.progress || 0, createdBy: data.createdBy || user.name || user.email || 'Administrador SF' };
    await withBusy(() => api(modal?.id ? `/api/workOrders/${modal.id}` : '/api/workOrders', { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }));
    setModal(null); notify('OS salva'); load();
  };
  const remove = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected || !confirm('Apagar esta OS?')) return;
    await withBusy(() => api(`/api/workOrders/${selected.id}`, { method: 'DELETE' }));
    notify('OS apagada'); setSelectedId(''); load();
  };
  const exportFiltered = () => downloadCsv('operacao-diaria.csv', [['OS', 'Cliente', 'Equipamento', 'Status', 'Data', 'Serviço', 'Equipe'], ...filteredItems.map((item) => [item.number, item.client, item.equipment, item.status, item.date, item.service, item.carrier])]);
  const releaseCorrection = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected) return;
    await withBusy(async () => {
      await api(`/api/workOrders/${selected.id}`, { method: 'PUT', body: JSON.stringify({ ...selected, correctionApproved: true }) });
      await api('/api/occurrences', { method: 'POST', body: JSON.stringify({ workOrder: selected.number, type: 'Correção', description: 'Correção liberada pela administração para edição do líder', status: 'Liberada', createdAt: new Date().toISOString() }) });
    });
    notify('Correção liberada para o líder');
    load();
  };
  const registerOccurrence = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected) return;
    setOccurrenceModal(selected);
  };
  const saveOccurrence = async (data) => {
    await withBusy(() => api('/api/occurrences', { method: 'POST', body: JSON.stringify({ ...data, workOrder: occurrenceModal.number, status: data.status || 'Aberta', createdAt: new Date().toISOString() }) }));
    notify('Ocorrência registrada no banco');
    setOccurrenceModal(null);
    loadOccurrences();
  };
  const selectedOccurrences = selected ? occurrences.filter((item) => occurrenceBelongsToOrder(item, selected)) : [];
  const detailContent = () => {
    if (!selected) return null;
    if (activeTab === 'Equipe') return [['Equipe', Array.isArray(selected.teamMembers) && selected.teamMembers.length ? selected.teamMembers.join(', ') : 'Sem integrantes definidos'], ['Responsável', selected.responsible || '-'], ['Justificativa', selected.teamNote || '-']];
    if (activeTab === 'Horários') return [['Data programada', dateTime(selected.date)], ['Início da operação', selected.operationStart || '-'], ['Fim da operação', selected.operationEnd || '-'], ['Janela', selected.window || '06:00 - 22:00']];
    if (activeTab === 'Ocorrências') return [
      ['Status operacional', selected.status],
      ['Solicitação de correção', selected.correctionRequested ? (selected.correctionApproved ? 'Liberada' : 'Aguardando liberação') : 'Sem solicitação'],
      ...selectedOccurrences.map((item) => [`${item.type || 'Ocorrência'} · ${item.status || '-'}`, occurrenceDetail(item)]),
      ...(selectedOccurrences.length ? [] : [['Ocorrências', 'Nenhuma ocorrência lançada para esta OS']])
    ];
    return [['Data programada', dateTime(selected.date)], ['Criado por', selected.createdBy || '-'], ['Transportador', selected.carrier], ['Serviço', selected.service], ['Produto', selected.product || '-'], ['Equipamento', selected.equipment || '-'], ['Container', selected.containerNumber || '-'], ['Placa', selected.trailerPlate || '-'], ['Responsável', selected.responsible], ['Percentual', `${selected.progress || 0}%`]];
  };
  return (
    <>
      <PageHead title="Operação Diária" subtitle="Gestão detalhada das OS com filtros, confirmação de equipe, horários e ocorrências." ghostActions={['Histórico', 'Exportar planilha']} onGhostAction={(label) => label === 'Histórico' ? setHistoryOpen(true) : exportFiltered()} action="Nova OS" onAction={() => setModal({ status: 'Programado' })} />
      <div className="toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Programado</option><option>Em execucao</option><option>Finalizado</option><option>Cancelado</option></select></div>
        <div className="filter"><label>Cliente</label><select value={filters.client} onChange={(event) => setFilters((old) => ({ ...old, client: event.target.value }))}>{clientOptions.map((client) => <option key={client}>{client}</option>)}</select></div>
        <div className="filter"><label>Período</label><select value={filters.period} onChange={(event) => setFilters((old) => ({ ...old, period: event.target.value }))}><option>Hoje</option><option>Esta semana</option><option>Este mês</option><option>Personalizado</option></select></div>
        {filters.period === 'Personalizado' && <><div className="filter"><label>De</label><input type="date" value={filters.from} onChange={(event) => setFilters((old) => ({ ...old, from: event.target.value || old.from }))} /></div><div className="filter"><label>Até</label><input type="date" value={filters.to} onChange={(event) => setFilters((old) => ({ ...old, to: event.target.value || old.to }))} /></div></>}
        <span className="spacer" />
        <span className="soft">{filteredItems.length} resultados</span>
      </div>
      <div className="detail">
        <div className="pane" style={{ overflow: 'hidden' }}>
          <div className="table-tools"><input className="search-input" value={filters.table} onChange={(event) => setFilters((old) => ({ ...old, table: event.target.value }))} placeholder="Filtrar resultados..." /><span className="spacer" /><button className="btn btn-sm" onClick={() => setItems((old) => [...old].sort((a, b) => String(b.date).localeCompare(String(a.date))))}>Ordenar: Data ↓</button></div>
          <div className="table-scroll"><table className="dtbl"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Status</th><th className="right">Falta</th><th className="right">Data programada</th></tr></thead><tbody>{loading ? <LoadingCell colSpan={6} /> : filteredItems.map((i) => <tr key={i.id} className={selected?.id === i.id ? 'selected' : ''} onClick={() => setSelectedId(i.id)}><td className="mono">{i.number}</td><td>{i.client}</td><td className="mono">{i.equipment || '-'}</td><td><Pill value={i.status} /></td><td className="right">{absenceCount(i)}</td><td className="right">{dateTime(i.date)}</td></tr>)}</tbody></table></div>
        </div>
        <div className="pane">{selected && <><div className="pane-head"><div><div className="eyebrow">Ordem de Serviço</div><div className="mono-title">OS {selected.number} · {selected.client}</div></div><div className="meta"><Pill value={selected.status} /></div></div><div className="tabs">{['Dados', 'Equipe', 'Horários', 'Ocorrências'].map((tab) => <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</div>)}</div><div className="pane-body">{detailContent().map(([k, v]) => <div className="field-row" key={k}><b>{k}</b><span>{displayValue(v)}</span></div>)}</div><div className="action-strip"><button className="btn" onClick={() => setModal(selected)}>Editar OS</button>{selected.correctionRequested && !selected.correctionApproved && <button className="btn btn-primary" onClick={releaseCorrection}>Liberar correção</button>}<button className="btn btn-success" onClick={registerOccurrence}>Lançar ocorrência</button><button className="btn btn-danger push" onClick={remove}>Apagar</button></div></>}</div>
      </div>
      {modal && <Editor title={modal.id ? 'Editar OS' : 'Nova OS'} fields={fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}
      {occurrenceModal && <Editor title={`Lançar ocorrência · OS ${occurrenceModal.number}`} fields={occurrenceFields} initial={{ workOrder: occurrenceModal.number, type: 'Operacional', status: 'Aberta' }} onCancel={() => setOccurrenceModal(null)} onSave={saveOccurrence} />}
      {historyOpen && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>Histórico da operação</h3><button className="btn btn-sm" onClick={() => setHistoryOpen(false)}>Fechar</button></div><div className="modal-body"><DataTable columns={['OS', 'Cliente', 'Status', 'Data', 'Criado por']} rows={items.map((item) => [item.number, item.client, <Pill value={item.status} />, dateTime(item.date), item.createdBy || '-'])} /></div></div></div>}
    </>
  );
}

function CrudScreen({ config, notify, beforeTable, editable = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [toolbarFilters, setToolbarFilters] = useState({});
  const [meta, setMeta] = useState({ total: 0, limit: 100, offset: 0 });
  const [pageOffset, setPageOffset] = useState(0);
  const [modal, setModal] = useState(null);
  const importInputRef = useRef(null);
  const fieldMap = { Função: 'role', Equipe: 'team', Local: 'location', Turno: 'shift', Status: 'status', Tipo: 'type' };
  const pageSize = meta.limit || 100;
  const load = (offset = pageOffset) => {
    const query = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
    Object.entries(config.queryParams || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
    const toolbarSearch = (config.toolbar || [])
      .filter(([label, , type]) => type === 'input' && toolbarFilters[label])
      .map(([label]) => toolbarFilters[label])
      .join(' ');
    const searchText = [q, toolbarSearch].filter(Boolean).join(' ').trim();
    if (searchText) query.set('q', searchText);
    (config.toolbar || []).forEach(([label, , type]) => {
      const value = toolbarFilters[label];
      const key = fieldMap[label];
      if (!key || type !== 'select' || !value || value === 'Todos' || value === 'Todas') return;
      query.set(key, value);
    });
    const separator = config.endpoint.includes('?') ? '&' : '?';
    setLoading(true);
    api(`${config.endpoint}${separator}${query.toString()}`)
      .then((p) => {
        const list = listData(p);
        setItems(list);
        setMeta(p.meta || { total: list.length, limit: pageSize, offset });
        setPageOffset(offset);
      })
      .catch((error) => {
        setItems([]);
        setMeta({ total: 0, limit: pageSize, offset: 0 });
        notify(error.message);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(pageOffset); }, [q, toolbarFilters, config.endpoint, pageOffset]);
  const displayItems = (config.toolbar || []).reduce((list, [label]) => {
    const value = toolbarFilters[label];
    const key = fieldMap[label];
    if (!value || value === 'Todos' || value === 'Todas') return list;
    if (!key) return list.filter((item) => normalize(Object.values(item).join(' ')).includes(normalize(value)));
    if (key === 'role') return list.filter((item) => normalize(item[key]).includes(normalize(value)));
    return list.filter((item) => normalize(item[key]) === normalize(value));
  }, items);
  const save = async (data) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const payload = config.beforeSave ? config.beforeSave(data) : data;
    await withBusy(() => api(modal?.id ? `${config.endpoint}/${modal.id}` : config.endpoint, { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(payload) }));
    setModal(null); notify('Registro salvo'); load();
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !config.importRows) return;
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    try {
      const rows = await readSpreadsheetRows(file);
      const records = config.importRows(rows);
      if (!records.length) return notify('Nenhum colaborador encontrado na planilha');
      const byCode = Object.fromEntries(items.filter((item) => item.code).map((item) => [normalize(item.code), item]));
      const byName = Object.fromEntries(items.filter((item) => item.name).map((item) => [normalize(item.name), item]));
      let created = 0;
      let updated = 0;
      await withBusy(async () => {
        for (const record of records) {
          const payload = config.beforeSave ? config.beforeSave(record) : record;
          const existing = byCode[normalize(payload.code)] || byName[normalize(payload.name)];
          await api(existing ? `${config.endpoint}/${existing.id}` : config.endpoint, { method: existing ? 'PUT' : 'POST', body: JSON.stringify(payload) });
          if (existing) updated += 1;
          else created += 1;
        }
      });
      notify(`Importacao concluida: ${created} novos, ${updated} atualizados`);
      load();
    } catch (error) {
      notify(error.message || 'Falha ao importar planilha');
    }
  };
  const remove = async (item) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!confirm('Apagar este registro?')) return;
    await withBusy(() => api(`${config.endpoint}/${item.id}`, { method: 'DELETE' }));
    notify('Registro apagado'); load();
  };
  const ghostAction = config.importRows ? () => importInputRef.current?.click() : undefined;
  const changeToolbarFilters = (updater) => {
    setPageOffset(0);
    setToolbarFilters(updater);
  };
  const changeSearch = (value) => {
    setPageOffset(0);
    setQ(value);
  };
  const total = meta.total || displayItems.length;
  const currentOffset = meta.offset || 0;
  const currentLimit = meta.limit || pageSize;
  const currentPage = Math.floor(currentOffset / currentLimit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / currentLimit));
  const rangeStart = total ? currentOffset + 1 : 0;
  const rangeEnd = Math.min(currentOffset + displayItems.length, total);
  const canPrev = currentOffset > 0;
  const canNext = currentOffset + currentLimit < total;
  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} ghostAction={config.ghostLabel} onGhostAction={ghostAction} action={editable ? config.newLabel : null} onAction={() => setModal({})} />
      {config.importRows && <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={importFile} />}
      {config.toolbar && <Toolbar fields={config.toolbar} count={total} values={toolbarFilters} onChange={changeToolbarFilters} />}
      {!config.noToolbar && !config.toolbar && <div className="toolbar"><div className="filter"><label>Buscar</label><input value={q} onChange={(e) => changeSearch(e.target.value)} placeholder="Buscar..." /></div><span className="spacer" /><span className="soft">{total} registros</span></div>}
      {beforeTable}
      <div className="panel" style={{ overflow: 'hidden' }}><div className="panel-head"><h3>{panelTitle(config, total)}</h3>{config.panelActions && <div className="actions">{typeof config.panelActions === 'function' ? config.panelActions({ items: displayItems, load }) : config.panelActions}</div>}</div><div className="panel-body" style={{ padding: 0 }}><table className="dtbl"><thead><tr>{config.columns.map((c) => <th key={c.label} className={c.right ? 'right' : ''}>{c.label}</th>)}<th /></tr></thead><tbody>{loading ? <LoadingCell colSpan={config.columns.length + 1} /> : displayItems.map((item) => <tr key={item.id}>{config.columns.map((c) => <td key={c.label} className={`${c.mono ? 'mono' : ''} ${c.right ? 'right' : ''}`}>{c.render ? c.render(item) : item[c.key]}</td>)}<td className="right">{editable ? <><button className="btn btn-sm" onClick={() => setModal(item)}>Editar</button> <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Apagar</button></> : <span className="soft">Somente leitura</span>}</td></tr>)}</tbody></table><div className="pagination-bar"><span>{rangeStart}-{rangeEnd} de {total} registros</span><div><button className="btn btn-sm" disabled={!canPrev || loading} onClick={() => setPageOffset(Math.max(currentOffset - currentLimit, 0))}>Anterior</button><span className="soft">Pagina {currentPage} de {totalPages}</span><button className="btn btn-sm" disabled={!canNext || loading} onClick={() => setPageOffset(currentOffset + currentLimit)}>Proxima</button></div></div></div></div>
      {modal && <Editor title={modal.id ? `Editar ${config.title}` : config.newLabel} fields={config.fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}
    </>
  );
}

function panelTitle(config, count) {
  if (!config.panelTitle) return `${count} registros`;
  const first = config.panelTitle.charAt(0);
  return first === first.toLowerCase() ? `${count} ${config.panelTitle}` : config.panelTitle;
}

function Editor({ title, fields, initial, onCancel, onSave, uppercase = false, className = '' }) {
  const hasEmployeePicker = fields.some(([, , type]) => type === 'employees');
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(fields.map(([name, , type]) => [name, ['permissions', 'employees'].includes(type) ? (initial?.[name] || (type === 'permissions' ? defaultUserPermissions(initial?.role) : [])) : initial?.[name] ?? ''])),
    ...(hasEmployeePicker ? { teamRoles: initial?.teamRoles || {} } : {})
  }));
  const [submitting, setSubmitting] = useState(false);
  const change = (name, value, type) => setForm((old) => {
    const shouldUppercase = uppercase && ['text', 'textarea'].includes(type || 'text');
    const formatted = type === 'number' ? Number(value || 0) : type === 'cpf' ? formatCpf(value) : type === 'personName' ? formatPersonNameInput(value) : (shouldUppercase || type === 'uppercaseText') ? String(value || '').toUpperCase() : value;
    const next = { ...old, [name]: formatted };
    if (name === 'equipment') {
      if (!normalize(value).includes('container')) next.containerNumber = '';
      if (!normalize(value).includes('carreta')) next.trailerPlate = '';
    }
    if (name === 'role' && fields.some(([, , fieldType]) => fieldType === 'permissions')) {
      next.permissions = defaultUserPermissions(value);
    }
    return next;
  });
  const isVisible = (visible) => !visible || visible(form);
  const isRequired = (required) => typeof required === 'function' ? required(form) : Boolean(required);
  const isEmpty = (value) => Array.isArray(value) ? value.length === 0 : ['', '-'].includes(String(value ?? '').trim());
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const missing = fields.find(([name, label, , , visible, required]) => isVisible(visible) && isRequired(required) && isEmpty(form[name]));
    if (missing) return alert(`Preencha o campo obrigatorio: ${missing[1]}`);
    const invalidCpf = fields.find(([name, label, type, , visible]) => isVisible(visible) && type === 'cpf' && !isValidCpf(form[name]));
    if (invalidCpf) return alert(`Informe um CPF valido: ${invalidCpf[1]}`);
    try {
      setSubmitting(true);
      await onSave(form);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className={`modal ${className}`}>
        <div className="modal-head"><h3>{title}</h3><button className="btn btn-sm" onClick={onCancel} disabled={submitting}>Fechar</button></div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-grid">{fields.map(([name, label, type = 'text', options, visible, required]) => {
            if (!isVisible(visible)) return null;
            if (type === 'permissions') return <PermissionMatrix key={name} label={label} value={form[name]} onChange={(value) => change(name, value, type)} />;
            if (type === 'employees') return <EmployeePicker key={name} label={`${label}${isRequired(required) ? ' *' : ''}`} source={typeof options === 'function' ? options(form) : options} value={form[name]} rolesValue={form.teamRoles || {}} onChange={(value) => change(name, value, type)} onRolesChange={(value) => change('teamRoles', value)} />;
            return <div className="form-field" key={name}><label>{label}{isRequired(required) ? ' *' : ''}</label>{type === 'select' ? <select value={form[name]} required={isRequired(required)} onChange={(e) => change(name, e.target.value, type)}>{options.map((o) => <option key={o || '-'} value={o}>{o || '-'}</option>)}</select> : type === 'textarea' ? <textarea value={form[name]} required={isRequired(required)} onChange={(e) => change(name, e.target.value, type)} /> : <input type={['cpf', 'personName', 'uppercaseText'].includes(type) ? 'text' : type} value={form[name]} required={isRequired(required)} maxLength={type === 'cpf' ? 14 : undefined} onFocus={(e) => type === 'number' && String(form[name]) === '0' && e.target.select()} onChange={(e) => change(name, e.target.value, type)} />}</div>;
          })}</div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="btn btn-primary" disabled={submitting}>{submitting ? <LoadingSpinner small /> : 'Salvar'}</button></div>
        </form>
      </div>
    </div>
  );
}

function PermissionMatrix({ label, value = {}, onChange }) {
  const setPermission = (route, permission) => onChange({ ...value, [route]: permission });
  return (
    <div className="permissions-grid">
      <div className="permissions-head">{label}</div>
      {Object.entries(routes).map(([key, item]) => (
        <div className="permissions-row" key={key}>
          <div><b>{item.title}</b><span>{item.group}</span></div>
          <select value={value?.[key] || 'none'} onChange={(event) => setPermission(key, event.target.value)}>
            <option value="none">Sem acesso</option>
            <option value="view">Visualizar</option>
            <option value="edit">Editar</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function EmployeePicker({ label, source, value = [], rolesValue = {}, onChange, onRolesChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const selected = Array.isArray(value) ? value : [];
  const endpoint = typeof source === 'object' && source?.endpoint ? source.endpoint : '';
  const roleOptions = (typeof source === 'object' && Array.isArray(source?.roles) ? source.roles : defaultProductivityRules.standard).map((rule) => rule.name);
  const staticOptions = Array.isArray(source) ? source : [];
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    if (!endpoint) {
      setResults(staticOptions.filter((name) => normalize(name).includes(normalize(q))).map((name) => ({ name })));
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api(`${endpoint}?q=${encodeURIComponent(q)}&limit=10`)
        .then((payload) => {
          if (active) setResults(listData(payload).filter((item) => item.status !== 'Inativo'));
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, endpoint, source]);
  const visibleOptions = results.map((item) => item.name).filter(Boolean).filter((name) => !selected.includes(name)).slice(0, 8);
  const toggle = (name) => {
    if (!selected.includes(name)) return onChange([...selected, name]);
    onChange(selected.filter((item) => item !== name));
    const nextRoles = { ...(rolesValue || {}) };
    delete nextRoles[name];
    onRolesChange?.(nextRoles);
  };
  const add = (name) => {
    if (!selected.includes(name)) onChange([...selected, name]);
    setQuery('');
  };
  const toggleRole = (name, role) => {
    const current = Array.isArray(rolesValue?.[name]) ? rolesValue[name] : [];
    const next = current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
    onRolesChange?.({ ...(rolesValue || {}), [name]: next });
  };
  return (
    <div className="permissions-grid full">
      <div className="permissions-head">{label}</div>
      <div className="employee-search-picker">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar colaborador pelo nome..." />
        <div className="employee-selected employee-selected-list">
          {selected.map((name) => <div className="employee-assignment" key={name}><div><b>{name}</b><button type="button" className="selected-chip" onClick={() => toggle(name)}>Remover</button></div>{roleOptions.length ? <div className="role-checks">{roleOptions.map((role) => <label key={role}><input type="checkbox" checked={(rolesValue?.[name] || []).includes(role)} onChange={() => toggleRole(name, role)} /> {role}</label>)}</div> : <span className="soft">Regra MICHELIN aplicada automaticamente para esta OS.</span>}</div>)}
          {!selected.length && <span className="soft">Nenhum integrante selecionado.</span>}
        </div>
        <div className="employee-results">
          {visibleOptions.map((name) => <button type="button" key={name} onClick={() => add(name)}>{name}</button>)}
          {loading && <span className="soft">Buscando colaboradores...</span>}
          {query.trim().length > 0 && query.trim().length < 2 && <span className="soft">Digite pelo menos 2 letras para buscar.</span>}
          {query.trim().length >= 2 && !loading && !visibleOptions.length && <span className="soft">Nenhum colaborador encontrado.</span>}
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({ order, onCancel, onSave }) {
  const members = Array.isArray(order.teamMembers) ? order.teamMembers : [];
  const existing = order.attendance || {};
  const readStatus = (name) => typeof existing[name] === 'object' ? existing[name].status : existing[name];
  const readNote = (name) => typeof existing[name] === 'object' ? existing[name].note : '';
  const [attendance, setAttendance] = useState(() => Object.fromEntries(members.map((name) => [name, { status: readStatus(name) || 'Presente', note: readNote(name) || '' }])));
  const [submitting, setSubmitting] = useState(false);
  const change = (name, patch) => setAttendance((old) => ({ ...old, [name]: { ...(old[name] || { status: 'Presente', note: '' }), ...patch } }));
  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const missingNote = members.find((name) => {
      const previous = readStatus(name) || 'Presente';
      const current = attendance[name]?.status || 'Presente';
      const changed = previous !== current;
      return (current === 'Falta' || changed) && !String(attendance[name]?.note || '').trim();
    });
    if (missingNote) return alert(`Informe a observacao da chamada para ${missingNote}`);
    try {
      setSubmitting(true);
      await onSave(attendance);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head"><h3>Chamada da equipe</h3><button className="btn btn-sm" onClick={onCancel} disabled={submitting}>Fechar</button></div>
        <form className="modal-body" onSubmit={submit}>
          <div className="permissions-grid">
            <div className="permissions-head">OS {order.number} - presença</div>
            {members.map((name) => <div className="attendance-row" key={name}><div><b>{name}</b><span>Integrante da equipe</span></div><select value={attendance[name]?.status || 'Presente'} onChange={(event) => change(name, { status: event.target.value })}><option>Presente</option><option>Falta</option></select><input value={attendance[name]?.note || ''} onChange={(event) => change(name, { note: event.target.value })} placeholder="Observação obrigatória se faltar ou alterar presença" /></div>)}
            {!members.length && <div className="employee-picker"><span className="soft">Esta OS ainda nao tem integrantes definidos.</span></div>}
          </div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancelar</button><button className="btn btn-primary" disabled={submitting}>{submitting ? <LoadingSpinner small /> : 'Salvar chamada'}</button></div>
        </form>
      </div>
    </div>
  );
}

function Placeholder({ route }) {
  const def = routes[route] || routes.dashboard;
  return <><PageHead title={def.title} subtitle="Módulo estruturado dentro do app. A próxima etapa é ligar as regras específicas desse fluxo." /><div className="panel"><div className="panel-body">Este módulo já está dentro do sistema React. Os cadastros principais e a operação diária estão conectados ao backend.</div></div></>;
}

function ActionPanel({ type, setRoute, onClose }) {
  const [q, setQ] = useState('');
  const [notifications, setNotifications] = useState([]);
  const user = currentUser();
  const dismissedKey = `sfTorresDismissedNotifications:${user.email || user.name || 'anon'}`;
  const environment = currentEnvironment();
  const routeEntries = Object.entries(routes).filter(([key, item]) => canUseRoute(key, user, environment) && normalize(item.title + item.group).includes(normalize(q)));
  const readDismissed = () => {
    try {
      return JSON.parse(localStorage.getItem(dismissedKey) || '[]');
    } catch {
      return [];
    }
  };
  const notificationId = (item) => item.id || `${item.workOrder}-${item.type}-${item.description}-${item.createdAt || item.updatedAt || ''}`;
  const dismissNotification = (id) => {
    const next = [...new Set([...readDismissed(), id])];
    localStorage.setItem(dismissedKey, JSON.stringify(next));
    setNotifications((old) => old.filter((item) => item.id !== id));
  };
  const clearNotifications = () => {
    const ids = notifications.map((item) => item.id);
    localStorage.setItem(dismissedKey, JSON.stringify([...new Set([...readDismissed(), ...ids])]));
    setNotifications([]);
  };
  useEffect(() => {
    if (type !== 'notifications') return;
    if (environment === 'talents') {
      setNotifications([]);
      return;
    }
    Promise.all([
      api('/api/occurrences').catch(() => ({ data: [] })),
      api(workOrdersEndpoint()).catch(() => ({ data: [] })),
      canApproveAttendance(user) ? api(`/api/leader-attendance/corrections?date=${encodeURIComponent(localDateValue(new Date()))}`).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
    ]).then(([occurrencePayload, orderPayload, correctionPayload]) => {
      const dismissed = new Set(readDismissed());
      const orders = listData(orderPayload);
      const isLeader = normalize(user.role).includes('lider');
      const belongsToUser = (occurrence) => {
        if (!isLeader) return true;
        const order = orders.find((item) => String(item.number) === String(occurrence.workOrder));
        if (!order) return false;
        const haystack = normalize(`${order.responsible} ${order.carrier}`);
        return haystack.includes(normalize(user.name)) || haystack.includes(normalize(user.email));
      };
      const occurrenceAlerts = listData(occurrencePayload)
        .filter((item) => !['resolvida', 'aprovada'].includes(normalize(item.status)))
        .filter(belongsToUser)
        .map((item) => {
          const pointOccurrence = item.attendanceDate && item.employeeName;
          return {
            id: notificationId(item),
            tag: item.type || 'OCO',
            title: pointOccurrence ? `Ocorrência de ponto: ${item.employeeName}` : `Ocorrência na OS ${item.workOrder || '-'}`,
            text: pointOccurrence ? `${date(item.attendanceDate)} · ${item.description || '-'} · ${item.status || 'Aberta'}` : `${item.description || '-'} · ${item.status || 'Aberta'}`
          };
        })
        .filter((item) => !dismissed.has(item.id));
      const attendanceAlerts = listData(correctionPayload)
        .map((item) => ({
          id: `attendance-correction-${item.date}-${item.name}-${item.requestedAt || ''}`,
          tag: 'CHAMADA',
          title: `Correção de chamada: ${item.name}`,
          text: `${item.requestedBy?.name || 'Líder'} solicitou liberação · ${date(item.date)}${item.reason ? ` · ${item.reason}` : ''}`
        }))
        .filter((item) => !dismissed.has(item.id));
      setNotifications([...attendanceAlerts, ...occurrenceAlerts].slice(0, 50));
    });
  }, [type, dismissedKey]);
  const openRoute = (key) => {
    window.location.hash = `#/${key}`;
    setRoute(key);
    onClose();
  };
  const content = {
    search: <>
      <div className="form-field"><label>Pesquisar módulo</label><input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Digite cliente, OS, usuário, relatório..." /></div>
      <div className="section-list compact-list">{routeEntries.map(([key, item]) => <div className="section-card" key={key} onClick={() => openRoute(key)}><div className="ico"><Icon name="grid" /></div><div><h4>{item.title}</h4><p>{item.group}</p></div></div>)}</div>
    </>,
    notifications: <><div className="notification-tools"><span className="soft">{notifications.length} notificação(ões)</span>{notifications.length > 0 && <button className="btn btn-sm" onClick={clearNotifications}>Limpar minhas notificações</button>}</div><ul className="activity">{notifications.length ? notifications.map((item) => <li key={item.id}><Pill value={item.tag} /><div><b>{item.title}</b><span>{item.text}</span></div><button className="btn btn-sm" onClick={() => dismissNotification(item.id)}>Excluir</button></li>) : <li><Pill value="OK" /><div><b>Nenhuma notificação pendente</b><span>Solicitações de correção e ocorrências aparecerão aqui.</span></div></li>}</ul></>,
    messages: <ul className="activity"><li><Pill value="Torre" /><div><b>Equipe de campo solicitou correção</b><span>Abra Operação Diária para tratar ocorrência.</span></div></li><li><Pill value="Financeiro" /><div><b>Relatório mensal disponível</b><span>Gere CSV em Relatórios.</span></div></li></ul>,
    help: <div className="panel-body"><p><b>Fluxos principais:</b></p><p className="soft">Cadastros gravam no banco. Configurações aplicam marca/cores e salvam no Postgres. Relatórios exportam CSV. Operação diária cria OS e registra ocorrências.</p><p className="soft">Use o menu lateral ou a pesquisa para trocar de tela sem recarregar.</p></div>
  };
  const titles = { search: 'Pesquisa', notifications: 'Notificações', messages: 'Mensagens', help: 'Ajuda' };
  return (
    <div className="modal-backdrop">
      <div className="modal action-modal">
        <div className="modal-head"><h3>{titles[type]}</h3><button className="btn btn-sm" onClick={onClose}>Fechar</button></div>
        <div className="modal-body">{content[type]}</div>
      </div>
    </div>
  );
}

function Toolbar({ fields, count, values = {}, onChange }) {
  return <div className="toolbar">{fields.map(([label, value, type]) => <div className="filter" key={label}><label>{label}</label>{type === 'select' ? <select value={values[label] || value[0]} onChange={(event) => onChange?.((old) => ({ ...old, [label]: event.target.value }))}>{value.map((option) => <option key={option}>{option}</option>)}</select> : <input type="text" value={values[label] || ''} onChange={(event) => onChange?.((old) => ({ ...old, [label]: event.target.value }))} placeholder={value} />}</div>)}<span className="spacer" /><span className="soft">{count} registros</span></div>;
}

function Panel({ title, actions, children, padded = false, className = '' }) {
  return <div className={`panel ${className}`.trim()}><div className="panel-head"><h3>{title}</h3>{actions && <div className="actions">{actions}</div>}</div><div className={`panel-body ${padded ? '' : 'table-panel-body'}`}>{children}</div></div>;
}

function DataTable({ columns, rows, loading = false }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return <table className="dtbl"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{loading ? <LoadingCell colSpan={columns.length} /> : safeRows.map((row, index) => <tr key={index}>{(Array.isArray(row) ? row : [row]).map((cell, cellIndex) => <td key={cellIndex}>{displayValue(cell)}</td>)}</tr>)}</tbody></table>;
}

function ActivityPanel() {
  const items = [
    ['OS', 'OS 0007-159 aprovada por Administrador SF', 'há 18 min · Operação Diária'],
    ['EQ', 'Equipamento HAMU2997067 vinculado à OS', 'há 1h · Cadastros'],
    ['PD', 'Programação semanal de equipes publicada', 'há 6h · Programação']
  ];
  return <Panel title="Atividades recentes" actions={<span className="soft">Últimas 24h</span>}><ul className="activity">{items.map(([tag, text, time]) => <li key={text}><Pill value={tag} /><div><b>{text}</b><span>{time}</span></div></li>)}</ul></Panel>;
}

function InfoPanel({ title, value, sub, children }) {
  return <div className="panel"><div className="panel-head"><h3>{title}</h3></div><div className="panel-body"><div className="big-number">{value}</div><div className="soft">{sub}</div><div className="inline-pills">{children}</div></div></div>;
}

function Field({ label, value, type = 'text', full, onChange }) {
  if (String(value).includes('&#10;')) {
    return <div className={`form-field ${full ? 'full' : ''}`}><label>{label}</label><textarea value={value.replaceAll('&#10;', '\n')} onChange={(e) => onChange?.(e.target.value)} /></div>;
  }
  return <div className={`form-field ${full ? 'full' : ''}`}><label>{label}</label><input type={type} value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={!onChange} /></div>;
}

function LogoUpload({ title, name, desc, value, onChange, fallback }) {
  const inputRef = useRef(null);
  const chooseFile = () => inputRef.current?.click();
  const updateFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onChange(await fileToDataUrl(file));
  };
  return <div className="form-field"><label>{title}</label><div className="logo-upload"><div className="logo-preview">{value ? <img src={value} alt={title} /> : fallback}</div><div className="logo-copy"><b>{name}</b><span>{desc}</span></div><input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={updateFile} /><button type="button" className="btn btn-sm" onClick={chooseFile}>Trocar arquivo</button>{value && <button type="button" className="btn btn-sm" onClick={() => onChange('')}>Remover</button>}</div></div>;
}

function ColorToken({ label, value, onChange }) {
  return <label className="color-token"><span style={{ background: value }} />{label}: <input type="color" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Switch({ off = false, checked, onChange }) {
  const isChecked = checked ?? !off;
  return <label className="switch"><input type="checkbox" checked={isChecked} onChange={(event) => onChange?.(event.target.checked)} readOnly={!onChange} /><span className="slider" /></label>;
}

function SwitchField({ label, text, checked, onChange }) {
  return <div className="form-field"><label>{label}</label><div className="row"><Switch checked={checked} onChange={onChange} /> <span className="soft">{text}</span></div></div>;
}

function PageHead({ title, subtitle, action, ghostAction, ghostActions, onAction, onGhostAction }) {
  const ghosts = ghostActions || (ghostAction ? [ghostAction] : []);
  return <div className="page-head"><div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{(action || ghosts.length > 0) && <div className="head-actions">{ghosts.map((label) => <button key={label} className="btn btn-ghost" onClick={() => onGhostAction ? onGhostAction(label) : triggerAction(label)}>{label}</button>)}{action && <button className="btn btn-primary" onClick={onAction || (() => triggerAction(action))}>{action}</button>}</div>}</div>;
}

function Kpi({ icon = 'grid', label, value, delta, success, warning, danger }) {
  return <div className={`kpi ${success ? 'kpi-success' : ''} ${warning ? 'kpi-warning' : ''} ${danger ? 'kpi-danger' : ''}`}><div className="ico"><Icon name={icon} /></div><div><div className="label">{label}</div><div className="value">{value}</div><div className="delta">{delta}</div></div></div>;
}

function MetricCard({ icon = 'grid', label, value, sub, color = '#1B3A6B', progress = 0 }) {
  const width = Math.max(0, Math.min(Number(progress || 0), 100));
  return (
    <div className="metric-card" style={{ '--metric-color': color }}>
      <div className="metric-icon"><Icon name={icon} /></div>
      <div className="metric-copy">
        <span>{label}</span>
        <b>{value}</b>
        <small>{sub}</small>
      </div>
      <div className="metric-progress"><i style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function EmployeeCell({ item }) {
  return <div className="employee-cell"><UserAvatar profile={{ name: item.employee.name, photo: item.employee.photo }} className="mini-avatar" /><span>{item.employee.name}</span></div>;
}

function ProgressValue({ value }) {
  const width = Math.max(0, Math.min(Number(value || 0), 100));
  return <div className="progress-value"><div className="progress-line"><i style={{ width: `${width}%` }} /></div><b>{width}%</b></div>;
}

function DonutChart({ data = [], center, sub }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  let offset = 25;
  const colors = ['#08A86B', '#4466E8', '#F29A1F', '#E64D5E', '#2598B8'];
  return (
    <div className="chart-donut-wrap">
      <svg viewBox="0 0 160 160" className="chart-donut">
        <circle cx="80" cy="80" r="54" fill="none" stroke="#EDF2F8" strokeWidth="24" />
        {data.map((item, index) => {
          const dash = (Number(item.value || 0) / total) * 100;
          const circle = <circle key={item.label} cx="80" cy="80" r="54" fill="none" stroke={colors[index % colors.length]} strokeWidth="24" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} pathLength="100" />;
          offset -= dash;
          return circle;
        })}
        <text x="80" y="78" textAnchor="middle" className="donut-value">{center}</text>
        <text x="80" y="98" textAnchor="middle" className="donut-sub">{sub}</text>
      </svg>
      <div className="chart-legend">{data.map((item, index) => <span key={item.label}><i style={{ background: colors[index % colors.length] }} />{item.label}: <b>{item.value}</b></span>)}</div>
    </div>
  );
}

function BarChart({ data = [], valueKey = 'value', labelKey = 'label', format = (value) => value }) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] || 0)), 1);
  return (
    <div className="bar-chart">
      {data.map((item) => {
        const value = Number(item[valueKey] || 0);
        return <div className="bar-row" key={item[labelKey]}><span>{item[labelKey]}</span><div className="bar-track"><i style={{ width: `${Math.max((value / max) * 100, value > 0 ? 5 : 0)}%` }} /></div><b>{format(value)}</b></div>;
      })}
      {!data.length && <div className="empty-chart">Sem dados no periodo</div>}
    </div>
  );
}

function RankingBars({ data = [] }) {
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="ranking-bars">
      {data.map((item) => {
        const width = Math.max((Number(item.value || 0) / max) * 100, item.value > 0 ? 5 : 0);
        return (
          <div className="ranking-row" key={item.employee.name}>
            <span className="rank-number">{item.index}</span>
            <EmployeeCell item={item} />
            <div className="rank-track"><i style={{ width: `${width}%` }} /></div>
            <b>{item.value} ({item.percent}%)</b>
          </div>
        );
      })}
      {!data.length && <div className="empty-chart">Sem dados no periodo</div>}
    </div>
  );
}

function ColumnChart({ data = [] }) {
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  return (
    <div className="column-chart">
      <svg viewBox="0 0 420 180" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((item) => <path key={item} d={`M24 ${150 - item * 38} H408`} />)}
        {data.map((item, index) => {
          const barWidth = Math.max(4, 340 / Math.max(data.length, 1) - 3);
          const x = 42 + index * (340 / Math.max(data.length, 1));
          const height = Math.max((Number(item.value || 0) / max) * 116, item.value > 0 ? 4 : 1);
          return <rect key={item.label} x={x} y={150 - height} width={barWidth} height={height} rx="2" />;
        })}
        {data.filter((_, index) => index % Math.max(Math.ceil(data.length / 6), 1) === 0 || index === data.length - 1).map((item, index, labels) => {
          const originalIndex = data.findIndex((entry) => entry.label === item.label);
          const x = 42 + originalIndex * (340 / Math.max(data.length, 1));
          return <text key={`${item.label}-${index}`} x={x} y="170" textAnchor={index === labels.length - 1 ? 'end' : 'middle'}>{item.label}</text>;
        })}
      </svg>
    </div>
  );
}

function TrendChart({ data = [] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => {
    const x = data.length <= 1 ? 20 : 20 + (index * 280) / (data.length - 1);
    const y = 120 - (item.value / max) * 86;
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="trend-chart">
      <svg viewBox="0 0 320 140">
        <path d="M20 120 H300" />
        <path d="M20 32 V120" />
        <polyline points={points} />
        {data.map((item, index) => {
          const x = data.length <= 1 ? 20 : 20 + (index * 280) / (data.length - 1);
          const y = 120 - (item.value / max) * 86;
          return <g key={item.label}><circle cx={x} cy={y} r="4" /><text x={x} y="136" textAnchor="middle">{item.label}</text></g>;
        })}
      </svg>
    </div>
  );
}

function Icon({ name }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
    message: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
    help: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
    star: <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />,
    pulse: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    check: <path d="M20 6L9 17l-5-5" />,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    chart: <><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 6-6" /></>,
    home: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ,
    building: <><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    refresh: <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
    money: <><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" /></>,
    box: <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />,
    monitor: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></>
  };
  return <svg {...common}>{icons[name] || icons.grid}</svg>;
}

function LogoST({ src }) {
  if (src) return <img src={src} alt="Logo ST" className="custom-logo custom-logo-st" />;
  return <svg viewBox="0 0 56 56" width="28" height="28"><circle cx="28" cy="14" r="8" fill="#0F2447" /><path d="M14 38 Q28 22 42 38 L37 46 Q28 36 19 46 Z" fill="#0F2447" /><text x="14" y="44" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="800" fontSize="18" fill="#FFFFFF">ST</text></svg>;
}

function LogoSM({ small = false, src }) {
  if (src) return <img src={src} alt="Logo SM" className={`custom-logo ${small ? 'custom-logo-sm-small' : 'custom-logo-sm'}`} />;
  return <svg viewBox="0 0 260 130" width={small ? 120 : 220} height={small ? 60 : 110}><path d="M40 95 Q130 5 230 80" stroke="#C8102E" strokeWidth="6" fill="none" /><path d="M40 110 Q130 30 230 100" stroke="#1A2E6D" strokeWidth="6" fill="none" /><text x="48" y="90" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="900" fontSize="86" fill="#1A2E6D" stroke="#FFFFFF" strokeWidth="2">SM</text><text x="58" y="118" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="900" fontSize="30" fill="#C8102E">TORRES</text></svg>;
}

createRoot(document.getElementById('root')).render(<App />);
