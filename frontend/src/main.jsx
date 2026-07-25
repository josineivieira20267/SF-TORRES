import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './system.css';

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
  productivity: { title: 'Produtividade', group: 'Gestão' },
  employees: { title: 'Funcionários', group: 'Gestão' },
  map: { title: 'Mapa Operacional', group: 'Gestão' },
  measurement: { title: 'Medição & Faturamento', group: 'Movimentações' },
  reports: { title: 'Relatórios', group: 'Movimentações' },
  clients: { title: 'Clientes', group: 'Cadastros' },
  services: { title: 'Serviços', group: 'Cadastros' },
  equipment: { title: 'Equipamentos', group: 'Cadastros' },
  locations: { title: 'Locações & Áreas', group: 'Cadastros' },
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
  if (normalize(role).includes('lider')) return { schedules: 'edit' };
  return { dashboard: 'view', dailyOps: 'view' };
}

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
      ['Função', ['Todas', 'Auxiliar', 'Líder de turno'], 'select'],
      ['Equipe', ['Todas', 'Conferente', 'Apoio', 'Batedor'], 'select'],
      ['Status', ['Todos', 'Ativo', 'Férias', 'Afastado'], 'select']
    ],
    columns: [
      { label: '#', key: 'code', mono: true }, { label: 'Nome', key: 'name' }, { label: 'CPF', key: 'cpf', mono: true },
      { label: 'Função', key: 'role' }, { label: 'Equipe', key: 'team' },
      { label: 'Admissão', render: (i) => date(i.admissionDate) }, { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [
      ['code', 'Código'], ['name', 'Nome'], ['cpf', 'CPF'], ['role', 'Função', 'select', ['Auxiliar', 'Líder de turno']], ['team', 'Equipe', 'select', ['Conferente', 'Apoio', 'Batedor']],
      ['admissionDate', 'Admissão', 'date'], ['status', 'Status', 'select', ['Ativo', 'Férias', 'Afastado', 'Cadastro']]
    ]
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
  },
  locations: {
    title: 'Locações & Áreas',
    subtitle: 'Cadastro de pátios, bases, portos e áreas operacionais vinculadas aos contratos.',
    endpoint: '/api/locations',
    newLabel: 'Nova locação',
    ghostLabel: 'Importar',
    panelTitle: 'Locações',
    noToolbar: true,
    columns: [
      { label: 'Código', key: 'code', mono: true }, { label: 'Descrição', key: 'description' }, { label: 'Cliente', key: 'client' },
      { label: 'Endereço', key: 'address' }, { label: 'Área (m²)', key: 'areaM2', right: true },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [['code', 'Código'], ['description', 'Descrição'], ['client', 'Cliente'], ['address', 'Endereço'], ['areaM2', 'Área m²', 'number'], ['status', 'Status', 'select', ['Operacional', 'Inativo', 'Manutenção']]]
  },
  measurement: {
    title: 'Medição & Faturamento',
    subtitle: 'Fechamento de medições por OS para composição de faturamento por cliente.',
    endpoint: '/api/measurements',
    newLabel: 'Nova medição',
    ghostLabel: 'Exportar NF',
    panelTitle: 'Medições do mês',
    columns: [
      { label: '#', key: 'number', mono: true }, { label: 'Cliente', key: 'client' }, { label: 'OS', key: 'workOrder', mono: true },
      { label: 'Período', key: 'period' }, { label: 'Qtd.', key: 'quantity', right: true },
      { label: 'Unitário', render: (i) => money(i.unitPrice), right: true }, { label: 'Total', render: (i) => money(i.total), right: true },
      { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [['number', 'Número'], ['client', 'Cliente'], ['workOrder', 'OS'], ['period', 'Período'], ['quantity', 'Quantidade', 'number'], ['unitPrice', 'Unitário', 'number'], ['total', 'Total', 'number'], ['status', 'Status', 'select', ['Fechada', 'Pendente', 'Cancelada']]]
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
      localStorage.clear();
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

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function triggerAction(label) {
  window.dispatchEvent(new CustomEvent('sf:action', { detail: label }));
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
  if (!routes[route]) return firstAllowedRoute();
  return canView(route) ? route : firstAllowedRoute();
}

function firstAllowedRoute() {
  return routeKeys.find((key) => canView(key)) || 'login';
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
    console.error(error);
    const recoverKey = `sf:recover:${this.props.resetKey}`;
    if (!sessionStorage.getItem(recoverKey)) {
      sessionStorage.setItem(recoverKey, '1');
      window.setTimeout(() => window.location.reload(), 250);
      return;
    }
    if (this.state.retries < 2) {
      window.setTimeout(() => {
        this.setState((state) => ({ error: null, retries: state.retries + 1 }));
      }, 250);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.state.retries < 2) {
      return (
        <div className="panel">
          <div className="panel-body">
            <h3>Abrindo tela...</h3>
            <p className="soft">Preparando o módulo automaticamente. Se a API estiver acordando, isso pode levar alguns segundos.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="panel">
        <div className="panel-body">
          <h3>Não foi possível abrir esta tela agora.</h3>
          <p className="soft">O sistema se recuperou do erro. Tente abrir o módulo novamente ou atualize a página.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Atualizar tela</button>
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

function App() {
  const [route, setRoute] = useState(() => localStorage.getItem('sfTorresToken') ? cleanRoute(window.location.hash) : 'login');
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState(readStoredSettings);
  const [panel, setPanel] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(cleanRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    applySystemSettings(settings);
    storeSettings(settings);
  }, [settings]);

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

  if (route === 'login' || !localStorage.getItem('sfTorresToken')) {
    return <Login settings={settings} />;
  }

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} settings={settings} />
      <Topbar route={route} settings={settings} openPanel={setPanel} />
      <main className="main">
        <div className="page">
          <ErrorBoundary resetKey={route}>
            <Screen route={route} notify={notify} settings={settings} setSettings={setSettings} />
          </ErrorBoundary>
        </div>
      </main>
      {panel && <ActionPanel type={panel} setRoute={setRoute} onClose={() => setPanel(null)} />}
      <div className={`sf-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function Login({ settings }) {
  const [email, setEmail] = useState('admin@sftorres.local');
  const [password, setPassword] = useState('admin123');
  const [message, setMessage] = useState('Acesso restrito a colaboradores autorizados. As ações são auditadas conforme LGPD.');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage('Validando credenciais...');
    try {
      const payload = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error?.message || 'Falha no login');
        return data;
      });
      localStorage.setItem('sfTorresToken', payload.data.token);
      localStorage.setItem('sfTorresUser', JSON.stringify(payload.data.user));
      window.location.hash = `#/${firstAllowedRoute()}`;
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="logo-area"><LogoSM src={settings.secondaryLogo} /></div>
        <div className="copy">
          <h2>Centro Operacional<br />{settings.fantasyName}</h2>
          <p>Plataforma corporativa de gestão de operações de logística, limpeza e conservação. Controle ordens de serviço, equipes, equipamentos, medições e faturamento em um único ambiente.</p>
        </div>
        <div className="badges">
          <div className="b"><b>100%</b><span>Operacional</span></div>
          <div className="b"><b>8</b><span>Módulos ativos</span></div>
          <div className="b"><b>API</b><span>Conectada</span></div>
        </div>
        <footer>© 2026 SF TORRES · ST Serviços de Logística · CNPJ 00.000.000/0001-00</footer>
      </aside>
      <main className="login-main">
        <div className="login-card">
          <div className="brand-line">
            <div className="mark"><LogoST src={settings.primaryLogo} dark /></div>
            <div><div className="eyebrow">Centro Operacional</div><div className="brand-name">{settings.fantasyName}</div></div>
          </div>
          <h1>Acesse sua conta</h1>
          <p className="subtitle">Use suas credenciais corporativas para entrar no ambiente operacional.</p>
          <form className="login-form" onSubmit={submit}>
            <div className="form-field"><label>Usuário ou e-mail</label><input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="form-field"><label>Senha</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="form-field"><label>Empresa / Filial</label><select><option>SF TORRES - Matriz Manaus/AM</option><option>ST Serviços de Logística - Filial</option></select></div>
            <div className="aux"><label className="row"><input type="checkbox" defaultChecked /> Manter conectado</label><a href="#/login">Esqueci minha senha</a></div>
            <button className="btn btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no sistema'}</button>
          </form>
          <div className="login-foot">{message}</div>
        </div>
      </main>
    </div>
  );
}

function Sidebar({ route, setRoute, settings }) {
  const groups = [
    ['Principal', [['dashboard', 'PR', 'Principal']]],
    ['Operações', [['tower', 'TO', 'Torre Operacional'], ['dailyOps', 'OD', 'Operação Diária'], ['schedules', 'PD', 'Programação de Equipes']]],
    ['Gestão', [['productivity', 'PD', 'Produtividade'], ['employees', 'FE', 'Funcionários'], ['map', 'MP', 'Mapa Operacional']]],
    ['Movimentações', [['measurement', 'MS', 'Medição & Faturamento'], ['reports', 'RP', 'Relatórios']]],
    ['Cadastros', [['clients', 'CL', 'Clientes'], ['services', 'SV', 'Serviços'], ['equipment', 'EQ', 'Equipamentos'], ['locations', 'LC', 'Locações & Áreas']]],
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
      <div className="brand"><div className="brand-mark"><LogoST src={settings.primaryLogo} /></div><div className="brand-text"><strong>{settings.fantasyName}</strong><span>Centro Operacional</span></div></div>
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
      <div className="user-card">
        <div className="avatar">SF</div><div className="info"><b>{user.name || 'Administrador SF'}</b><span>{user.email || '@sftorres'}</span></div>
        <button className="logout" onClick={() => { localStorage.clear(); window.location.hash = '#/login'; }}>↪</button>
      </div>
    </aside>
  );
}

function Topbar({ route, settings, openPanel }) {
  const def = routes[route] || routes.dailyOps;
  const user = JSON.parse(localStorage.getItem('sfTorresUser') || '{}');
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
        <div className="who"><div className="ava">SF</div><div className="meta"><b>{user.name}</b><span>{user.email}</span></div></div>
      </div>
    </header>
  );
}

function Screen({ route, notify, settings, setSettings }) {
  const editable = canEdit(route);
  if (!canView(route)) return <AccessDenied />;
  if (route === 'dailyOps') return <DailyOps notify={notify} editable={editable} />;
  if (route === 'measurement') return <Measurement notify={notify} editable={editable} />;
  if (route === 'schedules') return <Schedules notify={notify} editable={editable} />;
  if (route === 'users') return <Users notify={notify} editable={editable} />;
  if (crudConfigs[route]) return <CrudScreen config={crudConfigs[route]} notify={notify} editable={editable} />;
  if (route === 'dashboard') return <Dashboard />;
  if (route === 'tower') return <Tower />;
  if (route === 'productivity') return <Productivity />;
  if (route === 'map') return <OperationalMap />;
  if (route === 'reports') return <Reports />;
  if (route === 'settings') return <Settings notify={notify} settings={settings} setSettings={setSettings} editable={editable} />;
  return <Placeholder route={route} />;
}

function AccessDenied() {
  return <Panel title="Acesso restrito" padded><p>Seu usuario nao tem permissao para abrir esta tela.</p><p className="soft">Peça ao administrador para liberar acesso de visualizacao ou edicao em Usuarios & Perfis.</p></Panel>;
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [onlyOpen, setOnlyOpen] = useState(false);
  useEffect(() => {
    api('/api/dashboard/summary').then((p) => setSummary(p.data)).catch((error) => triggerAction(error.message));
    api('/api/workOrders').then((p) => setOrders(p.data)).catch((error) => triggerAction(error.message));
  }, []);
  const shownOrders = onlyOpen ? orders.filter((order) => !String(order.status).toLowerCase().includes('conclu')) : orders;
  return (
    <>
      <PageHead title="Painel Corporativo" subtitle="Visão consolidada das operações, produtividade e faturamento." ghostAction="Exportar" onGhostAction={() => downloadCsv('painel-ordens-recentes.csv', [['OS', 'Cliente', 'Serviço', 'Equipamento', 'Equipe', 'Status', 'Data'], ...shownOrders.map((o) => [o.number, o.client, o.service, o.equipment, o.carrier, o.status, o.date])])} action="Atualizar agora" onAction={() => { triggerAction('Painel atualizado'); api('/api/dashboard/summary').then((p) => setSummary(p.data)).catch((error) => triggerAction(error.message)); api('/api/workOrders').then((p) => setOrders(p.data)).catch((error) => triggerAction(error.message)); }} />
      <div className="kpi-grid">
        <Kpi icon="grid" label="Módulos ativos" value="10" delta="+1 desde o último ciclo" />
        <Kpi icon="users" label="Clientes ativos" value={summary?.activeClients ?? '-'} delta="contratos em operação" success />
        <Kpi icon="file" label="Serviços contratados" value="4" delta="tipos cadastrados" warning />
        <Kpi icon="star" label="Lideranças" value="2" delta="usuários líderes" />
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3>Ordens de serviço recentes</h3><div className="actions"><button className="btn btn-sm" onClick={() => setOnlyOpen((value) => !value)}>{onlyOpen ? 'Ver todas' : 'Filtrar abertas'}</button><button className="btn btn-sm btn-primary" onClick={() => { window.location.hash = '#/dailyOps'; }}>Nova OS</button></div></div>
          <DataTable columns={['OS', 'Cliente', 'Serviço', 'Equipamento', 'Equipe', 'Status', 'Prev.']} rows={shownOrders.map((o) => [<span className="mono">{o.number}</span>, o.client, o.service, <span className="mono">{o.equipment || '-'}</span>, o.carrier || '-', <Pill value={o.status} />, date(o.date).slice(0, 5)])} />
        </div>
        <ActivityPanel />
      </div>
      <div className="triple-grid">
        <InfoPanel title="Faturamento do mês" value={summary ? money(summary.billedMonth) : '-'} sub="+12% vs. mês anterior"><Pill value="SEMP TCL · 68%" /> <Pill value="ADF · 32%" /></InfoPanel>
        <InfoPanel title="Equipe no campo" value="14" sub="Operadores alocados hoje"><div className="progress"><span style={{ width: '78%' }} /></div></InfoPanel>
        <InfoPanel title="Ocorrências (semana)" value={summary?.openOccurrences ?? '-'} sub="em análise"><Pill value="4 Abertas" /> <Pill value="3 Fechadas" /></InfoPanel>
      </div>
    </>
  );
}

function Tower() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Fila');
  const load = () => api('/api/workOrders').then((payload) => setOrders(payload.data)).catch((error) => triggerAction(error.message));
  useEffect(load, []);
  const visible = statusFilter === 'Todos'
    ? orders
    : orders.filter((order) => ['Aprovada', 'Enviada', 'Em execucao', 'Rascunho'].includes(order.status));
  const active = orders.filter((order) => String(order.status).includes('exec')).length;
  const done = orders.filter((order) => String(order.status).toLowerCase().includes('conclu')).length;
  const queue = orders.filter((order) => ['Aprovada', 'Enviada', 'Rascunho'].includes(order.status)).length;
  const alertCount = orders.filter((order) => ['Paralisada', 'Cancelada'].includes(order.status)).length;
  const assignTeam = async () => {
    const order = visible.find((item) => ['Aprovada', 'Enviada', 'Rascunho'].includes(item.status));
    if (!order) return triggerAction('Nenhuma OS na fila');
    await api(`/api/workOrders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ...order, status: 'Em execucao', carrier: order.carrier || 'Equipe acionada pela torre', progress: Math.max(Number(order.progress || 0), 10) }) });
    triggerAction(`Equipe acionada para OS ${order.number}`);
    load();
  };
  const rows = visible.map((order) => [order.number, order.client, order.location || '-', order.carrier || 'Sem equipe', date(order.date), order.status === 'Concluida' ? date(order.updatedAt) : '-', <Pill value={order.status} />]);
  return <><PageHead title="Torre Operacional" subtitle="Painel em tempo real das operações em andamento e fila de execução." ghostAction="Tempo real" onGhostAction={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')} action="Atualizar" onAction={load} /><div className="kpi-grid"><Kpi icon="pulse" label="Operações ativas" value={active} delta="em campo agora" /><Kpi icon="clock" label="Na fila" value={queue} delta="próximas 24h" warning /><Kpi icon="check" label="Concluídas" value={done} delta="ordens no sistema" success /><Kpi icon="alert" label="Alertas" value={alertCount} delta="atenção da torre" danger /></div><Panel title="Fila de execução" actions={<><button className="btn btn-sm" onClick={() => setStatusFilter((value) => value === 'Todos' ? 'Fila' : 'Todos')}>{statusFilter === 'Todos' ? 'Ver fila' : 'Ver todas'}</button><button className="btn btn-sm btn-primary" onClick={assignTeam}>Acionar equipe</button></>}><DataTable columns={['OS', 'Cliente', 'Local', 'Equipe', 'Início', 'Término', 'Status']} rows={rows} /></Panel></>;
}

function Schedules({ notify, editable = true }) {
  const user = currentUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: 'Todos' });
  const load = () => { setLoading(true); api('/api/workOrders').then((p) => setItems(p.data)).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(load, []);
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
  const bindToMe = async (order) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    const name = user.name || 'Lider';
    const email = user.email || '';
    await api(`/api/workOrders/${order.id}`, { method: 'PUT', body: JSON.stringify({ ...order, responsible: `${name}${email ? ` (${email})` : ''}`, status: order.status === 'Rascunho' ? 'Enviada' : order.status, progress: Math.max(Number(order.progress || 0), 5) }) });
    notify('OS vinculada ao lider logado');
    load();
  };
  const exportRows = () => downloadCsv('programacao-os-lider.csv', [['OS', 'Cliente', 'Servico', 'Equipamento', 'Local', 'Lider', 'Status', 'Data'], ...visibleOrders.map((item) => [item.number, item.client, item.service, item.equipment, item.location, item.responsible, item.status, item.date])]);
  const rows = loading ? [['Carregando OS do banco...', '', '', '', '', '', '', '']] : visibleOrders.map((item) => [<span className="mono">{item.number}</span>, item.client, item.service || '-', item.equipment || '-', item.location || '-', item.responsible || '-', <Pill value={item.status} />, editable ? <button className="btn btn-sm btn-primary" onClick={() => bindToMe(item)}>Vincular a mim</button> : <span className="soft">Somente leitura</span>]);
  return (
    <>
      <PageHead title="Programação de Equipes" subtitle="Fila de OS criadas pela administração para o líder vincular e acompanhar pelo próprio usuário." ghostAction="Exportar OS" onGhostAction={exportRows} action="Atualizar" onAction={load} />
      <div className="toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Rascunho</option><option>Enviada</option><option>Aprovada</option><option>Em execucao</option><option>Concluida</option><option>Cancelada</option></select></div>
        <span className="spacer" /><span className="soft">{visibleOrders.length} OS para este usuario</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="file" label="OS recebidas" value={visibleOrders.length} delta="vinculadas ao lider" />
        <Kpi icon="clock" label="Pendentes" value={visibleOrders.filter((item) => ['Rascunho', 'Enviada'].includes(item.status)).length} delta="aguardando programacao" warning />
        <Kpi icon="home" label="Em campo" value={visibleOrders.filter((item) => item.status === 'Em execucao').length} delta="em execucao" />
        <Kpi icon="check" label="Concluidas" value={visibleOrders.filter((item) => item.status === 'Concluida').length} delta="finalizadas" success />
      </div>
      <Panel title="OS direcionadas ao lider" actions={<Pill value={user.name || user.email || 'usuario'} />}><DataTable columns={['OS', 'Cliente', 'Servico', 'Equipamento', 'Local', 'Responsavel', 'Status', 'Acao']} rows={rows} /></Panel>
    </>
  );
}

function Productivity() {
  const [orders, setOrders] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    api('/api/workOrders').then((payload) => setOrders(payload.data)).catch((error) => triggerAction(error.message));
    api('/api/measurements').then((payload) => setMeasurements(payload.data)).catch((error) => triggerAction(error.message));
  }, []);
  const done = orders.filter((order) => String(order.status).toLowerCase().includes('conclu'));
  const byTeam = Object.values(orders.reduce((acc, order) => {
    const team = order.carrier || 'Sem equipe';
    acc[team] = acc[team] || { team, os: 0, progress: 0 };
    acc[team].os += 1;
    acc[team].progress += Number(order.progress || 0);
    return acc;
  }, {}));
  const teamRows = byTeam.map((item) => {
    const efficiency = item.os ? Math.round(item.progress / item.os) : 0;
    return [item.team, item.team.includes('·') ? item.team.split('·')[0].trim() : '-', item.os, (item.os * 8.4).toFixed(1), (Math.max(5, efficiency / 10)).toFixed(1), <Pill value={`${efficiency || 75}%`} />];
  });
  const revenueByClient = Object.values(measurements.reduce((acc, item) => {
    acc[item.client] = acc[item.client] || { client: item.client, count: 0, total: 0 };
    acc[item.client].count += 1;
    acc[item.client].total += Number(item.total || 0);
    return acc;
  }, {}));
  const revenueRows = revenueByClient.map((item) => [item.client, item.count, money(item.total)]);
  const totalRevenue = revenueByClient.reduce((sum, item) => sum + item.total, 0);
  const exportRows = [['Equipe', 'Líder', 'OS', 'Ton.', 't/h', 'Efic.'], ...teamRows.map((row) => row.map((cell) => typeof cell === 'object' ? cell.props.value : cell))];
  return <><PageHead title="Produtividade" subtitle="Indicadores operacionais por equipe, cliente, equipamento e turno." ghostAction={compare ? 'Ocultar comparação' : 'Comparar períodos'} onGhostAction={() => setCompare((value) => !value)} action="Exportar relatório" onAction={() => downloadCsv('produtividade.csv', exportRows)} /><div className="kpi-grid"><Kpi icon="chart" label="Toneladas / hora" value={(done.length ? done.length * 1.4 : 8.4).toFixed(1)} delta={compare ? 'comparado ao período anterior' : 'meta: 7,5'} success /><Kpi icon="clock" label="Tempo médio OS" value="04:32" delta="Meta: 5h" /><Kpi icon="alert" label="Índice de paradas" value={`${orders.filter((order) => ['Paralisada', 'Cancelada'].includes(order.status)).length}%`} delta={compare ? '-1 p.p.' : 'base atual'} warning /><Kpi icon="file" label="OS concluídas" value={done.length} delta="base do banco" /></div><div className="two-grid"><Panel title={`Produtividade por equipe${compare ? ' · comparativo ativo' : ''}`} padded><DataTable columns={['Equipe', 'Líder', 'OS', 'Ton.', 't/h', 'Efic.']} rows={teamRows} /></Panel><Panel title="Resumo por cliente" padded><DataTable columns={['Cliente', 'Medições', 'Fat. (R$)']} rows={[...revenueRows, [<b>Total</b>, <b>{measurements.length}</b>, <b>{money(totalRevenue)}</b>]]} /></Panel></div></>;
}

function OperationalMap() {
  const [layer, setLayer] = useState('ruas');
  const [centered, setCentered] = useState(false);
  const [locations, setLocations] = useState([]);
  const [orders, setOrders] = useState([]);
  const load = () => {
    api('/api/locations').then((payload) => setLocations(payload.data)).catch((error) => triggerAction(error.message));
    api('/api/workOrders').then((payload) => setOrders(payload.data)).catch((error) => triggerAction(error.message));
  };
  useEffect(load, []);
  const points = (locations.length ? locations : [{ description: 'Pátio 3 - SEMP TCL', status: 'Operacional' }, { description: 'Pátio 2', status: 'Fila' }, { description: 'Porto CSF', status: 'Alerta' }]).slice(0, 5);
  const colors = ['#1F8A4C', '#C77700', '#B3261E', '#0B6FB8', '#1B3A6B'];
  return <><PageHead title="Mapa Operacional" subtitle="Visualização georreferenciada das operações em andamento e pátios ativos." ghostAction="Centralizar" onGhostAction={() => setCentered(true)} action="Atualizar mapa" onAction={load} /><div className="map-grid"><Panel title={`Mapa · Manaus / AM · ${layer === 'ruas' ? 'Ruas' : 'Satélite'}`} actions={<><button className={`btn btn-sm ${layer === 'satelite' ? 'btn-primary' : ''}`} onClick={() => setLayer('satelite')}>Satélite</button><button className={`btn btn-sm ${layer === 'ruas' ? 'btn-primary' : ''}`} onClick={() => setLayer('ruas')}>Ruas</button></>}><svg viewBox="0 0 1100 520" className={`map-svg map-${layer} ${centered ? 'map-centered' : ''}`}><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D9E2EC" strokeWidth="1" /></pattern></defs><rect width="1100" height="520" fill={layer === 'ruas' ? 'url(#grid)' : '#D9E4D4'} /><path d="M0 320 C 200 280, 380 360, 620 310 S 980 280, 1100 320 L 1100 400 C 980 380, 800 420, 580 380 S 240 360, 0 400 Z" fill={layer === 'ruas' ? '#BFD8E5' : '#96B88D'} />{points.map((point, index) => <MapPoint key={point.id || point.description} x={160 + index * 180} y={110 + (index % 2) * 42} w="190" h="120" title={point.description || point.code} status={`${orders.filter((order) => order.location === point.description).length} OS · ${point.status || 'Operacional'}`} color={colors[index]} />)}<path d="M 290 160 Q 430 90 590 170 T 910 140" stroke="#1B3A6B" strokeWidth="3" fill="none" strokeDasharray="6 4" /></svg></Panel><Panel title="Pontos monitorados"><ul className="activity">{points.map((point, index) => <li key={point.id || point.description}><Pill value={point.status || 'OK'} /><div><b>{point.description || point.code}</b><span>{orders.filter((order) => order.location === point.description).length} OS vinculadas · camada {layer}</span></div></li>)}</ul></Panel></div></>;
}

function Reports() {
  const cards = [
    ['Ordens de Serviço', 'Listagem detalhada com filtros por período, cliente, status e equipamento.', '/api/workOrders'],
    ['Produtividade por Equipe', 'Indicadores de t/h, eficiência, OS concluídas e tempo médio.', '/api/workOrders'],
    ['Faturamento por Cliente', 'Totalizadores por cliente, contrato e centro de custo.', '/api/measurements'],
    ['Ocorrências Operacionais', 'Histórico de incidentes por tipo, equipe e local, com SLA.', '/api/occurrences'],
    ['Movimentação de Pessoal', 'Admissões, desligamentos, férias, afastamentos por período.', '/api/employees'],
    ['Equipamentos', 'Utilização, manutenções e vida útil por container/veículo.', '/api/equipment']
  ];
  const [selected, setSelected] = useState(cards[0]);
  const [config, setConfig] = useState(false);
  const generate = async (card = selected) => {
    const payload = await api(card[2]);
    const rows = payload.data || [];
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => !['id', 'createdAt', 'updatedAt'].includes(key))))];
    downloadCsv(`${card[0].toLowerCase().replaceAll(' ', '-')}.csv`, [keys, ...rows.map((row) => keys.map((key) => row[key]))]);
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
  useEffect(() => setForm(settings), [settings]);
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
    await api('/api/settings/company', { method: 'PUT', body: JSON.stringify(form) });
    setSettings(form);
    notify('Configurações salvas no banco');
  };
  const restoreDefaults = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar configuracoes');
    setForm(defaultSettings);
    setSettings(defaultSettings);
    await api('/api/settings/company', { method: 'PUT', body: JSON.stringify(defaultSettings) });
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
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dados');
  const [filters, setFilters] = useState({ q: '', status: 'Todos', client: 'Todos', period: 'Este mês', table: '' });
  const optionValues = (list, ...keys) => list.map((item) => keys.map((key) => item[key]).find(Boolean)).filter(Boolean);
  const fields = [
    ['number', 'Número da OS'],
    ['client', 'Cliente', 'select', ['', ...optionValues(clients, 'name', 'legalName')]],
    ['equipment', 'Equipamento', 'select', ['', ...optionValues(equipment, 'code', 'model', 'type')]],
    ['status', 'Status', 'select', ['Rascunho', 'Enviada', 'Aprovada', 'Em execucao', 'Concluida', 'Cancelada']],
    ['date', 'Data', 'date'],
    ['carrier', 'Transportador'],
    ['service', 'Serviço', 'select', ['', ...optionValues(services, 'description', 'code')]],
    ['location', 'Local'],
    ['responsible', 'Responsável', 'select', ['', ...optionValues(leaders, 'name')]],
    ['progress', 'Percentual', 'number'],
    ['priority', 'Prioridade', 'select', ['Baixa', 'Normal', 'Alta', 'Crítica']]
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
  const load = () => { setLoading(true); api('/api/workOrders').then((p) => { setItems(p.data); setSelectedId((old) => old || p.data[0]?.id || ''); }).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => {
    api('/api/clients').then((payload) => setClients(payload.data)).catch(() => {});
    api('/api/equipment').then((payload) => setEquipment(payload.data)).catch(() => {});
    api('/api/services').then((payload) => setServices(payload.data)).catch(() => {});
    api('/api/employees').then((payload) => setLeaders((payload.data || []).filter((item) => normalize(item.role).includes('lider')))).catch(() => {
      api('/api/employees').then((payload) => setLeaders(payload.data.filter((item) => normalize(item.role).includes('lider')))).catch(() => {});
    });
  }, []);
  useEffect(() => {
    if (filteredItems.length && !filteredItems.some((item) => item.id === selectedId)) setSelectedId(filteredItems[0].id);
  }, [filters, items]);
  const save = async (data) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await api(modal?.id ? `/api/workOrders/${modal.id}` : '/api/workOrders', { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    setModal(null); notify('OS salva'); load();
  };
  const remove = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected || !confirm('Apagar esta OS?')) return;
    await api(`/api/workOrders/${selected.id}`, { method: 'DELETE' });
    notify('OS apagada'); setSelectedId(''); load();
  };
  const exportFiltered = () => downloadCsv('operacao-diaria.csv', [['OS', 'Cliente', 'Equipamento', 'Status', 'Data', 'Serviço', 'Equipe'], ...filteredItems.map((item) => [item.number, item.client, item.equipment, item.status, item.date, item.service, item.carrier])]);
  const requestCorrection = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected) return;
    await api('/api/occurrences', { method: 'POST', body: JSON.stringify({ workOrder: selected.number, type: 'Correção', description: 'Solicitação de correção aberta pela Operação Diária', status: 'Aberta' }) });
    notify('Correção registrada no banco');
  };
  const registerOccurrence = async () => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!selected) return;
    await api('/api/occurrences', { method: 'POST', body: JSON.stringify({ workOrder: selected.number, type: 'Operacional', description: 'Ocorrência lançada pela tela de operação diária', status: 'Aberta' }) });
    notify('Ocorrência registrada no banco');
  };
  const detailContent = () => {
    if (!selected) return null;
    if (activeTab === 'Equipe') return [['Equipe', selected.carrier || 'Sem equipe definida'], ['Responsável', selected.responsible || '-'], ['Prioridade', selected.priority || '-'], ['Percentual', `${selected.progress || 0}%`]];
    if (activeTab === 'Horários') return [['Data prevista', date(selected.date)], ['Início', selected.startTime || '-'], ['Término', selected.endTime || '-'], ['Janela', selected.window || '06:00 - 22:00']];
    if (activeTab === 'Ocorrências') return [['Status operacional', selected.status], ['Último registro', 'Ocorrências salvas no histórico do banco'], ['Ação rápida', 'Use Lançar ocorrência ou Solicitar correção']];
    return [['Data', date(selected.date)], ['Transportador', selected.carrier], ['Serviço', selected.service], ['Equipamento', selected.equipment || '-'], ['Posto', selected.location || 'ARCONDICIONADO - 0 un.'], ['Responsável', selected.responsible], ['Percentual', `${selected.progress || 0}%`], ['Prioridade', selected.priority]];
  };
  return (
    <>
      <PageHead title="Operação Diária" subtitle="Gestão detalhada das OS com filtros, confirmação de equipe, horários e ocorrências." ghostActions={['Histórico', 'Exportar planilha']} onGhostAction={(label) => label === 'Histórico' ? setHistoryOpen(true) : exportFiltered()} action="Nova OS" onAction={() => setModal({})} />
      <div className="toolbar">
        <div className="filter"><label>Buscar</label><input type="text" value={filters.q} onChange={(event) => setFilters((old) => ({ ...old, q: event.target.value }))} placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}><option>Todos</option><option>Rascunho</option><option>Enviada</option><option>Aprovada</option><option>Em execucao</option><option>Concluida</option><option>Cancelada</option></select></div>
        <div className="filter"><label>Cliente</label><select value={filters.client} onChange={(event) => setFilters((old) => ({ ...old, client: event.target.value }))}>{clientOptions.map((client) => <option key={client}>{client}</option>)}</select></div>
        <div className="filter"><label>Período</label><select value={filters.period} onChange={(event) => setFilters((old) => ({ ...old, period: event.target.value }))}><option>Hoje</option><option>Esta semana</option><option>Este mês</option><option>Personalizado</option></select></div>
        <span className="spacer" />
        <span className="soft">{filteredItems.length} resultados</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="check" label="Aprovadas" value={counts.Aprovada || 0} delta="prontas para execução" success />
        <Kpi icon="clock" label="Enviadas" value={counts.Enviada || 0} delta="aguardando aprovação" warning />
        <Kpi icon="home" label="Em execução" value={counts['Em execucao'] || 0} delta="campo" />
        <Kpi icon="alert" label="Ocorrências" value="02" delta="em análise" danger />
      </div>
      <div className="detail">
        <div className="pane" style={{ overflow: 'hidden' }}>
          <div className="table-tools"><input className="search-input" value={filters.table} onChange={(event) => setFilters((old) => ({ ...old, table: event.target.value }))} placeholder="Filtrar resultados..." /><span className="spacer" /><button className="btn btn-sm" onClick={() => setItems((old) => [...old].sort((a, b) => String(b.date).localeCompare(String(a.date))))}>Ordenar: Data ↓</button></div>
          <div className="table-scroll"><table className="dtbl"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Status</th><th className="right">Data</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Carregando dados do banco...</td></tr> : filteredItems.map((i) => <tr key={i.id} className={selected?.id === i.id ? 'selected' : ''} onClick={() => setSelectedId(i.id)}><td className="mono">{i.number}</td><td>{i.client}</td><td className="mono">{i.equipment || '-'}</td><td><Pill value={i.status} /></td><td className="right">{date(i.date)}</td></tr>)}</tbody></table></div>
        </div>
        <div className="pane">{selected && <><div className="pane-head"><div><div className="eyebrow">Ordem de Serviço</div><div className="mono-title">OS {selected.number} · {selected.client}</div></div><div className="meta"><Pill value={selected.status} /></div></div><div className="tabs">{['Dados', 'Equipe', 'Horários', 'Ocorrências'].map((tab) => <div key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</div>)}</div><div className="pane-body">{detailContent().map(([k, v]) => <div className="field-row" key={k}><b>{k}</b><span>{v}</span></div>)}</div><div className="action-strip"><button className="btn" onClick={() => setModal(selected)}>Editar OS</button><button className="btn" onClick={requestCorrection}>Solicitar correção</button><button className="btn btn-success" onClick={registerOccurrence}>Lançar ocorrência</button><button className="btn btn-danger push" onClick={remove}>Apagar</button></div></>}</div>
      </div>
      {modal && <Editor title={modal.id ? 'Editar OS' : 'Nova OS'} fields={fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}
      {historyOpen && <div className="modal-backdrop"><div className="modal"><div className="modal-head"><h3>Histórico da operação</h3><button className="btn btn-sm" onClick={() => setHistoryOpen(false)}>Fechar</button></div><div className="modal-body"><DataTable columns={['OS', 'Cliente', 'Status', 'Data']} rows={items.map((item) => [item.number, item.client, <Pill value={item.status} />, date(item.date)])} /></div></div></div>}
    </>
  );
}

function Measurement({ notify, editable = true }) {
  const [pendingOnly, setPendingOnly] = useState(false);
  return <>
    <CrudScreen
      config={{
        ...crudConfigs.measurement,
        endpoint: `/api/measurements${pendingOnly ? '?status=Pendente' : ''}`,
        noToolbar: true,
        panelActions: ({ items, load }) => <><button className="btn btn-sm" onClick={() => setPendingOnly((value) => !value)}>{pendingOnly ? 'Ver todas' : 'Filtrar pendentes'}</button><button className="btn btn-sm btn-primary" onClick={async () => { if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela'); const pending = items.find((item) => item.status === 'Pendente') || items[0]; if (!pending) return notify('Nenhuma medição para fechar'); await api(`/api/measurements/${pending.id}`, { method: 'PUT', body: JSON.stringify({ ...pending, status: 'Fechada' }) }); notify('Medição fechada no banco'); load(); }}>Fechar medição</button></>
      }}
      notify={notify}
      editable={editable}
      beforeTable={<div className="kpi-grid"><Kpi icon="money" label="Faturado (mês)" value="R$ 184.250" delta="+12% MoM" success /><Kpi icon="clock" label="A faturar" value="R$ 42.180" delta="4 medições" /><Kpi icon="alert" label="Pendentes" value="02" delta="aguardando cliente" warning /><Kpi icon="check" label="Medições fechadas" value="38" delta="no mês" /></div>}
    />
  </>;
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
    api(`${config.endpoint}${q ? `${separator}q=${encodeURIComponent(q)}` : ''}`).then((p) => setItems(p.data)).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false));
  };
  useEffect(load, [q, config.endpoint]);
  const fieldMap = { Função: 'role', Equipe: 'team', Status: 'status', Tipo: 'type' };
  const displayItems = (config.toolbar || []).reduce((list, [label]) => {
    const value = toolbarFilters[label];
    const key = fieldMap[label];
    if (!value || value === 'Todos' || value === 'Todas') return list;
    if (!key) return list.filter((item) => normalize(Object.values(item).join(' ')).includes(normalize(value)));
    return list.filter((item) => normalize(item[key]) === normalize(value));
  }, items);
  const save = async (data) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    await api(modal?.id ? `${config.endpoint}/${modal.id}` : config.endpoint, { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    setModal(null); notify('Registro salvo'); load();
  };
  const remove = async (item) => {
    if (!editable) return notify('Seu usuario tem acesso somente para visualizar esta tela');
    if (!confirm('Apagar este registro?')) return;
    await api(`${config.endpoint}/${item.id}`, { method: 'DELETE' });
    notify('Registro apagado'); load();
  };
  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} ghostAction={config.ghostLabel} action={editable ? config.newLabel : null} onAction={() => setModal({})} />
      {config.toolbar && <Toolbar fields={config.toolbar} count={displayItems.length} values={toolbarFilters} onChange={setToolbarFilters} />}
      {!config.noToolbar && !config.toolbar && <div className="toolbar"><div className="filter"><label>Buscar</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." /></div><span className="spacer" /><span className="soft">{displayItems.length} registros</span></div>}
      {beforeTable}
      <div className="panel" style={{ overflow: 'hidden' }}><div className="panel-head"><h3>{panelTitle(config, displayItems.length)}</h3>{config.panelActions && <div className="actions">{typeof config.panelActions === 'function' ? config.panelActions({ items: displayItems, load }) : config.panelActions}</div>}</div><div className="panel-body" style={{ padding: 0 }}><table className="dtbl"><thead><tr>{config.columns.map((c) => <th key={c.label} className={c.right ? 'right' : ''}>{c.label}</th>)}<th /></tr></thead><tbody>{loading ? <tr><td colSpan={config.columns.length + 1}>Carregando dados do banco...</td></tr> : displayItems.map((item) => <tr key={item.id}>{config.columns.map((c) => <td key={c.label} className={`${c.mono ? 'mono' : ''} ${c.right ? 'right' : ''}`}>{c.render ? c.render(item) : item[c.key]}</td>)}<td className="right">{editable ? <><button className="btn btn-sm" onClick={() => setModal(item)}>Editar</button> <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Apagar</button></> : <span className="soft">Somente leitura</span>}</td></tr>)}</tbody></table></div></div>
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
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([name, , type]) => [name, type === 'permissions' ? (initial?.[name] || defaultUserPermissions(initial?.role)) : initial?.[name] ?? ''])));
  const change = (name, value, type) => setForm((old) => ({ ...old, [name]: type === 'number' ? Number(value || 0) : value }));
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="btn btn-sm" onClick={onCancel}>Fechar</button></div>
        <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-grid">{fields.map(([name, label, type = 'text', options]) => type === 'permissions' ? <PermissionMatrix key={name} label={label} value={form[name]} onChange={(value) => change(name, value, type)} /> : <div className="form-field" key={name}><label>{label}</label>{type === 'select' ? <select value={form[name]} onChange={(e) => change(name, e.target.value, type)}>{options.map((o) => <option key={o || '-'} value={o}>{o || '-'}</option>)}</select> : <input type={type} value={form[name]} onChange={(e) => change(name, e.target.value, type)} />}</div>)}</div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancelar</button><button className="btn btn-primary">Salvar</button></div>
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

function Placeholder({ route }) {
  const def = routes[route] || routes.dashboard;
  return <><PageHead title={def.title} subtitle="Módulo estruturado dentro do app. A próxima etapa é ligar as regras específicas desse fluxo." /><div className="panel"><div className="panel-body">Este módulo já está dentro do sistema React. Os cadastros principais e a operação diária estão conectados ao backend.</div></div></>;
}

function ActionPanel({ type, setRoute, onClose }) {
  const [q, setQ] = useState('');
  const routeEntries = Object.entries(routes).filter(([key, item]) => canView(key) && normalize(item.title + item.group).includes(normalize(q)));
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
    notifications: <ul className="activity"><li><Pill value="OS" /><div><b>OS aguardando aprovação</b><span>Use Operação Diária para revisar e aprovar.</span></div></li><li><Pill value="MED" /><div><b>Medições pendentes</b><span>2 medições aguardando fechamento financeiro.</span></div></li><li><Pill value="CFG" /><div><b>Configurações atualizadas</b><span>Alterações de marca e política ficam registradas no banco.</span></div></li></ul>,
    messages: <ul className="activity"><li><Pill value="Torre" /><div><b>Equipe de campo solicitou correção</b><span>Abra Operação Diária para tratar ocorrência.</span></div></li><li><Pill value="Financeiro" /><div><b>Relatório mensal disponível</b><span>Gere CSV em Relatórios ou Medição.</span></div></li></ul>,
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

function DataTable({ columns, rows }) {
  return <table className="dtbl"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}

function ActivityPanel() {
  const items = [
    ['OS', 'OS 0007-159 aprovada por Administrador SF', 'há 18 min · Operação Diária'],
    ['EQ', 'Equipamento HAMU2997067 vinculado à OS', 'há 1h · Cadastros'],
    ['MS', 'Medição #043 fechada - R$ 18.420,00', 'há 3h · Medição & Faturamento'],
    ['PD', 'Programação semanal de equipes publicada', 'há 6h · Programação']
  ];
  return <Panel title="Atividades recentes" actions={<span className="soft">Últimas 24h</span>}><ul className="activity">{items.map(([tag, text, time]) => <li key={text}><Pill value={tag} /><div><b>{text}</b><span>{time}</span></div></li>)}</ul></Panel>;
}

function InfoPanel({ title, value, sub, children }) {
  return <div className="panel"><div className="panel-head"><h3>{title}</h3></div><div className="panel-body"><div className="big-number">{value}</div><div className="soft">{sub}</div><div className="inline-pills">{children}</div></div></div>;
}

function MapPoint({ x, y, w, h, title, status, color }) {
  const cx = x + w / 2;
  return <g><rect x={x} y={y} width={w} height={h} fill={color} opacity=".16" stroke={color} strokeWidth="2" /><text x={cx} y={y + h / 2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0F2447">{title}</text><circle cx={cx} cy={y + 40} r="9" fill={color} stroke="#FFFFFF" strokeWidth="2" /><text x={cx} y={y + 62} textAnchor="middle" fontSize="10" fill={color}>{status}</text></g>;
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
