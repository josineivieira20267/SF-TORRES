/* =========================================================
   SF TORRES — App.js
   Roteador simples baseado em hash. Carrega as views e
   mantém o estado de navegação (sidebar + breadcrumbs).
   ========================================================= */

const ROUTES = {
  dashboard:    { title:'Painel Corporativo', crumb:['Painel Corporativo'], file:'pages/dashboard.html' },
  tower:        { title:'Torre Operacional', crumb:['Painel Corporativo','Operações','Torre Operacional'], file:'pages/tower.html' },
  dailyOps:     { title:'Operação Diária', crumb:['Painel Corporativo','Operações','Operação Diária'], file:'pages/daily-ops.html' },
  schedules:    { title:'Programação de Equipes', crumb:['Painel Corporativo','Operações','Programação de Equipes'], file:'pages/schedules.html' },
  productivity: { title:'Produtividade', crumb:['Painel Corporativo','Gestão','Produtividade'], file:'pages/productivity.html' },
  employees:    { title:'Funcionários', crumb:['Painel Corporativo','Gestão','Funcionários'], file:'pages/employees.html' },
  map:          { title:'Mapa Operacional', crumb:['Painel Corporativo','Gestão','Mapa Operacional'], file:'pages/map.html' },
  measurement:  { title:'Medição & Faturamento', crumb:['Painel Corporativo','Movimentações','Medição & Faturamento'], file:'pages/measurement.html' },
  reports:      { title:'Relatórios', crumb:['Painel Corporativo','Movimentações','Relatórios'], file:'pages/reports.html' },
  clients:      { title:'Clientes', crumb:['Painel Corporativo','Cadastros','Clientes'], file:'pages/clients.html' },
  services:     { title:'Serviços', crumb:['Painel Corporativo','Cadastros','Serviços'], file:'pages/services.html' },
  equipment:    { title:'Equipamentos', crumb:['Painel Corporativo','Cadastros','Equipamentos'], file:'pages/equipment.html' },
  locations:    { title:'Locações & Áreas', crumb:['Painel Corporativo','Cadastros','Locações & Áreas'], file:'pages/locations.html' },
  users:        { title:'Usuários & Perfis', crumb:['Painel Corporativo','Administração','Usuários & Perfis'], file:'pages/users.html' },
  settings:     { title:'Configurações', crumb:['Painel Corporativo','Administração','Configurações'], file:'pages/settings.html' }
};

const view  = document.getElementById('view');
const crumbs = document.getElementById('crumbs');
const sessionToken = localStorage.getItem('sfTorresToken');

if (!sessionToken) {
  location.href = 'login.html';
}

const sessionUser = (() => {
  try { return JSON.parse(localStorage.getItem('sfTorresUser') || 'null'); }
  catch (_) { return null; }
})();

if (sessionUser) {
  document.querySelectorAll('.who .meta b, .user-card .info b').forEach((node) => {
    node.textContent = sessionUser.name;
  });
  document.querySelectorAll('.who .meta span, .user-card .info span').forEach((node) => {
    node.textContent = sessionUser.email;
  });
}

function renderCrumbs(route){
  const def = ROUTES[route] || ROUTES.dashboard;
  const parts = ['Painel Corporativo'].concat(def.crumb.slice(1));
  crumbs.innerHTML = parts.map((p,i)=>{
    const isLast = i === parts.length-1;
    const icon = i===0 ? `<span class="crumb-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg></span>` : '';
    return (isLast
      ? `${icon}<span class="here">${p}</span>`
      : `${icon}<a href="#/${Object.keys(ROUTES)[i+1]||'dashboard'}">${p}</a><span class="sep">›</span>`);
  }).join('');
}

function highlightNav(route){
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.classList.toggle('active', el.dataset.route === route);
  });
}

async function loadRoute(route){
  const def = ROUTES[route] || ROUTES.dashboard;
  try{
    const resp = await fetch(def.file);
    if(!resp.ok) throw new Error('404');
    view.innerHTML = await resp.text();
  }catch(e){
    view.innerHTML = `
      <div class="page-head"><h1>Página indisponível</h1></div>
      <div class="panel"><div class="panel-body">Não foi possível carregar <code>${def.file}</code>.</div></div>`;
  }
  renderCrumbs(route);
  highlightNav(route);
  document.title = `SF TORRES — ${def.title}`;
  if(typeof window.postRender === 'function'){
    try{ window.postRender(route); }catch(_){}
  }
  if(window.SFSystem?.render){
    try{ await window.SFSystem.render(route); }catch(error){
      view.innerHTML = `<div class="panel"><div class="panel-body">${error.message}</div></div>`;
    }
  }
  // rolagem ao topo em cada troca
  document.querySelector('.main').scrollTop = 0;
}

function toggleSub(group){
  const item = document.querySelector(`.nav-item[data-group="${group}"]`);
  const sub   = document.querySelector(`.sub[data-sub="${group}"]`);
  if(!item||!sub) return;
  const open = item.classList.toggle('open');
  sub.style.display = open ? '' : 'none';
}

document.addEventListener('click',(ev)=>{
  const item = ev.target.closest('.nav-item');
  if(!item) return;
  if(item.classList.contains('has-sub')){
    const g = item.dataset.group;
    toggleSub(g);
    return;
  }
  if(item.dataset.route){
    location.hash = '#/'+item.dataset.route;
  }
});

window.addEventListener('hashchange', ()=>{
  const r = (location.hash||'#/dashboard').slice(2).split('/')[0];
  loadRoute(r);
});

document.getElementById('logoutBtn')?.addEventListener('click', ()=>{
  if(confirm('Sair da conta SF TORRES?')){
    localStorage.removeItem('sfTorresToken');
    localStorage.removeItem('sfTorresUser');
    location.href='login.html';
  }
});

// Boot
loadRoute((location.hash||'#/dailyOps').slice(2).split('/')[0] || 'dailyOps');
