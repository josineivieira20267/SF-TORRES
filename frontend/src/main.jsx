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
  settings: { title: 'Configurações', group: 'Administração' }
};

const routeKeys = Object.keys(routes);
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

function canEdit(route, user = currentUser()) {
  return permissionFor(route, user) === 'edit';
}

function defaultUserPermissions(role = 'Operacional') {
  if (role === 'Administrador') return { ...defaultAdminPermissions };
  if (normalize(role).includes('lider')) return { schedules: 'edit', leaderAttendance: 'edit' };
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
      ['monthRevenue', 'Faturado no mês', 'number'], ['status', 'Status', 'select', ['Ativo', 'Inativo']]
    ]
  },
  employees: {
    title: 'Funcionários',
    subtitle: 'Cadastro de colaboradores, funções, documentos e vínculo com equipes.',
    endpoint: '/api/employees',
    newLabel: 'Novo funcionário',
    ghostLabel: 'Importar CSV',
    panelTitle: 'Funcionários',
    toolbar: [
      ['Buscar', 'Nome, CPF, função...', 'input'],
      ['Função', ['Todas', 'Auxiliar', 'Líder'], 'select'],
      ['Equipe', ['Todas', 'Equipe PA', 'Conferente', 'Apoio', 'Batedor'], 'select'],
      ['Status', ['Todos', 'Ativo', 'Férias', 'Afastado'], 'select']
    ],
    columns: [
      { label: '#', key: 'code', mono: true }, { label: 'Nome', key: 'name' }, { label: 'CPF', key: 'cpf', mono: true },
      { label: 'Função', key: 'role' }, { label: 'Equipe', key: 'team' },
      { label: 'Admissão', render: (i) => date(i.admissionDate) }, { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [
      ['code', 'Código', 'text', null, null, true],
      ['name', 'Nome', 'personName', null, null, true],
      ['cpf', 'CPF', 'cpf', null, null, true],
      ['role', 'Função', 'select', ['', 'Auxiliar', 'Líder'], null, true],
      ['team', 'Equipe', 'select', ['', 'Equipe PA', 'Conferente', 'Apoio', 'Batedor'], null, true],
      ['admissionDate', 'Admissão', 'date', null, null, true],
      ['status', 'Status', 'select', ['', 'Ativo', 'Férias', 'Afastado', 'Cadastro'], null, true]
    ],
    beforeSave: (data) => ({
      ...data,
      name: formatPersonName(data.name),
      cpf: formatCpf(data.cpf),
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
      { label: 'Unidade', key: 'unit' }, { label: 'Tarifa', render: (i) => money(i.price), right: true },
      { label: 'Categoria', key: 'category' }
    ],
    fields: [['code', 'Código'], ['description', 'Descrição'], ['unit', 'Unidade'], ['price', 'Tarifa', 'number'], ['category', 'Categoria']]
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
      { label: 'Capacidade', key: 'capacity' }, { label: 'Última manutenção', render: (i) => date(i.lastMaintenance) },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [['code', 'Código'], ['type', 'Tipo'], ['model', 'Marca / Modelo'], ['capacity', 'Capacidade'], ['lastMaintenance', 'Última manutenção', 'date'], ['status', 'Status', 'select', ['Disponível', 'Em uso', 'Manutenção']]]
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

function workOrdersEndpoint(month = currentMonthValue()) {
  const range = monthRange(month);
  return `/api/workOrders?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=500`;
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

function readStoredSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('sfTorresSettings') || '{}') };
  } catch {
    return defaultSettings;
  }
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
  localStorage.setItem('sfTorresSettings', JSON.stringify(settings));
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

function cleanRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '') || 'dailyOps';
  if (route === 'login') return 'login';
  if (!localStorage.getItem('sfTorresToken')) return 'login';
  if (!routes[route]) return firstAllowedRoute();
  return canView(route) ? route : firstAllowedRoute();
}

function firstAllowedRoute() {
  if (!localStorage.getItem('sfTorresToken')) return 'login';
  return firstAllowedRouteFor(currentUser());
}

function firstAllowedRouteFor(user) {
  return routeKeys.find((key) => canView(key, user)) || 'login';
}

function requestedRouteFromHash() {
  const route = String(window.location.hash || '').replace(/^#\/?/, '');
  return routes[route] ? route : '';
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
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('sfTorresToken')));
  const [route, setRoute] = useState(() => localStorage.getItem('sfTorresToken') ? cleanRoute(window.location.hash) : 'login');
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState(readStoredSettings);
  const [profile, setProfile] = useState(readStoredProfile);
  const [panel, setPanel] = useState(null);
  const [busyCount, setBusyCount] = useState(0);

  useEffect(() => {
    const onHash = () => {
      const hasToken = Boolean(localStorage.getItem('sfTorresToken'));
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
    api('/api/settings/company')
      .then((payload) => {
        if (payload.data) setSettings((old) => ({ ...old, ...payload.data }));
      })
      .catch(() => {});
  }, []);

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
    const nextRoute = requestedRoute && canView(requestedRoute, user) ? requestedRoute : firstAllowedRouteFor(user);
    window.history.replaceState(null, '', `#/${nextRoute}`);
    setRoute(nextRoute);
  };

  if (route === 'login' || !authenticated) {
    return <Login settings={settings} onLogin={goAfterLogin} />;
  }

  return (
    <div className={`app app-route-${route}`}>
      <Sidebar route={route} setRoute={setRoute} settings={settings} profile={profile} onProfile={() => setPanel('profile')} onLogout={goLogin} />
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
  const [message, setMessage] = useState('Acesso restrito a colaboradores autorizados. As ações são auditadas conforme LGPD.');
  const [loading, setLoading] = useState(false);
  const loginPrimaryLogo = stLogoTransparent;

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Validando credenciais...');
    try {
      const payload = await withBusy(() => fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error?.message || 'Falha no login');
        return data;
      }));
      localStorage.setItem('sfTorresToken', payload.data.token);
      localStorage.setItem('sfTorresUser', JSON.stringify(payload.data.user));
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
          <p className="subtitle">Use suas credenciais corporativas para entrar no ambiente operacional.</p>
          <form className="login-form" onSubmit={submit} autoComplete="off">
            <div className="form-field"><label>Usuário ou e-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
            <div className="form-field"><label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
            <div className="form-field"><label>Empresa / Filial</label><select><option>SF TORRES - Matriz Manaus/AM</option><option>ST Serviços de Logística - Filial</option></select></div>
            <div className="aux"><label className="row"><input type="checkbox" /> Manter conectado</label><a href="#/login">Esqueci minha senha</a></div>
            <button className="btn btn-primary" disabled={loading}>{loading ? <LoadingSpinner small /> : 'Entrar no sistema'}</button>
          </form>
          <div className="login-foot">{message}</div>
        </div>
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

function Sidebar({ route, setRoute, settings, profile, onProfile, onLogout }) {
  const groups = [
    ['Principal', [['dashboard', 'PR', 'Principal']]],
    ['Operações', [['tower', 'TO', 'Torre Operacional'], ['dailyOps', 'OD', 'Operação Diária'], ['schedules', 'PD', 'Programação de Equipes'], ['leaderAttendance', 'CP', 'Chamada de Ponto']]],
    ['Gestão', [['productivity', 'PD', 'Produtividade'], ['bonusCriteria', 'CB', 'Critérios de Bonificação'], ['employees', 'FE', 'Funcionários']]],
    ['Movimentações', [['reports', 'RP', 'Relatórios']]],
    ['Cadastros', [['clients', 'CL', 'Clientes'], ['services', 'SV', 'Serviços'], ['equipment', 'EQ', 'Equipamentos']]],
    ['Administração', [['users', 'AD', 'Usuários & Perfis'], ['settings', 'CF', 'Configurações']]]
  ];
  const user = currentUser();
  const go = (key) => {
    if (!canView(key, user)) return;
    window.location.hash = `#/${key}`;
    setRoute(key);
  };
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-emblem"><img src={stLogoTransparent} alt="SF Torres" /></div><div className="brand-text"><strong>{settings.fantasyName}</strong><span>Centro Operacional</span></div></div>
      <div className="search"><span>⌕</span><input placeholder="Buscar módulo, tela ou ação..." /></div>
      <nav className="nav">
        {groups.map(([title, items]) => {
          const visibleItems = items.filter(([key]) => canView(key, user));
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
        <Panel title="Evolucao das OS" actions={<select className="panel-select"><option>Diario</option><option>Semanal</option></select>} padded><TrendChart data={trendChart} /></Panel>
        <Panel title="Status das Operacoes" padded><DonutChart data={statusChart} center={totalOrders} sub="Total de OS" /></Panel>
        <Panel title="OS por dia" padded><ColumnChart data={dailyOrders} /></Panel>
      </div>
      <div className="dashboard-rank-grid">
        <Panel title="Ranking de colaboradores por finalizacoes" actions={<select className="panel-select"><option>Finalizadas</option><option>Presencas</option></select>} padded><RankingBars data={ranking} /></Panel>
        <Panel title="OS por cliente" actions={<select className="panel-select"><option>Todos</option><option>Top 5</option></select>} padded><BarChart data={clientChart} /></Panel>
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
  const rows = visible.map((order) => [order.number, order.client, order.location || '-', order.carrier || 'Sem equipe', dateTime(order.date), dateTime(order.operationStart), dateTime(order.operationEnd), <Pill value={order.status} />]);
  return <><PageHead title="Torre Operacional" subtitle="Painel em tempo real das operações em andamento e fila de execução." ghostAction="Tempo real" onGhostAction={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')} action="Atualizar" onAction={load} /><div className="toolbar"><div className="filter"><label>Período</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonthValue())} /></div><span className="spacer" /><span className="soft">Dados filtrados no banco pelo mês selecionado</span></div>{error ? <Panel title="Banco indisponível" padded actions={<button className="btn btn-sm btn-primary" onClick={load}>Tentar novamente</button>}><p className="soft">{error}</p></Panel> : <><div className="kpi-grid"><Kpi icon="pulse" label="Operações ativas" value={active} delta="em campo agora" /><Kpi icon="clock" label="Na fila" value={queue} delta="próximas 24h" warning /><Kpi icon="check" label="Concluídas" value={done} delta="ordens no sistema" success /><Kpi icon="alert" label="Alertas" value={alertCount} delta="atenção da torre" danger /></div><Panel title="Fila de execução" actions={<><button className="btn btn-sm" onClick={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')}>{statusFilter === 'Todos' ? 'Ver fila' : 'Ver todas'}</button><button className="btn btn-sm btn-primary" onClick={assignTeam}>Acionar equipe</button></>}><DataTable columns={['OS', 'Cliente', 'Local', 'Equipe', 'Data programada', 'Início', 'Término', 'Status']} rows={rows} loading={loading} /></Panel></>}</>;
}

function Schedules({ notify, editable = true }) {
  const user = currentUser();
  const [items, setItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: 'Todos' });
  const [operationModal, setOperationModal] = useState(null);
  const [occurrenceModal, setOccurrenceModal] = useState(null);
  const load = () => { setLoading(true); api(workOrdersEndpoint()).then((p) => setItems(listData(p))).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api('/api/employees').then((payload) => setEmployees(listData(payload))).catch(() => {});
    api('/api/equipment').then((payload) => setEquipment(listData(payload))).catch(() => {});
  }, []);
  const belongsToLeader = (order) => {
    if (user.role === 'Administrador') return true;
    const haystack = normalize(`${order.responsible} ${order.carrier}`);
    return haystack.includes(normalize(user.name)) || haystack.includes(normalize(user.email));
  };
  const visibleOrders = items.filter((item) => {
    const queryOk = normalize(`${item.number} ${item.client} ${item.service} ${item.equipment} ${item.location} ${item.responsible}`).includes(normalize(filters.q));
    const statusOk = filters.status === 'Todos' || normalize(item.status) === normalize(filters.status);
    return belongsToLeader(item) && queryOk && statusOk;
  });
  const updateOrder = async (order, patch, message) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await withBusy(() => api(`/api/workOrders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ...order, ...patch }) }));
    notify(message);
    setOperationModal(null);
    load();
  };
  const markStart = (order) => updateOrder(order, { operationStart: new Date().toLocaleString('pt-BR'), operationEnd: '', status: 'Em execucao', progress: Math.max(Number(order.progress || 0), 10) }, 'Inicio da operacao marcado');
  const markEnd = (order) => updateOrder(order, { operationEnd: new Date().toLocaleString('pt-BR'), status: 'Finalizado', progress: 100, correctionRequested: false, correctionApproved: false }, 'Fim da operacao marcado');
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
  const employeeOptions = employees.map((item) => item.name).filter(Boolean);
  const equipmentOptions = ['', ...Array.from(new Set(equipment.map((item) => item.type).filter(Boolean)))];
  const saveOperationEdit = (data) => {
    const required = [['carrier', 'Transportador'], ['location', 'Local'], ['equipment', 'Equipamento'], ['product', 'Produto'], ['progress', 'Percentual']];
    const missing = required.find(([name]) => String(data[name] ?? '').trim() === '');
    if (missing) return notify(`Preencha o campo obrigatorio: ${missing[1]}`);
    const before = Array.isArray(operationModal.teamMembers) ? operationModal.teamMembers : [];
    const after = Array.isArray(data.teamMembers) ? data.teamMembers : [];
    const changedTeam = before.length !== after.length || before.some((name) => !after.includes(name)) || after.some((name) => !before.includes(name));
    if (changedTeam && !String(data.teamNote || '').trim()) return notify('Informe a observacao/justificativa para alterar integrantes da equipe');
    return updateOrder(operationModal, { ...data, correctionRequested: false, correctionApproved: false }, 'Dados operacionais atualizados');
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
    return (
      <article className={`schedule-card ${active ? 'is-active' : ''}`} key={item.id || item.number}>
        <div className="schedule-card-top">
          <div>
            <span className="schedule-os">OS {item.number}</span>
            <h3>{item.client || '-'}</h3>
          </div>
          <Pill value={item.status} />
        </div>
        <div className="schedule-main-info">
          <div><span>Servico</span><b>{item.service || '-'}</b></div>
          <div><span>Produto</span><b>{item.product || '-'}</b></div>
          <div><span>Data</span><b>{dateTime(item.date)}</b></div>
          <div><span>Inicio</span><b>{item.operationStart || '-'}</b></div>
        </div>
        <div className="schedule-members">
          <span>Equipe</span>
          <p>{members.length ? members.join(', ') : 'Sem integrantes definidos'}</p>
        </div>
        {mobileActions(item)}
      </article>
    );
  };
  const rows = loading ? null : visibleOrders.map((item) => [<span className="mono">{item.number}</span>, item.client, item.service || '-', item.product || '-', Array.isArray(item.teamMembers) && item.teamMembers.length ? item.teamMembers.join(', ') : '-', <span className="soft">{dateTime(item.date)}</span>, <Pill value={item.status} />, <span className="soft">{item.operationStart || '-'}</span>, <span className="soft">{item.operationEnd || '-'}</span>, leaderActions(item)]);
  return (
    <>
      <PageHead title="Programação de Equipes" subtitle="Fila de OS criadas pela administração para o líder vincular e acompanhar pelo próprio usuário." ghostAction="Exportar OS" onGhostAction={exportRows} action="Atualizar" onAction={load} />
      <div className="schedule-mobile-head">
        <div>
          <span>{user.name || user.email || 'Líder'}</span>
          <h2>Minhas OS</h2>
        </div>
        <button className="btn btn-primary" onClick={load}>Atualizar</button>
      </div>
      <div className="toolbar schedule-toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Programado</option><option>Em execucao</option><option>Finalizado</option><option>Cancelado</option></select></div>
        <span className="spacer" /><span className="soft">{visibleOrders.length} OS para este usuario</span>
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
      <div className="schedule-table-panel"><Panel title="OS direcionadas ao lider" actions={<Pill value={user.name || user.email || 'usuario'} />}><DataTable columns={['OS', 'Cliente', 'Servico', 'Produto', 'Integrantes', 'Data programada', 'Status', 'Inicio', 'Fim', 'Acao']} rows={rows} loading={loading} /></Panel></div>
      {operationModal && <Editor title="Editar operacao da OS" fields={[['carrier', 'Transportador', 'text', null, null, true], ['location', 'Local', 'text', null, null, true], ['product', 'Produto', 'text', null, null, true], ['equipment', 'Equipamento', 'select', equipmentOptions, null, true], ['containerNumber', 'Número do container', 'text', null, (form) => normalize(form.equipment).includes('container')], ['trailerPlate', 'Placa da carreta', 'text', null, (form) => normalize(form.equipment).includes('carreta')], ['teamMembers', 'Incluir integrantes da equipe', 'employees', employeeOptions, () => absenceCount(operationModal) > 0], ['teamNote', 'Observacao obrigatoria ao alterar equipe', 'textarea', null, () => absenceCount(operationModal) > 0], ['progress', 'Percentual', 'number', null, null, true]]} initial={operationModal} onCancel={() => setOperationModal(null)} onSave={saveOperationEdit} />}
      {occurrenceModal && <Editor title={`Lançar ocorrência · OS ${occurrenceModal.number}`} fields={occurrenceFields} initial={{ workOrder: occurrenceModal.number, type: 'Operacional', status: 'Aberta' }} onCancel={() => setOccurrenceModal(null)} onSave={saveLeaderOccurrence} />}
    </>
  );
}

function LeaderAttendance({ notify, editable = true }) {
  const user = currentUser();
  const [dateValue, setDateValue] = useState(localDateValue(new Date()));
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = (date = dateValue) => {
    setLoading(true);
    api(`/api/leader-attendance?date=${encodeURIComponent(date)}`)
      .then((response) => setPayload(response.data))
      .catch((error) => { setPayload(null); notify(error.message); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(dateValue); }, [dateValue]);
  const employees = payload?.employees || [];
  const summary = employees.reduce((acc, item) => {
    const status = normalize(item.status || 'Pendente');
    acc.total += 1;
    if (status === 'presente') acc.present += 1;
    else if (status === 'falta') acc.absences += 1;
    else acc.pending += 1;
    return acc;
  }, { total: 0, present: 0, absences: 0, pending: 0 });
  const updateEmployee = (name, patch) => setPayload((old) => ({
    ...old,
    employees: (old?.employees || []).map((item) => item.name === name ? { ...item, ...patch } : item)
  }));
  const markAllPresent = () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    setPayload((old) => ({
      ...old,
      employees: (old?.employees || []).map((item) => ({ ...item, status: 'Presente' }))
    }));
  };
  const save = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const attendance = Object.fromEntries(employees.map((item) => [item.name, { status: item.status || 'Pendente', note: item.note || '' }]));
    const response = await withBusy(() => api('/api/leader-attendance', { method: 'PUT', body: JSON.stringify({ date: dateValue, attendance }) }));
    setPayload(response.data);
    notify('Chamada de ponto salva');
  };
  const rows = loading ? null : employees.map((item) => [
    <b>{item.name}</b>,
    item.role || '-',
    item.team || '-',
    <select value={item.status || 'Pendente'} onChange={(event) => updateEmployee(item.name, { status: event.target.value })} disabled={!editable}><option>Pendente</option><option>Presente</option><option>Falta</option></select>,
    <input value={item.note || ''} onChange={(event) => updateEmployee(item.name, { note: event.target.value })} placeholder="Observação" disabled={!editable} />
  ]);
  return (
    <>
      <PageHead title="Chamada de Ponto" subtitle="Registro diário de presença dos colaboradores, separado das ordens de serviço." ghostAction="Marcar todos presentes" onGhostAction={markAllPresent} action="Salvar chamada" onAction={save} />
      <div className="toolbar">
        <div className="filter"><label>Data</label><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value || localDateValue(new Date()))} /></div>
        <span className="spacer" />
        <span className="soft">{user.name || user.email || 'Lider'}</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="users" label="Colaboradores" value={summary.total} delta="lista carregada do banco" />
        <Kpi icon="check" label="Presentes" value={summary.present} delta="confirmados na chamada" success />
        <Kpi icon="alert" label="Faltas" value={summary.absences} delta="registradas no dia" warning />
        <Kpi icon="clock" label="Pendentes" value={summary.pending} delta="aguardando marcação" />
      </div>
      <Panel title="Presença dos colaboradores" actions={<Pill value={date(dateValue)} />} padded>
        <DataTable columns={['Colaborador', 'Função', 'Equipe', 'Presença', 'Observação']} rows={rows} loading={loading} />
        {!loading && !employees.length && <div className="empty-chart">Nenhum colaborador ativo encontrado.</div>}
      </Panel>
    </>
  );
}

function Productivity() {
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [productivityRules, setProductivityRules] = useState(defaultProductivityRules);
  const [compare, setCompare] = useState(false);
  const [showOsLaunches, setShowOsLaunches] = useState(false);
  const [filters, setFilters] = useState({ q: '', employee: 'Todos', criterion: 'Todos', status: 'Todos' });
  useEffect(() => {
    api(workOrdersEndpoint()).then((payload) => setOrders(listData(payload))).catch((error) => triggerAction(error.message));
    api('/api/employees').then((payload) => setEmployees(listData(payload))).catch((error) => triggerAction(error.message));
    api('/api/settings/productivityRules').then((payload) => setProductivityRules(mergeProductivityRules(payload.data))).catch(() => {});
  }, []);
  const employeeByName = Object.fromEntries(employees.map((item) => [normalize(item.name), item]));
  const criterionFor = (employee) => bonusCriterionFor(employee, productivityRules);
  const discountFor = (absences) => absences <= 0 ? 1 : absences === 1 ? 0.75 : absences === 2 ? 0.5 : absences === 3 ? 0.25 : 0;
  const ruleRow = (rule) => [rule.name, money(rule.base), money(rule.base * 0.75), money(rule.base * 0.5), money(rule.base * 0.25), money(0)];
  const memberEntries = orders.flatMap((order) => {
    const members = Array.isArray(order.teamMembers) ? order.teamMembers : Object.keys(order.attendance || {});
    return members.map((name) => {
      const attendance = order.attendance?.[name];
      const status = attendance ? (typeof attendance === 'object' ? attendance.status : attendance) : 'Pendente';
      return { order, name, status };
    });
  });
  const employeeOptions = ['Todos', ...Array.from(new Set(memberEntries.map((entry) => entry.name).filter(Boolean))).sort((a, b) => a.localeCompare(b))];
  const filteredEntries = memberEntries.filter((entry) => {
    const employee = employeeByName[normalize(entry.name)] || { name: entry.name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = michelinShare !== null ? { key: 'michelin', name: 'MICHELIN', base: michelinShare, mode: 'per-os', match: 'michelin' } : criterionFor(employee);
    const text = normalize(`${entry.order.number} ${entry.order.client} ${entry.order.service} ${entry.order.date} ${entry.name} ${employee.team} ${employee.role}`);
    const queryOk = !filters.q || text.includes(normalize(filters.q));
    const employeeOk = filters.employee === 'Todos' || entry.name === filters.employee;
    const criterionOk = filters.criterion === 'Todos' || criterion.name === filters.criterion;
    const statusOk = filters.status === 'Todos' || normalize(entry.status) === normalize(filters.status);
    return queryOk && employeeOk && criterionOk && statusOk;
  });
  const byEmployee = Object.values(filteredEntries.reduce((acc, entry) => {
    const key = normalize(entry.name);
    const employee = employeeByName[key] || { name: entry.name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(entry.order, entry.name, employeeByName, productivityRules);
    const criterion = criterionFor(employee);
    acc[key] = acc[key] || { employee, criterion, os: 0, present: 0, standardPresent: 0, absences: 0, pending: 0, customBonus: 0 };
    acc[key].os += 1;
    const status = normalize(entry.status);
    if (status === 'falta') acc[key].absences += 1;
    else if (status === 'pendente') acc[key].pending += 1;
    else {
      acc[key].present += 1;
      if (michelinShare !== null) acc[key].customBonus += michelinShare;
      else acc[key].standardPresent += 1;
    }
    return acc;
  }, {})).sort((a, b) => a.employee.name.localeCompare(b.employee.name));
  const productivityRows = byEmployee.map((item) => {
    const factor = discountFor(item.absences);
    const adjustedValue = item.criterion.base * factor;
    const total = productivityTotalFor(item);
    const criterionName = item.customBonus ? `${item.criterion.name} + MICHELIN` : item.criterion.name;
    return [item.employee.name, item.employee.role || '-', item.employee.team || '-', criterionName, item.os, item.present, item.absences, money(adjustedValue), `${Math.round(factor * 100)}%`, money(total)];
  });
  const osRows = filteredEntries.map(({ order, name, status }) => {
    const employee = employeeByName[normalize(name)] || { name, role: '-', team: '-' };
    const michelinShare = michelinShareForEntry(order, name, employeeByName, productivityRules);
    const criterion = michelinShare !== null ? { key: 'michelin', name: 'MICHELIN', base: michelinShare, mode: 'per-os', match: 'michelin' } : criterionFor(employee);
    const employeeSummary = byEmployee.find((item) => normalize(item.employee.name) === normalize(name));
    const payable = normalize(status) === 'falta' || normalize(status) === 'pendente' || criterion.mode === 'monthly' ? 0 : (michelinShare ?? (criterion.base * discountFor(employeeSummary?.absences || 0)));
    return [order.number, dateTime(order.date), order.client, name, employee.team || '-', criterion.name, <Pill value={status} />, money(payable)];
  });
  const totalAbsences = byEmployee.reduce((sum, item) => sum + item.absences, 0);
  const pendingCalls = byEmployee.reduce((sum, item) => sum + item.pending, 0);
  const totalBonus = byEmployee.reduce((sum, item) => sum + productivityTotalFor(item), 0);
  const exportRows = [['Colaborador', 'Função', 'Equipe cadastro', 'Critério', 'OS', 'Presenças', 'Faltas', 'Valor base', 'Percentual', 'Total'], ...productivityRows.map((row) => row.map((cell) => displayText(cell)))];
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
  return <><PageHead title="Critérios de Bonificação" subtitle="Cadastro dos valores usados no cálculo de produtividade." action="Salvar critérios" onAction={save} /><Panel title="Critérios padrão" padded><DataTable columns={['Critério', 'Valor integral', 'Tipo', 'Palavras-chave de equipe/função']} rows={loading ? [] : standardRows} loading={loading} /></Panel><Panel title="Regra MICHELIN" padded><div className="form-grid"><SwitchField label="Ativar regra MICHELIN" text="Usar valores por faixa e veículo" checked={form.michelin.enabled} onChange={(value) => updateMichelin({ enabled: value })} /><Field label="Cliente" value={form.michelin.client} onChange={(value) => updateMichelin({ client: value })} /><Field label="Início faixa 1" type="time" value={form.michelin.commercialStart} onChange={(value) => updateMichelin({ commercialStart: value })} /><Field label="Fim faixa 1" type="time" value={form.michelin.commercialEnd} onChange={(value) => updateMichelin({ commercialEnd: value })} /><Field label="Container/Carreta faixa 1" type="number" value={form.michelin.commercialContainer} onChange={(value) => updateMichelin({ commercialContainer: Number(value || 0) })} /><Field label="Caminhão faixa 1" type="number" value={form.michelin.commercialTruck} onChange={(value) => updateMichelin({ commercialTruck: Number(value || 0) })} /><Field label="Início faixa 2" type="time" value={form.michelin.afterStart} onChange={(value) => updateMichelin({ afterStart: value })} /><Field label="Fim faixa 2" type="time" value={form.michelin.afterEnd} onChange={(value) => updateMichelin({ afterEnd: value })} /><Field label="Container/Carreta faixa 2" type="number" value={form.michelin.afterContainer} onChange={(value) => updateMichelin({ afterContainer: Number(value || 0) })} /><Field label="Caminhão faixa 2" type="number" value={form.michelin.afterTruck} onChange={(value) => updateMichelin({ afterTruck: Number(value || 0) })} /></div></Panel></>;
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
  return <CrudScreen config={{
    title: 'Usuários & Perfis',
    subtitle: 'Gestão de usuários do sistema, perfis de acesso e permissões por módulo.',
    endpoint: '/api/users',
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
    fields: [['name', 'Nome'], ['email', 'E-mail'], ['password', 'Senha'], ['role', 'Perfil', 'select', ['Administrador', 'Líder', 'Operacional', 'Financeiro']], ['status', 'Status', 'select', ['Ativo', 'Inativo']], ['permissions', 'Permissões por tela', 'permissions']]
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
    await withBusy(() => api('/api/settings/company', { method: 'PUT', body: JSON.stringify(form) }));
    setSettings(form);
    notify('Configurações salvas no banco');
  };
  const restoreDefaults = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar configuracoes');
    setForm(defaultSettings);
    setSettings(defaultSettings);
    await withBusy(() => api('/api/settings/company', { method: 'PUT', body: JSON.stringify(defaultSettings) }));
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
  const [employees, setEmployees] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(null);
  const [occurrenceModal, setOccurrenceModal] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dados');
  const [filters, setFilters] = useState({ q: '', status: 'Todos', client: 'Todos', period: 'Este mês', table: '' });
  const optionValues = (list, ...keys) => list.map((item) => keys.map((key) => item[key]).find(Boolean)).filter(Boolean);
  const equipmentTypes = ['', ...Array.from(new Set(equipment.map((item) => item.type).filter(Boolean)))];
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
    ['location', 'Local'],
    ['responsible', 'Responsável', 'select', ['', ...optionValues(leaders, 'name')], null, true],
    ['teamMembers', 'Integrantes da equipe', 'employees', optionValues(employees, 'name'), null, true],
    ['product', 'Produto'],
    ['operationStart', 'Início da operação', 'datetime-local'],
    ['operationEnd', 'Fim da operação', 'datetime-local'],
    ['progress', 'Percentual', 'number']
  ];
  const clientOptions = ['Todos', ...Array.from(new Set(items.map((item) => item.client).filter(Boolean)))];
  const matchesPeriod = (item) => {
    const raw = String(item.date || '').slice(0, 10);
    if (!raw || filters.period === 'Personalizado') return true;
    const itemDate = new Date(`${raw}T00:00:00`);
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (filters.period === 'Hoje') return itemDate.toDateString() === start.toDateString();
    if (filters.period === 'Esta semana') {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() - start.getDay());
      return itemDate >= weekStart;
    }
    return itemDate.getMonth() === today.getMonth() && itemDate.getFullYear() === today.getFullYear();
  };
  const filteredItems = items.filter((item) => {
    const text = normalize(`${item.number} ${item.client} ${item.equipment} ${item.service} ${item.carrier} ${item.location}`);
    const query = normalize(`${filters.q} ${filters.table}`);
    const statusOk = filters.status === 'Todos' || normalize(item.status) === normalize(filters.status);
    const clientOk = filters.client === 'Todos' || item.client === filters.client;
    return text.includes(query.trim()) && statusOk && clientOk && matchesPeriod(item);
  });
  const selected = filteredItems.find((i) => i.id === selectedId) || filteredItems[0];
  const counts = useMemo(() => filteredItems.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}), [filteredItems]);
  const load = () => { setLoading(true); api(workOrdersEndpoint()).then((p) => { const data = listData(p); setItems(data); setSelectedId((old) => old || data[0]?.id || ''); }).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  const loadOccurrences = () => api('/api/occurrences').then((p) => setOccurrences(listData(p))).catch(() => setOccurrences([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { loadOccurrences(); }, []);
  useEffect(() => {
    api('/api/clients').then((payload) => setClients(listData(payload))).catch(() => {});
    api('/api/equipment').then((payload) => setEquipment(listData(payload))).catch(() => {});
    api('/api/services').then((payload) => setServices(listData(payload))).catch(() => {});
    api('/api/employees').then((payload) => {
      const list = listData(payload);
      setEmployees(list);
      setLeaders(list.filter((item) => normalize(item.role).includes('lider')));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (filteredItems.length && !filteredItems.some((item) => item.id === selectedId)) setSelectedId(filteredItems[0].id);
  }, [filters, items]);
  const save = async (data) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const user = currentUser();
    if (items.some((item) => item.id !== modal?.id && normalize(item.number) === normalize(data.number))) return notify('Ja existe uma OS com este numero');
    const payload = modal?.id ? data : { ...data, progress: data.progress || 0, createdBy: data.createdBy || user.name || user.email || 'Administrador SF' };
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
    return [['Data programada', dateTime(selected.date)], ['Criado por', selected.createdBy || '-'], ['Transportador', selected.carrier], ['Serviço', selected.service], ['Produto', selected.product || '-'], ['Equipamento', selected.equipment || '-'], ['Container', selected.containerNumber || '-'], ['Placa', selected.trailerPlate || '-'], ['Local', selected.location || '-'], ['Responsável', selected.responsible], ['Percentual', `${selected.progress || 0}%`]];
  };
  return (
    <>
      <PageHead title="Operação Diária" subtitle="Gestão detalhada das OS com filtros, confirmação de equipe, horários e ocorrências." ghostActions={['Histórico', 'Exportar planilha']} onGhostAction={(label) => label === 'Histórico' ? setHistoryOpen(true) : exportFiltered()} action="Nova OS" onAction={() => setModal({ status: 'Programado', progress: 0 })} />
      <div className="toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Programado</option><option>Em execucao</option><option>Finalizado</option><option>Cancelado</option></select></div>
        <div className="filter"><label>Cliente</label><select value={filters.client} onChange={(event) => setFilters((old) => ({ ...old, client: event.target.value }))}>{clientOptions.map((client) => <option key={client}>{client}</option>)}</select></div>
        <div className="filter"><label>Período</label><select value={filters.period} onChange={(event) => setFilters((old) => ({ ...old, period: event.target.value }))}><option>Hoje</option><option>Esta semana</option><option>Este mês</option><option>Personalizado</option></select></div>
        <span className="spacer" />
        <span className="soft">{filteredItems.length} resultados</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="check" label="Programadas" value={counts.Programado || 0} delta="prontas para execução" success />
        <Kpi icon="clock" label="Finalizadas" value={counts.Finalizado || 0} delta="operações concluídas" warning />
        <Kpi icon="home" label="Em execução" value={counts['Em execucao'] || 0} delta="campo" />
        <Kpi icon="alert" label="Ocorrências" value="02" delta="em análise" danger />
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
  const [modal, setModal] = useState(null);
  const load = () => {
    const separator = config.endpoint.includes('?') ? '&' : '?';
    setLoading(true);
    api(`${config.endpoint}${q ? `${separator}q=${encodeURIComponent(q)}` : ''}`).then((p) => setItems(listData(p))).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [q, config.endpoint]);
  const fieldMap = { Função: 'role', Equipe: 'team', Status: 'status', Tipo: 'type' };
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
  const remove = async (item) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!confirm('Apagar este registro?')) return;
    await withBusy(() => api(`${config.endpoint}/${item.id}`, { method: 'DELETE' }));
    notify('Registro apagado'); load();
  };
  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} ghostAction={config.ghostLabel} action={editable ? config.newLabel : null} onAction={() => setModal({})} />
      {config.toolbar && <Toolbar fields={config.toolbar} count={displayItems.length} values={toolbarFilters} onChange={setToolbarFilters} />}
      {!config.noToolbar && !config.toolbar && <div className="toolbar"><div className="filter"><label>Buscar</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." /></div><span className="spacer" /><span className="soft">{displayItems.length} registros</span></div>}
      {beforeTable}
      <div className="panel" style={{ overflow: 'hidden' }}><div className="panel-head"><h3>{panelTitle(config, displayItems.length)}</h3>{config.panelActions && <div className="actions">{typeof config.panelActions === 'function' ? config.panelActions({ items: displayItems, load }) : config.panelActions}</div>}</div><div className="panel-body" style={{ padding: 0 }}><table className="dtbl"><thead><tr>{config.columns.map((c) => <th key={c.label} className={c.right ? 'right' : ''}>{c.label}</th>)}<th /></tr></thead><tbody>{loading ? <LoadingCell colSpan={config.columns.length + 1} /> : displayItems.map((item) => <tr key={item.id}>{config.columns.map((c) => <td key={c.label} className={`${c.mono ? 'mono' : ''} ${c.right ? 'right' : ''}`}>{c.render ? c.render(item) : item[c.key]}</td>)}<td className="right">{editable ? <><button className="btn btn-sm" onClick={() => setModal(item)}>Editar</button> <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Apagar</button></> : <span className="soft">Somente leitura</span>}</td></tr>)}</tbody></table></div></div>
      {modal && <Editor title={modal.id ? `Editar ${config.title}` : config.newLabel} fields={config.fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}
    </>
  );
}

function panelTitle(config, count) {
  if (!config.panelTitle) return `${count} registros`;
  const first = config.panelTitle.charAt(0);
  return first === first.toLowerCase() ? `${count} ${config.panelTitle}` : config.panelTitle;
}

function Editor({ title, fields, initial, onCancel, onSave }) {
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([name, , type]) => [name, ['permissions', 'employees'].includes(type) ? (initial?.[name] || (type === 'permissions' ? defaultUserPermissions(initial?.role) : [])) : initial?.[name] ?? ''])));
  const [submitting, setSubmitting] = useState(false);
  const change = (name, value, type) => setForm((old) => {
    const formatted = type === 'number' ? Number(value || 0) : type === 'cpf' ? formatCpf(value) : type === 'personName' ? formatPersonNameInput(value) : value;
    const next = { ...old, [name]: formatted };
    if (name === 'equipment') {
      if (!normalize(value).includes('container')) next.containerNumber = '';
      if (!normalize(value).includes('carreta')) next.trailerPlate = '';
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
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="btn btn-sm" onClick={onCancel} disabled={submitting}>Fechar</button></div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-grid">{fields.map(([name, label, type = 'text', options, visible, required]) => {
            if (!isVisible(visible)) return null;
            if (type === 'permissions') return <PermissionMatrix key={name} label={label} value={form[name]} onChange={(value) => change(name, value, type)} />;
            if (type === 'employees') return <EmployeePicker key={name} label={`${label}${isRequired(required) ? ' *' : ''}`} options={options || []} value={form[name]} onChange={(value) => change(name, value, type)} />;
            return <div className="form-field" key={name}><label>{label}{isRequired(required) ? ' *' : ''}</label>{type === 'select' ? <select value={form[name]} required={isRequired(required)} onChange={(e) => change(name, e.target.value, type)}>{options.map((o) => <option key={o || '-'} value={o}>{o || '-'}</option>)}</select> : type === 'textarea' ? <textarea value={form[name]} required={isRequired(required)} onChange={(e) => change(name, e.target.value, type)} /> : <input type={['cpf', 'personName'].includes(type) ? 'text' : type} value={form[name]} required={isRequired(required)} maxLength={type === 'cpf' ? 14 : undefined} onChange={(e) => change(name, e.target.value, type)} />}</div>;
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

function EmployeePicker({ label, options = [], value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (name) => onChange(selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]);
  return (
    <div className="permissions-grid">
      <div className="permissions-head">{label}</div>
      <div className="employee-picker">
        {options.map((name) => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} /> {name}</label>)}
        {!options.length && <span className="soft">Cadastre funcionarios para montar a equipe.</span>}
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
  const routeEntries = Object.entries(routes).filter(([key, item]) => canView(key) && normalize(item.title + item.group).includes(normalize(q)));
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
    Promise.all([
      api('/api/occurrences').catch(() => ({ data: [] })),
      api(workOrdersEndpoint()).catch(() => ({ data: [] }))
    ]).then(([occurrencePayload, orderPayload]) => {
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
        .filter((item) => !normalize(item.status).includes('resolvida'))
        .filter(belongsToUser)
        .map((item) => ({ id: notificationId(item), tag: item.type || 'OCO', title: `Ocorrência na OS ${item.workOrder || '-'}`, text: `${item.description || '-'} · ${item.status || 'Aberta'}` }))
        .filter((item) => !dismissed.has(item.id));
      setNotifications(occurrenceAlerts.slice(0, 50));
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
    notifications: <><div className="notification-tools"><span className="soft">{notifications.length} ocorrência(s)</span>{notifications.length > 0 && <button className="btn btn-sm" onClick={clearNotifications}>Limpar minhas notificações</button>}</div><ul className="activity">{notifications.length ? notifications.map((item) => <li key={item.id}><Pill value={item.tag} /><div><b>{item.title}</b><span>{item.text}</span></div><button className="btn btn-sm" onClick={() => dismissNotification(item.id)}>Excluir</button></li>) : <li><Pill value="OK" /><div><b>Nenhuma ocorrência pendente</b><span>Somente ocorrências reais vinculadas ao seu usuário aparecerão aqui.</span></div></li>}</ul></>,
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

function Panel({ title, actions, children, padded = false }) {
  return <div className="panel"><div className="panel-head"><h3>{title}</h3>{actions && <div className="actions">{actions}</div>}</div><div className={`panel-body ${padded ? '' : 'table-panel-body'}`}>{children}</div></div>;
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
