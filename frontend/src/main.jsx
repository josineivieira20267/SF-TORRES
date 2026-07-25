import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './system.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333';

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
      ['Função', ['Todas', 'Líder de turno', 'Operador', 'Motorista', 'Auxiliar'], 'select'],
      ['Equipe', ['Todas', 'Aliança', 'TransNorte', 'Mov. Sul'], 'select'],
      ['Status', ['Todos', 'Ativo', 'Férias', 'Afastado'], 'select']
    ],
    columns: [
      { label: '#', key: 'code', mono: true }, { label: 'Nome', key: 'name' }, { label: 'CPF', key: 'cpf', mono: true },
      { label: 'Função', key: 'role' }, { label: 'Equipe', key: 'team' },
      { label: 'Admissão', render: (i) => date(i.admissionDate) }, { label: 'Status', render: (i) => <Pill value={i.status} /> }
    ],
    fields: [
      ['code', 'Código'], ['name', 'Nome'], ['cpf', 'CPF'], ['role', 'Função'], ['team', 'Equipe'],
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

function cleanRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '') || 'dailyOps';
  return routes[route] ? route : 'dailyOps';
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

  useEffect(() => {
    const onHash = () => setRoute(cleanRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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
    return <Login />;
  }

  return (
    <div className="app">
      <Sidebar route={route} setRoute={setRoute} />
      <Topbar route={route} />
      <main className="main">
        <div className="page">
          <ErrorBoundary resetKey={route}>
            <Screen route={route} notify={notify} />
          </ErrorBoundary>
        </div>
      </main>
      <div className={`sf-toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

function Login() {
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
      window.location.hash = '#/dailyOps';
    } catch (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-aside">
        <div className="logo-area"><LogoSM /></div>
        <div className="copy">
          <h2>Centro Operacional<br />SF TORRES</h2>
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
            <div className="mark"><LogoST dark /></div>
            <div><div className="eyebrow">Centro Operacional</div><div className="brand-name">SF TORRES</div></div>
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

function Sidebar({ route, setRoute }) {
  const groups = [
    ['Principal', [['dashboard', 'PR', 'Principal']]],
    ['Operações', [['tower', 'TO', 'Torre Operacional'], ['dailyOps', 'OD', 'Operação Diária'], ['schedules', 'PD', 'Programação de Equipes']]],
    ['Gestão', [['productivity', 'PD', 'Produtividade'], ['employees', 'FE', 'Funcionários'], ['map', 'MP', 'Mapa Operacional']]],
    ['Movimentações', [['measurement', 'MS', 'Medição & Faturamento'], ['reports', 'RP', 'Relatórios']]],
    ['Cadastros', [['clients', 'CL', 'Clientes'], ['services', 'SV', 'Serviços'], ['equipment', 'EQ', 'Equipamentos'], ['locations', 'LC', 'Locações & Áreas']]],
    ['Administração', [['users', 'AD', 'Usuários & Perfis'], ['settings', 'CF', 'Configurações']]]
  ];
  const user = JSON.parse(localStorage.getItem('sfTorresUser') || '{}');
  const go = (key) => {
    window.location.hash = `#/${key}`;
    setRoute(key);
  };
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><LogoST /></div><div className="brand-text"><strong>SF TORRES</strong><span>Centro Operacional</span></div></div>
      <div className="search"><span>⌕</span><input placeholder="Buscar módulo, tela ou ação..." /></div>
      <nav className="nav">
        {groups.map(([title, items]) => (
          <div className="nav-group" key={title}>
            <div className="nav-title">{title}</div>
            {items.map(([key, code, label]) => <div key={key} className={`nav-item ${route === key ? 'active' : ''}`} onClick={() => go(key)}><span className="num">{code}</span>{label}</div>)}
          </div>
        ))}
      </nav>
      <div className="user-card">
        <div className="avatar">SF</div><div className="info"><b>{user.name || 'Administrador SF'}</b><span>{user.email || '@sftorres'}</span></div>
        <button className="logout" onClick={() => { localStorage.clear(); window.location.hash = '#/login'; }}>↪</button>
      </div>
    </aside>
  );
}

function Topbar({ route }) {
  const def = routes[route] || routes.dailyOps;
  const user = JSON.parse(localStorage.getItem('sfTorresUser') || '{}');
  return (
    <header className="topbar">
      <div className="crumbs"><span className="crumb-icon"><Icon name="grid" /></span><span>Painel Corporativo</span><span className="sep">›</span><span>{def.group}</span><span className="sep">›</span><span className="here">{def.title}</span></div>
      <div className="topbar-actions">
        <button className="btn-icon" title="Pesquisar (Ctrl+K)" onClick={() => triggerAction('Pesquisa')}><Icon name="search" /></button>
        <button className="btn-icon" title="Notificações" onClick={() => triggerAction('Notificações')}><Icon name="bell" /><span className="badge-dot" /></button>
        <button className="btn-icon" title="Mensagens" onClick={() => triggerAction('Mensagens')}><Icon name="message" /></button>
        <span className="topbar-divider" />
        <button className="btn-icon" title="Ajuda" onClick={() => triggerAction('Ajuda')}><Icon name="help" /></button>
        <div className="who"><div className="ava">SF</div><div className="meta"><b>{user.name}</b><span>{user.email}</span></div></div>
      </div>
    </header>
  );
}

function Screen({ route, notify }) {
  if (route === 'dailyOps') return <DailyOps notify={notify} />;
  if (route === 'measurement') return <Measurement notify={notify} />;
  if (route === 'schedules') return <Schedules notify={notify} />;
  if (route === 'users') return <Users notify={notify} />;
  if (crudConfigs[route]) return <CrudScreen config={crudConfigs[route]} notify={notify} />;
  if (route === 'dashboard') return <Dashboard />;
  if (route === 'tower') return <Tower />;
  if (route === 'productivity') return <Productivity />;
  if (route === 'map') return <OperationalMap />;
  if (route === 'reports') return <Reports />;
  if (route === 'settings') return <Settings notify={notify} />;
  return <Placeholder route={route} />;
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    api('/api/dashboard/summary').then((p) => setSummary(p.data)).catch((error) => triggerAction(error.message));
    api('/api/workOrders').then((p) => setOrders(p.data)).catch((error) => triggerAction(error.message));
  }, []);
  return (
    <>
      <PageHead title="Painel Corporativo" subtitle="Visão consolidada das operações, produtividade e faturamento." ghostAction="Exportar" action="Atualizar agora" onAction={() => { triggerAction('Painel atualizado'); api('/api/dashboard/summary').then((p) => setSummary(p.data)).catch((error) => triggerAction(error.message)); api('/api/workOrders').then((p) => setOrders(p.data)).catch((error) => triggerAction(error.message)); }} />
      <div className="kpi-grid">
        <Kpi icon="grid" label="Módulos ativos" value="10" delta="+1 desde o último ciclo" />
        <Kpi icon="users" label="Clientes ativos" value={summary?.activeClients ?? '-'} delta="contratos em operação" success />
        <Kpi icon="file" label="Serviços contratados" value="4" delta="tipos cadastrados" warning />
        <Kpi icon="star" label="Lideranças" value="2" delta="usuários líderes" />
      </div>
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-head"><h3>Ordens de serviço recentes</h3><div className="actions"><button className="btn btn-sm" onClick={() => triggerAction('Filtro de OS')}>Filtrar</button><button className="btn btn-sm btn-primary" onClick={() => { window.location.hash = '#/dailyOps'; }}>Nova OS</button></div></div>
          <DataTable columns={['OS', 'Cliente', 'Serviço', 'Equipamento', 'Equipe', 'Status', 'Prev.']} rows={orders.map((o) => [<span className="mono">{o.number}</span>, o.client, o.service, <span className="mono">{o.equipment || '-'}</span>, o.carrier || '-', <Pill value={o.status} />, date(o.date).slice(0, 5)])} />
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
  const rows = [
    ['0007-159', 'SEMP TCL', 'Pátio 3', 'Aliança · Desova', '23/07 08:00', '23/07 13:00', <Pill value="Em execução" />],
    ['0007-160', 'SEMP TCL', 'Pátio 2', 'Aliança · Desova 2', '24/07 07:00', '-', <Pill value="Aprovada" />],
    ['0007-157', 'ADF', 'Porto CSF', 'TransNorte · 3 op.', '21/07 06:00', '21/07 18:00', <Pill value="Concluída" />],
    ['0007-156', 'SEMP TCL', 'Pátio 3', '-', '-', '-', <Pill value="Paralisada" />],
    ['0007-155', 'ADF', 'CD Manaus', '-', '20/07 14:00', '20/07 17:00', <Pill value="Concluída" />]
  ];
  return <><PageHead title="Torre Operacional" subtitle="Painel em tempo real das operações em andamento e fila de execução." ghostAction="Tempo real" action="Atualizar" /><div className="kpi-grid"><Kpi icon="pulse" label="Operações ativas" value="04" delta="em campo agora" /><Kpi icon="clock" label="Na fila" value="07" delta="próximas 24h" warning /><Kpi icon="check" label="Concluídas hoje" value="12" delta="ontem: 09" success /><Kpi icon="alert" label="Alertas" value="02" delta="atenção da torre" danger /></div><Panel title="Fila de execução" actions={<><button className="btn btn-sm" onClick={() => triggerAction('Filtro da torre')}>Filtrar</button><button className="btn btn-sm btn-primary" onClick={() => triggerAction('Equipe acionada')}>Acionar equipe</button></>}><DataTable columns={['OS', 'Cliente', 'Local', 'Equipe', 'Início', 'Término', 'Status']} rows={rows} /></Panel></>;
}

function Schedules({ notify }) {
  const days = ['Seg 20', 'Ter 21', 'Qua 22', 'Qui 23', 'Sex 24', 'Sáb 25', 'Dom 26'];
  const fields = [['employee', 'Operador'], ['role', 'Função'], ['weekStart', 'Semana', 'date'], ['base', 'Base'], ['monday', 'Segunda'], ['tuesday', 'Terça'], ['wednesday', 'Quarta'], ['thursday', 'Quinta'], ['friday', 'Sexta'], ['saturday', 'Sábado'], ['sunday', 'Domingo'], ['status', 'Status', 'select', ['Programada', 'Pendente', 'Cancelada']]];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const load = () => { setLoading(true); api('/api/schedules').then((p) => setItems(p.data)).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  const save = async (data) => {
    await api(modal?.id ? `/api/schedules/${modal.id}` : '/api/schedules', { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    setModal(null);
    notify('Escala salva');
    load();
  };
  const shift = (value) => value ? <Pill value={value} /> : '-';
  const rows = loading ? [['Carregando dados do banco...', '', '', '', '', '', '', '', '']] : items.map((item) => [item.employee, item.role, shift(item.monday), shift(item.tuesday), shift(item.wednesday), shift(item.thursday), shift(item.friday), shift(item.saturday), shift(item.sunday)]);
  return <><PageHead title="Programação de Equipes" subtitle="Planejamento semanal de alocação de operadores, líderes e equipamentos por turno." ghostAction="Imprimir escala" action="Nova escala" onAction={() => setModal({ weekStart: '2026-07-20', base: 'Manaus / AM' })} /><div className="toolbar"><div className="filter"><label>Semana</label><input type="date" defaultValue="2026-07-20" /></div><div className="filter"><label>Base</label><select><option>Manaus / AM</option><option>Itacoatiara / AM</option></select></div><div className="filter"><label>Turno</label><select><option>Todos</option><option>Manhã</option><option>Tarde</option><option>Noite</option></select></div><span className="spacer" /><button className="btn btn-sm" onClick={() => notify('Semana anterior carregada')}><Icon name="refresh" /> Semana anterior</button><button className="btn btn-sm" onClick={() => notify('Semana seguinte carregada')}>Semana seguinte</button></div><Panel title="Escala · 20 a 26 de julho de 2026" actions={<><Pill value={`${items.length} programadas`} /> <Pill value="02 pendentes" /></>}><DataTable columns={['Operador', 'Função', ...days]} rows={rows} /></Panel>{modal && <Editor title={modal.id ? 'Editar escala' : 'Nova escala'} fields={fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}</>;
}

function Productivity() {
  return <><PageHead title="Produtividade" subtitle="Indicadores operacionais por equipe, cliente, equipamento e turno." ghostAction="Comparar períodos" action="Exportar relatório" /><div className="kpi-grid"><Kpi icon="chart" label="Toneladas / hora" value="8,4" delta="meta: 7,5" success /><Kpi icon="clock" label="Tempo médio OS" value="04:32" delta="Meta: 5h" /><Kpi icon="alert" label="Índice de paradas" value="3,8%" delta="-1,1 p.p." warning /><Kpi icon="file" label="OS concluídas" value="328" delta="mês corrente" /></div><div className="two-grid"><Panel title="Produtividade por equipe (últimos 7 dias)" padded><DataTable columns={['Equipe', 'Líder', 'OS', 'Ton.', 't/h', 'Efic.']} rows={[['Aliança - Desova', 'Joana Almeida', '48', '402,1', '9,1', <Pill value="112%" />], ['Aliança - Carga', 'Marcelo Souza', '36', '298,4', '8,2', <Pill value="101%" />], ['TransNorte 3 op.', 'Beatriz Lima', '22', '162,0', '7,6', <Pill value="94%" />], ['Mov. Sul', 'Ronaldo Pena', '14', '98,2', '6,8', <Pill value="84%" />]]} /></Panel><Panel title="Resumo por cliente" padded><DataTable columns={['Cliente', 'OS', 'Fat. (R$)']} rows={[['SEMP TCL', '218', '125.430,00'], ['ADF', '110', '58.820,00'], [<b>Total</b>, <b>328</b>, <b>184.250,00</b>]]} /></Panel></div></>;
}

function OperationalMap() {
  return <><PageHead title="Mapa Operacional" subtitle="Visualização georreferenciada das operações em andamento e pátios ativos." ghostAction="Centralizar" action="Atualizar mapa" /><div className="map-grid"><Panel title="Mapa · Manaus / AM" actions={<><button className="btn btn-sm" onClick={() => triggerAction('Camada satélite')}>Satélite</button><button className="btn btn-sm" onClick={() => triggerAction('Camada ruas')}>Ruas</button></>}><svg viewBox="0 0 1100 520" className="map-svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D9E2EC" strokeWidth="1" /></pattern></defs><rect width="1100" height="520" fill="url(#grid)" /><path d="M0 320 C 200 280, 380 360, 620 310 S 980 280, 1100 320 L 1100 400 C 980 380, 800 420, 580 380 S 240 360, 0 400 Z" fill="#BFD8E5" /><MapPoint x="180" y="120" w="220" h="130" title="Pátio 3 - SEMP TCL" status="OS 0007-159 ativa" color="#1F8A4C" /><MapPoint x="500" y="140" w="180" h="120" title="Pátio 2" status="2 OS agendadas" color="#C77700" /><MapPoint x="800" y="100" w="220" h="140" title="Porto CSF" status="Alerta · 1 parado" color="#B3261E" /><path d="M 290 160 Q 430 90 590 170 T 910 140" stroke="#1B3A6B" strokeWidth="3" fill="none" strokeDasharray="6 4" /></svg></Panel><Panel title="Pontos monitorados"><ul className="activity"><li><Pill value="OK" /><div><b>Pátio 3 - SEMP TCL</b><span>OS 0007-159 · Desova em curso</span></div></li><li><Pill value="Fila" /><div><b>Pátio 2</b><span>2 OS agendadas · 04h-06h</span></div></li><li><Pill value="Alerta" /><div><b>Porto CSF</b><span>Equipamento parado · 04h12</span></div></li></ul></Panel></div></>;
}

function Reports() {
  const cards = [['Ordens de Serviço', 'Listagem detalhada com filtros por período, cliente, status e equipamento.'], ['Produtividade por Equipe', 'Indicadores de t/h, eficiência, OS concluídas e tempo médio.'], ['Faturamento por Cliente', 'Totalizadores por cliente, contrato e centro de custo.'], ['Ocorrências Operacionais', 'Histórico de incidentes por tipo, equipe e local, com SLA.'], ['Movimentação de Pessoal', 'Admissões, desligamentos, férias, afastamentos por período.'], ['Equipamentos', 'Utilização, manutenções e vida útil por container/veículo.']];
  return <><PageHead title="Relatórios" subtitle="Modelos de relatórios prontos e exportação em PDF, XLSX e CSV." ghostAction="Configurar modelos" action="Gerar relatório" onAction={() => { downloadCsv('sf-torres-relatorios.csv', [['Relatório', 'Descrição'], ...cards]); triggerAction('Relatório gerado'); }} /><div className="section-list">{cards.map(([title, text], index) => <div className="section-card" key={title} onClick={() => { downloadCsv(`${title.toLowerCase().replaceAll(' ', '-')}.csv`, [['Relatório', 'Descrição'], [title, text]]); triggerAction(title); }}><div className="ico"><Icon name={['file', 'clock', 'money', 'box', 'users', 'monitor'][index]} /></div><div><h4>{title}</h4><p>{text}</p></div></div>)}</div></>;
}

function Users({ notify }) {
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
    fields: [['name', 'Nome'], ['email', 'E-mail'], ['password', 'Senha'], ['role', 'Perfil', 'select', ['Administrador', 'Operacional', 'Financeiro']], ['status', 'Status', 'select', ['Ativo', 'Inativo']]]
  }} notify={notify} />;
}

function Settings({ notify }) {
  const cards = [
    ['Empresa & Filiais', 'Razão social, CNPJ, endereço, marcas e logos.', 'building'],
    ['Sistema', 'Identidade visual, idioma, fuso horário e formatos.', 'gear'],
    ['Regras Operacionais', 'SLA, janelas de programação, alertas automáticos.', 'clock'],
    ['Integrações', 'ERP, fiscal, transportadoras, mensageria.', 'link'],
    ['Segurança & Auditoria', 'Senhas, 2FA, sessão, log de auditoria.', 'shield'],
    ['Notificações', 'Canais, gatilhos e destinatários por evento.', 'bell']
  ];
  const integrations = [
    ['ERP - SAP B1', 'REST', <span className="mono">https://erp.sftorres.com.br/api/v1</span>, '24/07/2026 09:30', <Pill value="Ativo" />, <><button className="btn btn-sm" onClick={() => triggerAction('Teste ERP')}>Testar</button> <button className="btn btn-sm" onClick={() => triggerAction('Editar ERP')}>Editar</button></>],
    ['Nota Fiscal eletrônica', 'SOAP', <span className="mono">https://nfe.sefaz.am.gov.br/ws</span>, '24/07/2026 09:25', <Pill value="Ativo" />, <><button className="btn btn-sm" onClick={() => triggerAction('Teste NF-e')}>Testar</button> <button className="btn btn-sm" onClick={() => triggerAction('Editar NF-e')}>Editar</button></>],
    ['Rastreamento transportadora - Aliança', 'Webhook', <span className="mono">https://track.alianca.com.br/hook</span>, '24/07/2026 09:42', <Pill value="Ativo" />, <><button className="btn btn-sm" onClick={() => triggerAction('Teste rastreamento')}>Testar</button> <button className="btn btn-sm" onClick={() => triggerAction('Editar rastreamento')}>Editar</button></>],
    ['WhatsApp Business', 'Official API', <span className="mono">https://graph.facebook.com/v18.0</span>, '-', <Pill value="Pendente" />, <button className="btn btn-sm btn-primary" onClick={() => triggerAction('Conexão WhatsApp')}>Conectar</button>],
    ['SMTP - envio de relatório', 'SMTP', <span className="mono">smtp.sftorres.com.br:587</span>, '23/07/2026 18:01', <Pill value="Ativo" />, <><button className="btn btn-sm" onClick={() => triggerAction('Teste SMTP')}>Testar</button> <button className="btn btn-sm" onClick={() => triggerAction('Editar SMTP')}>Editar</button></>]
  ];
  const saveSettings = async () => {
    const fields = [...document.querySelectorAll('[data-settings-form] .form-field')].reduce((acc, field) => {
      const label = field.querySelector('label')?.textContent?.trim();
      const input = field.querySelector('input, textarea, select');
      if (label && input) acc[label] = input.type === 'checkbox' ? input.checked : input.value;
      return acc;
    }, {});
    await api('/api/settings/company', { method: 'PUT', body: JSON.stringify(fields) });
    notify('Configurações salvas no banco');
  };
  return <>
    <PageHead title="Configurações" subtitle="Parâmetros gerais da empresa, do sistema, integrações e políticas operacionais." ghostAction="Restaurar padrões" action="Salvar alterações" onAction={saveSettings} />
    <div data-settings-form>
    <div className="section-list settings-jump">{cards.map(([name, text, icon]) => <div className="section-card" key={name} onClick={() => triggerAction(name)}><div className="ico"><Icon name={icon} /></div><div><h4>{name}</h4><p>{text}</p></div></div>)}</div>
    <Panel title="Empresa & Filiais" padded actions={<span className="soft">Identidade institucional usada em relatórios e PDF</span>}>
      <div className="form-grid">
        <Field label="Razão social" value="ST Serviços de Logística LTDA" />
        <Field label="Nome fantasia" value="SF TORRES" />
        <Field label="CNPJ" value="00.000.000/0001-00" />
        <Field label="Inscrição estadual" value="04.123.456-7" />
        <Field label="Endereço" value="Av. Brigadeiro, 4500 - Manaus/AM - CEP 69000-000" full />
        <Field label="Telefone principal" value="(92) 99267-8067" />
        <Field label="E-mail corporativo" value="sosthenes.torres@gmail.com" />
        <LogoUpload title="Logo principal exibida no sidebar" name="assets/logo-st.svg" desc='Marca "ST Serviços de Logística" (principal do sistema)' logo={<LogoST />} />
        <LogoUpload title="Logo secundária (login/institucional)" name="assets/logo-sm.svg" desc='Marca "SM Torres - Treinamentos" (exibida no login)' logo={<LogoSM small />} />
        <div className="form-field full"><label>Marca exibida na barra superior</label><div className="radio-row"><label><input type="radio" name="navbar-logo" defaultChecked /> Não exibir (texto)</label><label><input type="radio" name="navbar-logo" /> Logo ST</label><label><input type="radio" name="navbar-logo" /> Logo SM</label><label><input type="radio" name="navbar-logo" /> Ambas lado a lado</label></div></div>
      </div>
    </Panel>
    <Panel title="Sistema" padded><div className="form-grid"><Field label="Identificador interno" value="SF-TORRES-PROD" /><Field label="Ambiente" value="Produção" /><Field label="Idioma" value="Português (Brasil)" /><Field label="Fuso horário" value="America/Manaus (-04:00)" /><Field label="Moeda" value="BRL - Real Brasileiro" /><Field label="Formato de data" value="DD/MM/AAAA" /><Field label="Densidade da interface" value="Compacta (recomendada)" /><Field label="Tema" value="Azul institucional (atual)" /><div className="form-field full"><label>Identidade visual</label><div className="color-row"><ColorToken label="Primária" value="#1B3A6B" /><ColorToken label="Destaque" value="#C8102E" /><ColorToken label="Sucesso" value="#1F8A4C" /><ColorToken label="Erro" value="#B3261E" /></div></div></div></Panel>
    <Panel title="Regras Operacionais" padded><div className="form-grid"><Field label="SLA para aprovação de OS (horas)" value="4" type="number" /><Field label="SLA de conclusão de OS (horas)" value="24" type="number" /><Field label="Início da janela de programação" value="06:00" type="time" /><Field label="Fim da janela de programação" value="22:00" type="time" /><SwitchField label="Bloquear OS sem equipamento vinculado" text="Habilitado" /><SwitchField label="Notificar torre ao detectar paralisação > 30 min" text="Habilitado" /><Field label="Mensagem padrão em footer de relatórios" value="ST Serviços de Logística LTDA · CNPJ 00.000.000/0001-00 · Documento gerado em 24/07/2026 · Uso interno." full /></div></Panel>
    <Panel title="Integrações"><DataTable columns={['Integração', 'Tipo', 'Endpoint', 'Última sincronização', 'Status', 'Ações']} rows={integrations} /></Panel>
    <Panel title="Segurança & Auditoria" padded><div className="form-grid"><Field label="Política de senha" value="Padrão (mín. 8, 1 maiúscula, 1 número)" /><Field label="Expiração de senha (dias)" value="90" type="number" /><Field label="Tempo máximo de sessão (min)" value="120" type="number" /><Field label="Tentativas antes de bloqueio" value="5" type="number" /><SwitchField label="Autenticação em duas etapas (2FA)" text="Habilitado para administradores" /><SwitchField label="Log de auditoria detalhado" text="Registra toda ação em OS" /><Field label="IPs liberados para acesso administrativo" value="192.168.0.0/24&#10;10.0.0.0/8" full /></div></Panel>
    <Panel title="Notificações"><DataTable columns={['Evento', 'E-mail', 'Sistema', 'WhatsApp', 'Destinatários']} rows={[['Nova OS criada', <Switch />, <Switch />, <Switch off />, 'Líder de turno, Torre'], ['OS concluída', <Switch />, <Switch />, <Switch />, 'Cliente, Operações'], ['Ocorrência crítica', <Switch />, <Switch />, <Switch />, 'Diretoria, Torre'], ['Medição fechada', <Switch />, <Switch off />, <Switch off />, 'Financeiro']]} /></Panel>
    </div>
  </>;
}

function DailyOps({ notify }) {
  const fields = [['number', 'Número da OS'], ['client', 'Cliente'], ['equipment', 'Equipamento'], ['status', 'Status', 'select', ['Rascunho', 'Enviada', 'Aprovada', 'Em execucao', 'Concluida', 'Cancelada']], ['date', 'Data', 'date'], ['carrier', 'Transportador'], ['service', 'Serviço'], ['location', 'Local'], ['responsible', 'Responsável'], ['progress', 'Percentual', 'number'], ['priority', 'Prioridade', 'select', ['Baixa', 'Normal', 'Alta', 'Crítica']]];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [modal, setModal] = useState(null);
  const selected = items.find((i) => i.id === selectedId) || items[0];
  const counts = useMemo(() => items.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}), [items]);
  const load = () => { setLoading(true); api('/api/workOrders').then((p) => { setItems(p.data); setSelectedId((old) => old || p.data[0]?.id || ''); }).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  const save = async (data) => {
    await api(modal?.id ? `/api/workOrders/${modal.id}` : '/api/workOrders', { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    setModal(null); notify('OS salva'); load();
  };
  const remove = async () => {
    if (!selected || !confirm('Apagar esta OS?')) return;
    await api(`/api/workOrders/${selected.id}`, { method: 'DELETE' });
    notify('OS apagada'); setSelectedId(''); load();
  };
  return (
    <>
      <PageHead title="Operação Diária" subtitle="Gestão detalhada das OS com filtros, confirmação de equipe, horários e ocorrências." ghostActions={['Histórico', 'Exportar planilha']} action="Nova OS" onAction={() => setModal({})} />
      <div className="toolbar">
        <div className="filter"><label>Buscar</label><input type="text" placeholder="OS, cliente, equipamento..." /></div>
        <div className="filter"><label>Status</label><select><option>Todos</option><option>Rascunho</option><option>Enviada</option><option>Aprovada</option><option>Em execução</option><option>Concluída</option><option>Cancelada</option></select></div>
        <div className="filter"><label>Cliente</label><select><option>Todos</option><option>SEMP TCL</option><option>ADF</option></select></div>
        <div className="filter"><label>Período</label><select><option>Hoje</option><option>Esta semana</option><option>Este mês</option><option>Personalizado</option></select></div>
        <span className="spacer" />
        <span className="soft">{items.length} resultados</span>
      </div>
      <div className="kpi-grid">
        <Kpi icon="check" label="Aprovadas" value={counts.Aprovada || 0} delta="prontas para execução" success />
        <Kpi icon="clock" label="Enviadas" value={counts.Enviada || 0} delta="aguardando aprovação" warning />
        <Kpi icon="home" label="Em execução" value={counts['Em execucao'] || 0} delta="campo" />
        <Kpi icon="alert" label="Ocorrências" value="02" delta="em análise" danger />
      </div>
      <div className="detail">
        <div className="pane" style={{ overflow: 'hidden' }}>
          <div className="table-tools"><input className="search-input" placeholder="Filtrar resultados..." /><span className="spacer" /><span className="soft">Ordenar: <b>Data ↓</b></span></div>
          <div className="table-scroll"><table className="dtbl"><thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Status</th><th className="right">Data</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Carregando dados do banco...</td></tr> : items.map((i) => <tr key={i.id} className={selected?.id === i.id ? 'selected' : ''} onClick={() => setSelectedId(i.id)}><td className="mono">{i.number}</td><td>{i.client}</td><td className="mono">{i.equipment || '-'}</td><td><Pill value={i.status} /></td><td className="right">{date(i.date)}</td></tr>)}</tbody></table></div>
        </div>
        <div className="pane">{selected && <><div className="pane-head"><div><div className="eyebrow">Ordem de Serviço</div><div className="mono-title">OS {selected.number} · {selected.client}</div></div><div className="meta"><Pill value={selected.status} /></div></div><div className="tabs"><div className="tab active">Dados</div><div className="tab">Equipe</div><div className="tab">Horários</div><div className="tab">Ocorrências</div></div><div className="pane-body">{[['Data', date(selected.date)], ['Transportador', selected.carrier], ['Serviço', selected.service], ['Equipamento', selected.equipment || '-'], ['Posto', 'ARCONDICIONADO - 0 un.'], ['Responsável', selected.responsible], ['Percentual', `${selected.progress || 0}%`], ['Prioridade', selected.priority]].map(([k, v]) => <div className="field-row" key={k}><b>{k}</b><span>{v}</span></div>)}</div><div className="action-strip"><button className="btn" onClick={() => setModal(selected)}>Editar OS</button><button className="btn" onClick={() => triggerAction('Correção solicitada')}>Solicitar correção</button><button className="btn btn-success" onClick={async () => { await api('/api/occurrences', { method: 'POST', body: JSON.stringify({ workOrder: selected.number, type: 'Operacional', description: 'Ocorrência lançada pela tela de operação diária', status: 'Aberta' }) }); notify('Ocorrência registrada no banco'); }}>Lançar ocorrência</button><button className="btn btn-danger push" onClick={remove}>Apagar</button></div></>}</div>
      </div>
      {modal && <Editor title={modal.id ? 'Editar OS' : 'Nova OS'} fields={fields} initial={modal} onCancel={() => setModal(null)} onSave={save} />}
    </>
  );
}

function Measurement({ notify }) {
  return <>
    <CrudScreen
      config={{
        ...crudConfigs.measurement,
        noToolbar: true,
        panelActions: ({ items, load }) => <><button className="btn btn-sm" onClick={() => triggerAction('Filtro de medição')}>Filtrar</button><button className="btn btn-sm btn-primary" onClick={async () => { const pending = items.find((item) => item.status === 'Pendente') || items[0]; if (!pending) return notify('Nenhuma medição para fechar'); await api(`/api/measurements/${pending.id}`, { method: 'PUT', body: JSON.stringify({ ...pending, status: 'Fechada' }) }); notify('Medição fechada no banco'); load(); }}>Fechar medição</button></>
      }}
      notify={notify}
      beforeTable={<div className="kpi-grid"><Kpi icon="money" label="Faturado (mês)" value="R$ 184.250" delta="+12% MoM" success /><Kpi icon="clock" label="A faturar" value="R$ 42.180" delta="4 medições" /><Kpi icon="alert" label="Pendentes" value="02" delta="aguardando cliente" warning /><Kpi icon="check" label="Medições fechadas" value="38" delta="no mês" /></div>}
    />
  </>;
}

function CrudScreen({ config, notify, beforeTable }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const load = () => { setLoading(true); api(`${config.endpoint}${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((p) => setItems(p.data)).catch((error) => { setItems([]); notify(error.message); }).finally(() => setLoading(false)); };
  useEffect(load, [q]);
  const save = async (data) => {
    await api(modal?.id ? `${config.endpoint}/${modal.id}` : config.endpoint, { method: modal?.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    setModal(null); notify('Registro salvo'); load();
  };
  const remove = async (item) => {
    if (!confirm('Apagar este registro?')) return;
    await api(`${config.endpoint}/${item.id}`, { method: 'DELETE' });
    notify('Registro apagado'); load();
  };
  return (
    <>
      <PageHead title={config.title} subtitle={config.subtitle} ghostAction={config.ghostLabel} action={config.newLabel} onAction={() => setModal({})} />
      {config.toolbar && <Toolbar fields={config.toolbar} count={items.length} />}
      {!config.noToolbar && !config.toolbar && <div className="toolbar"><div className="filter"><label>Buscar</label><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." /></div><span className="spacer" /><span className="soft">{items.length} registros</span></div>}
      {beforeTable}
      <div className="panel" style={{ overflow: 'hidden' }}><div className="panel-head"><h3>{panelTitle(config, items.length)}</h3>{config.panelActions && <div className="actions">{typeof config.panelActions === 'function' ? config.panelActions({ items, load }) : config.panelActions}</div>}</div><div className="panel-body" style={{ padding: 0 }}><table className="dtbl"><thead><tr>{config.columns.map((c) => <th key={c.label} className={c.right ? 'right' : ''}>{c.label}</th>)}<th /></tr></thead><tbody>{loading ? <tr><td colSpan={config.columns.length + 1}>Carregando dados do banco...</td></tr> : items.map((item) => <tr key={item.id}>{config.columns.map((c) => <td key={c.label} className={`${c.mono ? 'mono' : ''} ${c.right ? 'right' : ''}`}>{c.render ? c.render(item) : item[c.key]}</td>)}<td className="right"><button className="btn btn-sm" onClick={() => setModal(item)}>Editar</button> <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>Apagar</button></td></tr>)}</tbody></table></div></div>
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
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([name]) => [name, initial?.[name] ?? ''])));
  const change = (name, value, type) => setForm((old) => ({ ...old, [name]: type === 'number' ? Number(value || 0) : value }));
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="btn btn-sm" onClick={onCancel}>Fechar</button></div>
        <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-grid">{fields.map(([name, label, type = 'text', options]) => <div className="form-field" key={name}><label>{label}</label>{type === 'select' ? <select value={form[name]} onChange={(e) => change(name, e.target.value, type)}>{options.map((o) => <option key={o}>{o}</option>)}</select> : <input type={type} value={form[name]} onChange={(e) => change(name, e.target.value, type)} />}</div>)}</div>
          <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancelar</button><button className="btn btn-primary">Salvar</button></div>
        </form>
      </div>
    </div>
  );
}

function Placeholder({ route }) {
  const def = routes[route] || routes.dashboard;
  return <><PageHead title={def.title} subtitle="Módulo estruturado dentro do app. A próxima etapa é ligar as regras específicas desse fluxo." /><div className="panel"><div className="panel-body">Este módulo já está dentro do sistema React. Os cadastros principais e a operação diária estão conectados ao backend.</div></div></>;
}

function Toolbar({ fields, count }) {
  return <div className="toolbar">{fields.map(([label, value, type]) => <div className="filter" key={label}><label>{label}</label>{type === 'select' ? <select>{value.map((option) => <option key={option}>{option}</option>)}</select> : <input type="text" placeholder={value} />}</div>)}<span className="spacer" /><span className="soft">{count} registros</span></div>;
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

function Field({ label, value, type = 'text', full }) {
  if (String(value).includes('&#10;')) {
    return <div className={`form-field ${full ? 'full' : ''}`}><label>{label}</label><textarea defaultValue={value.replaceAll('&#10;', '\n')} /></div>;
  }
  return <div className={`form-field ${full ? 'full' : ''}`}><label>{label}</label><input type={type} defaultValue={value} /></div>;
}

function LogoUpload({ title, name, desc, logo }) {
  return <div className="form-field"><label>{title}</label><div className="logo-upload"><div className="logo-preview">{logo}</div><div className="logo-copy"><b>{name}</b><span>{desc}</span></div><button className="btn btn-sm" onClick={() => triggerAction('Troca de logo')}>Trocar arquivo</button></div></div>;
}

function ColorToken({ label, value }) {
  return <label className="color-token"><span style={{ background: value }} />{label}: <input type="color" defaultValue={value} /></label>;
}

function Switch({ off = false }) {
  return <label className="switch"><input type="checkbox" defaultChecked={!off} /><span className="slider" /></label>;
}

function SwitchField({ label, text }) {
  return <div className="form-field"><label>{label}</label><div className="row"><Switch /> <span className="soft">{text}</span></div></div>;
}

function PageHead({ title, subtitle, action, ghostAction, ghostActions, onAction }) {
  const ghosts = ghostActions || (ghostAction ? [ghostAction] : []);
  return <div className="page-head"><div><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{(action || ghosts.length > 0) && <div className="head-actions">{ghosts.map((label) => <button key={label} className="btn btn-ghost" onClick={() => triggerAction(label)}>{label}</button>)}{action && <button className="btn btn-primary" onClick={onAction || (() => triggerAction(action))}>{action}</button>}</div>}</div>;
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

function LogoST() {
  return <svg viewBox="0 0 56 56" width="28" height="28"><circle cx="28" cy="14" r="8" fill="#0F2447" /><path d="M14 38 Q28 22 42 38 L37 46 Q28 36 19 46 Z" fill="#0F2447" /><text x="14" y="44" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="800" fontSize="18" fill="#FFFFFF">ST</text></svg>;
}

function LogoSM({ small = false }) {
  return <svg viewBox="0 0 260 130" width={small ? 120 : 220} height={small ? 60 : 110}><path d="M40 95 Q130 5 230 80" stroke="#C8102E" strokeWidth="6" fill="none" /><path d="M40 110 Q130 30 230 100" stroke="#1A2E6D" strokeWidth="6" fill="none" /><text x="48" y="90" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="900" fontSize="86" fill="#1A2E6D" stroke="#FFFFFF" strokeWidth="2">SM</text><text x="58" y="118" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="900" fontSize="30" fill="#C8102E">TORRES</text></svg>;
}

createRoot(document.getElementById('root')).render(<App />);
