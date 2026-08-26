const fmtDate = (value) => {
  if (!value) return '-';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const fmtMoney = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

function pillClass(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('ativo') || value.includes('aprov') || value.includes('fech') || value.includes('operacional') || value.includes('dispon')) return 'pill-success';
  if (value.includes('pend') || value.includes('envi') || value.includes('ferias') || value.includes('manut') || value.includes('normal')) return 'pill-warning';
  if (value.includes('cancel') || value.includes('afast') || value.includes('erro')) return 'pill-danger';
  if (value.includes('exec') || value.includes('uso') || value.includes('cadastro')) return 'pill-info';
  return 'pill-neutral';
}

function statusPill(status) {
  return `<span class="pill ${pillClass(status)} pill-dot">${escapeHtml(status || '-')}</span>`;
}

function toast(message, type = 'info') {
  let node = document.querySelector('.sf-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'sf-toast';
    document.body.appendChild(node);
  }
  node.className = `sf-toast show ${type}`;
  node.textContent = message;
  setTimeout(() => node.classList.remove('show'), 2600);
}

function openModal(title, fields, initial, onSubmit) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="btn btn-sm" data-close>Fechar</button>
      </div>
      <form class="modal-body">
        <div class="form-grid">
          ${fields.map((field) => `
            <div class="form-field ${field.full ? 'full' : ''}">
              <label>${escapeHtml(field.label)}</label>
              ${field.type === 'select'
                ? `<select name="${field.name}">${field.options.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}</select>`
                : `<input name="${field.name}" type="${field.type || 'text'}" ${field.step ? `step="${field.step}"` : ''}>`}
            </div>
          `).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  const form = overlay.querySelector('form');

  fields.forEach((field) => {
    const input = form.elements[field.name];
    if (input) input.value = initial?.[field.name] ?? field.defaultValue ?? '';
  });

  overlay.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => overlay.remove());
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    fields.forEach((field) => {
      if (field.type === 'number') data[field.name] = Number(data[field.name] || 0);
      if (field.type === 'uppercaseText') data[field.name] = String(data[field.name] || '').toUpperCase();
    });
    await onSubmit(data);
    overlay.remove();
  });
}

function buildCrudPage(config) {
  const state = { items: [], q: '' };
  const view = document.getElementById('view');

  const render = () => {
    view.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${config.title}</h1>
          <p class="subtitle">${config.subtitle}</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" data-refresh>Atualizar</button>
          <button class="btn btn-primary" data-new>${config.newLabel}</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="filter">
          <label>Buscar</label>
          <input type="text" value="${escapeHtml(state.q)}" placeholder="${config.searchPlaceholder || 'Buscar...'}" data-search>
        </div>
        <span class="spacer"></span>
        <span style="font-size:12px;color:var(--c-text-soft);margin-right:6px">${state.items.length} registros</span>
      </div>
      <div class="panel" style="overflow:hidden">
        <div class="panel-body" style="padding:0">
          <table class="dtbl">
            <thead><tr>${config.columns.map((column) => `<th class="${column.right ? 'right' : ''}">${column.label}</th>`).join('')}<th></th></tr></thead>
            <tbody>
              ${state.items.map((item) => `
                <tr>
                  ${config.columns.map((column) => `<td class="${column.mono ? 'mono' : ''} ${column.right ? 'right' : ''}">${column.render ? column.render(item) : escapeHtml(item[column.key])}</td>`).join('')}
                  <td class="right">
                    <button class="btn btn-sm" data-edit="${item.id}">Editar</button>
                    <button class="btn btn-sm btn-danger" data-delete="${item.id}">Apagar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    view.querySelector('[data-search]').addEventListener('input', (event) => {
      state.q = event.target.value;
      load();
    });
    view.querySelector('[data-refresh]').addEventListener('click', load);
    view.querySelector('[data-new]').addEventListener('click', () => editItem(null));
    view.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
      editItem(state.items.find((item) => item.id === button.dataset.edit));
    }));
    view.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => removeItem(button.dataset.delete)));
  };

  const load = async () => {
    const query = state.q ? `?q=${encodeURIComponent(state.q)}` : '';
    const payload = await sfApi(`${config.endpoint}${query}`);
    state.items = payload.data;
    render();
  };

  const editItem = (item) => {
    openModal(item ? config.editTitle : config.newLabel, config.fields, item, async (data) => {
      await sfApi(item ? `${config.endpoint}/${item.id}` : config.endpoint, {
        method: item ? 'PUT' : 'POST',
        body: JSON.stringify(data)
      });
      toast('Registro salvo');
      await load();
    });
  };

  const removeItem = async (id) => {
    if (!confirm('Apagar este registro?')) return;
    await sfApi(`${config.endpoint}/${id}`, { method: 'DELETE' });
    toast('Registro apagado');
    await load();
  };

  load().catch((error) => {
    view.innerHTML = `<div class="panel"><div class="panel-body">${escapeHtml(error.message)}</div></div>`;
  });
}

async function renderDailyOps() {
  const view = document.getElementById('view');
  const payload = await sfApi('/api/workOrders');
  const items = payload.data;
  const selected = items[0];
  const counts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const renderDetail = (item) => {
    const detail = document.getElementById('woDetail');
    detail.innerHTML = `
      <div class="pane-head">
        <div>
          <div style="font-size:11.5px;color:var(--c-text-soft);letter-spacing:.4px;text-transform:uppercase">Ordem de Serviço</div>
          <div style="font-weight:700;font-family:var(--ff-mono);font-size:14px">OS ${escapeHtml(item.number)} · ${escapeHtml(item.client)}</div>
        </div>
        <div class="meta">${statusPill(item.status)}</div>
      </div>
      <div class="tabs"><div class="tab active">Dados</div><div class="tab">Equipe</div><div class="tab">Horários</div><div class="tab">Ocorrências</div></div>
      <div class="pane-body">
        <div class="field-row"><b>Data</b><span>${fmtDate(item.date)}</span></div>
        <div class="field-row"><b>Transportador</b><span>${escapeHtml(item.carrier)}</span></div>
        <div class="field-row"><b>Serviço</b><span>${escapeHtml(item.service)}</span></div>
        <div class="field-row"><b>Equipamento</b><span class="mono">${escapeHtml(item.equipment || '-')}</span></div>
        <div class="field-row"><b>Local</b><span>${escapeHtml(item.location || '-')}</span></div>
        <div class="field-row"><b>Responsável</b><span>${escapeHtml(item.responsible || '-')}</span></div>
        <div class="field-row"><b>Percentual</b><span>${escapeHtml(item.progress || 0)}%</span></div>
        <div class="field-row"><b>Prioridade</b><span>${statusPill(item.priority)}</span></div>
      </div>
      <div style="border-top:1px solid var(--c-border);padding:12px 14px;background:#FAFCFF;display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn" data-edit-os="${item.id}">Editar OS</button>
        <button class="btn btn-success" data-occurrence>Nova ocorrência</button>
        <button class="btn btn-danger" style="margin-left:auto" data-delete-os="${item.id}">Apagar</button>
      </div>
    `;
    detail.querySelector('[data-edit-os]').addEventListener('click', () => editWorkOrder(item));
    detail.querySelector('[data-delete-os]').addEventListener('click', () => deleteWorkOrder(item.id));
    detail.querySelector('[data-occurrence]').addEventListener('click', () => toast('Ocorrência registrada no histórico da OS'));
  };

  view.innerHTML = `
    <div class="page-head">
      <div><h1>Operação Diária</h1><p class="subtitle">Gestão detalhada das OS com filtros, confirmação de equipe, horários e ocorrências.</p></div>
      <div class="head-actions"><button class="btn btn-ghost" data-refresh>Atualizar</button><button class="btn btn-primary" data-new-os>Nova OS</button></div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi kpi-success"><div class="ico">✓</div><div><div class="label">Aprovadas</div><div class="value">${String(counts.Aprovada || 0).padStart(2, '0')}</div><div class="delta">prontas para execução</div></div></div>
      <div class="kpi kpi-warning"><div class="ico">◷</div><div><div class="label">Enviadas</div><div class="value">${String(counts.Enviada || 0).padStart(2, '0')}</div><div class="delta">aguardando aprovação</div></div></div>
      <div class="kpi"><div class="ico">→</div><div><div class="label">Em execução</div><div class="value">${String(counts['Em execucao'] || counts['Em execução'] || 0).padStart(2, '0')}</div><div class="delta">campo</div></div></div>
      <div class="kpi kpi-danger"><div class="ico">!</div><div><div class="label">Ocorrências</div><div class="value">02</div><div class="delta">em análise</div></div></div>
    </div>
    <div class="detail">
      <div class="pane" style="overflow:hidden">
        <div class="table-tools"><input class="search-input" placeholder="Filtrar resultados..." data-filter-os><span class="spacer" style="flex:1"></span><span style="font-size:11.5px;color:var(--c-text-soft)">Ordenar: <b>Data ↓</b></span></div>
        <div class="table-scroll" style="border-top:1px solid var(--c-border)">
          <table class="dtbl">
            <thead><tr><th>OS</th><th>Cliente</th><th>Equipamento</th><th>Status</th><th class="right">Data</th></tr></thead>
            <tbody id="osTbody">
              ${items.map((item, index) => `
                <tr data-id="${item.id}" class="${index === 0 ? 'selected' : ''}">
                  <td class="mono">${escapeHtml(item.number)}</td>
                  <td>${escapeHtml(item.client)}</td>
                  <td class="mono">${escapeHtml(item.equipment || '-')}</td>
                  <td>${statusPill(item.status)}</td>
                  <td class="right">${fmtDate(item.date)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="pane" id="woDetail"></div>
    </div>
  `;

  const selectItem = (id) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    view.querySelectorAll('#osTbody tr').forEach((row) => row.classList.toggle('selected', row.dataset.id === id));
    renderDetail(item);
  };

  view.querySelectorAll('#osTbody tr').forEach((row) => row.addEventListener('click', () => selectItem(row.dataset.id)));
  view.querySelector('[data-new-os]').addEventListener('click', () => editWorkOrder(null));
  view.querySelector('[data-refresh]').addEventListener('click', renderDailyOps);
  if (selected) renderDetail(selected);
}

const workOrderFields = [
  { name: 'number', label: 'Numero da OS' },
  { name: 'client', label: 'Cliente' },
  { name: 'equipment', label: 'Equipamento' },
  { name: 'status', label: 'Status', type: 'select', options: ['Rascunho', 'Enviada', 'Aprovada', 'Em execucao', 'Concluida', 'Cancelada'] },
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'carrier', label: 'Transportador' },
  { name: 'service', label: 'Servico' },
  { name: 'location', label: 'Local' },
  { name: 'responsible', label: 'Responsavel' },
  { name: 'progress', label: 'Percentual', type: 'number' },
  { name: 'priority', label: 'Prioridade', type: 'select', options: ['Baixa', 'Normal', 'Alta', 'Critica'] }
];

function editWorkOrder(item) {
  openModal(item ? 'Editar OS' : 'Nova OS', workOrderFields, item, async (data) => {
    await sfApi(item ? `/api/workOrders/${item.id}` : '/api/workOrders', {
      method: item ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    toast('OS salva');
    await renderDailyOps();
  });
}

async function deleteWorkOrder(id) {
  if (!confirm('Apagar esta OS?')) return;
  await sfApi(`/api/workOrders/${id}`, { method: 'DELETE' });
  toast('OS apagada');
  await renderDailyOps();
}

const crudPages = {
  clients: {
    title: 'Clientes',
    subtitle: 'Cadastro de clientes, contratos, contatos e condições comerciais.',
    newLabel: 'Novo cliente',
    editTitle: 'Editar cliente',
    endpoint: '/api/clients',
    searchPlaceholder: 'Razão social, CNPJ, cidade...',
    columns: [
      { label: 'Razão social', key: 'name', render: (item) => `<b>${escapeHtml(item.name)}</b><div style="font-size:11.5px;color:var(--c-text-soft)">${escapeHtml(item.city || '')} / ${escapeHtml(item.state || '')}</div>` },
      { label: 'CNPJ', key: 'cnpj', mono: true },
      { label: 'Contato', key: 'contact', render: (item) => `${escapeHtml(item.contact || '-')} · ${escapeHtml(item.phone || '-')}` },
      { label: 'Contrato', key: 'contract', mono: true },
      { label: 'Faturado', key: 'monthRevenue', right: true, render: (item) => fmtMoney(item.monthRevenue) },
      { label: 'Status', key: 'status', render: (item) => statusPill(item.status) }
    ],
    fields: [
      { name: 'name', label: 'Nome fantasia' }, { name: 'legalName', label: 'Razao social' },
      { name: 'cnpj', label: 'CNPJ' }, { name: 'contact', label: 'Contato' },
      { name: 'phone', label: 'Telefone' }, { name: 'city', label: 'Cidade' },
      { name: 'state', label: 'UF' }, { name: 'contract', label: 'Contrato' },
      { name: 'monthRevenue', label: 'Faturado no mes', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Inativo'] }
    ]
  },
  employees: {
    title: 'Funcionários',
    subtitle: 'Cadastro de colaboradores, funções, documentos e vínculo com equipes.',
    newLabel: 'Novo funcionário',
    editTitle: 'Editar funcionário',
    endpoint: '/api/employees',
    columns: [
      { label: '#', key: 'code', mono: true }, { label: 'Nome', key: 'name' }, { label: 'CPF', key: 'cpf', mono: true },
      { label: 'Função', key: 'role' }, { label: 'Equipe', key: 'team' },
      { label: 'Local', key: 'location' }, { label: 'Turno', key: 'shift' },
      { label: 'Admissão', key: 'admissionDate', render: (item) => fmtDate(item.admissionDate) },
      { label: 'Status', key: 'status', render: (item) => statusPill(item.status) }
    ],
    fields: [
      { name: 'code', label: 'Codigo' }, { name: 'name', label: 'Nome' }, { name: 'cpf', label: 'CPF' },
      { name: 'role', label: 'Funcao' }, { name: 'team', label: 'Equipe' },
      { name: 'location', label: 'Local', type: 'uppercaseText' }, { name: 'shift', label: 'Turno', type: 'uppercaseText' },
      { name: 'admissionDate', label: 'Admissao', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Ferias', 'Afastado', 'Cadastro'] }
    ]
  },
  services: {
    title: 'Serviços',
    subtitle: 'Catálogo de tipos de serviço contratados, com tarifas e unidades de medição.',
    newLabel: 'Novo serviço',
    editTitle: 'Editar serviço',
    endpoint: '/api/services',
    columns: [
      { label: 'Código', key: 'code', mono: true }, { label: 'Descrição', key: 'description' },
      { label: 'Unidade', key: 'unit' }, { label: 'Tarifa', key: 'price', right: true, render: (item) => fmtMoney(item.price) },
      { label: 'Categoria', key: 'category' }
    ],
    fields: [
      { name: 'code', label: 'Codigo' }, { name: 'description', label: 'Descricao' },
      { name: 'unit', label: 'Unidade' }, { name: 'price', label: 'Tarifa', type: 'number', step: '0.01' },
      { name: 'category', label: 'Categoria' }
    ]
  },
  equipment: {
    title: 'Equipamentos',
    subtitle: 'Cadastro de containers, veículos e equipamentos operacionais com status.',
    newLabel: 'Novo equipamento',
    editTitle: 'Editar equipamento',
    endpoint: '/api/equipment',
    columns: [
      { label: 'Código', key: 'code', mono: true }, { label: 'Tipo', key: 'type' }, { label: 'Marca / Modelo', key: 'model' },
      { label: 'Capacidade', key: 'capacity' }, { label: 'Última manutenção', key: 'lastMaintenance', render: (item) => fmtDate(item.lastMaintenance) },
      { label: 'Status', key: 'status', render: (item) => statusPill(item.status) }
    ],
    fields: [
      { name: 'code', label: 'Codigo' }, { name: 'type', label: 'Tipo' }, { name: 'model', label: 'Marca / Modelo' },
      { name: 'capacity', label: 'Capacidade' }, { name: 'lastMaintenance', label: 'Ultima manutencao', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: ['Disponivel', 'Em uso', 'Manutencao'] }
    ]
  }
};

window.SFSystem = {
  render(route) {
    if (route === 'dailyOps') return renderDailyOps();
    if (crudPages[route]) return buildCrudPage(crudPages[route]);
    return null;
  }
};
