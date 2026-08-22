# SF TORRES — Centro Operacional (v2)

Sistema corporativo de gestão operacional para **ST Serviços de Logística** e **SM Torres — Treinamentos Empresariais**. Foco em Ordens de Serviço, operação diária, programação de equipes, produtividade, medição & faturamento.

> **Stack:** HTML estático + JS vanilla (sem dependências). Recarregável, responsivo, auditável. Pode rodar em qualquer servidor HTTP (Nginx, Apache, IIS, Node static).

---

## 🗂️ Estrutura

```
sf_v2/
├── assets/
│   ├── logo-st.svg        # Logo principal do sistema (sidebar)
│   ├── logo-sm.svg        # Logo institucional (login)
│   └── symbol-st.svg      # Favicon
├── css/
│   └── styles.css         # Tema institucional (azul-marinho, sóbrio)
├── js/
│   └── app.js             # Roteador hash-based + sidebar
├── pages/                 # Cada módulo do sistema
│   ├── dashboard.html     # Painel Corporativo
│   ├── daily-ops.html     # Operação Diária (tela principal)
│   ├── tower.html         # Torre Operacional
│   ├── schedules.html     # Programação de Equipes
│   ├── productivity.html  # Indicadores
│   ├── employees.html     # Cadastro de funcionários
│   ├── reports.html       # Relatórios (atalhos)
│   ├── clients.html       # Cadastro de clientes
│   ├── services.html      # Tipos de serviço
│   ├── equipment.html     # Equipamentos
│   ├── users.html         # Usuários & Perfis
│   └── settings.html      # ⚙️ Configurações
├── index.html             # Shell principal (sidebar + topbar + view)
└── login.html             # Tela de login (split azul / branco)
```

---

## ▶️ Como executar localmente

Qualquer servidor estático serve. Sugestões:

```bash
# Opção 1 — Python
python3 -m http.server 8080

# Opção 2 — Node
npx serve sf_v2 -l 8080

# Abra http://localhost:8080
```

A página inicial é `index.html`. As demais views são carregadas dinamicamente via fetch (roteador em `js/app.js`).

### Backend local

```bash
cd backend
npm install
npm run dev
```

A API fica em `http://127.0.0.1:3333`.

### Frontend sistema

```bash
cd frontend
npm install
npm run dev
```

O sistema fica em `http://127.0.0.1:5173`.

### PostgreSQL no Render

Recomendado para producao:

1. Crie um banco em **New > PostgreSQL** no Render.
2. Crie o backend como **Web Service** apontando para a pasta `backend`.
3. Configure no backend:
   - Build Command: `npm install --production=false`
   - Pre-Deploy Command: `npx prisma migrate deploy && npx prisma db seed`
   - Start Command: `npm run start`
   - Environment Variable: `DATABASE_URL` com a **Internal Database URL** do PostgreSQL.
   - Environment Variable: `CORS_ORIGIN` com a URL publica do frontend.
4. Crie o frontend como **Static Site** apontando para a pasta `frontend`.
5. Configure no frontend:
   - Build Command: `npm install --production=false && npm run build`
   - Publish Directory: `dist`
   - Environment Variable: `VITE_API_URL` com a URL publica do backend.

O arquivo `render.yaml` tambem foi incluido como blueprint de referencia.

Login inicial:

- E-mail: `admin@sftorres.local`
- Senha: `admin123`

Rotas principais:

- `POST /api/auth/login`
- `GET /api/dashboard/summary`
- CRUD: `/api/clients`, `/api/employees`, `/api/services`, `/api/equipment`, `/api/locations`, `/api/workOrders`, `/api/measurements`

---

## 🎨 Identidade visual

| Token        | Valor       | Uso                                     |
|--------------|-------------|-----------------------------------------|
| Primária     | `#1B3A6B`   | Botões, header, ícones, foco            |
| Primária esc.| `#0F2447`   | Sidebar, títulos                        |
| Destaque     | `#C8102E`   | Logo SM, alertas críticos raros         |
| Sucesso      | `#1F8A4C`   | Status "aprovada", KPIs ok              |
| Erro         | `#B3261E`   | Cancelada, ocorrências                  |
| Aviso        | `#C77700`   | Pendente, enviados                      |

**Logos:**
- **Sidebar:** `assets/logo-st.svg` — “ST Serviços de Logística” (identidade principal do software).
- **Login:** `assets/logo-sm.svg` — “SM TORRES — Treinamentos Empresariais” (identidade institucional/marca mãe).

Ambas podem ser trocadas em **Configurações → Empresa & Filiais**.

---

## 🧭 Navegação

A sidebar segue o agrupamento:

- **Principal** — Painel Corporativo
- **Operações** — Torre, Operação Diária, Programação de Equipes
- **Gestão** — Produtividade, Funcionários
- **Movimentações** — Relatórios
- **Cadastros** — Clientes, Serviços, Equipamentos
- **Administração** — Usuários & Perfis, **Configurações**

A topbar mostra o caminho atual (breadcrumbs), busca rápida, notificações e perfil do usuário.

---

## ⚙️ Configurações (módulo novo)

Substitui a antiga tela “sem função”. Inclui:

1. **Empresa & Filiais** — razão social, CNPJ, endereço, **upload das duas logos**, escolha da marca exibida na topbar.
2. **Sistema** — idioma, fuso, moeda, formato de data, **tema** (primária/destaque/sucesso/erro personalizáveis), densidade.
3. **Regras Operacionais** — SLAs, janelas de programação, bloqueios automáticos.
4. **Integrações** — ERP, NF-e, transportadora, WhatsApp, SMTP (com botões Testar/Editar/Conectar).
5. **Segurança & Auditoria** — política de senha, 2FA, IPs liberados, log de auditoria.
6. **Notificações** — matriz evento × canal (e-mail / sistema / WhatsApp) com switches.

---

## 🔌 Próximos passos (integração)

Esta é uma camada visual totalmente compatível com o pacote original (`SF TORRES/backend` + `database.json`). Para ligar ao backend:

- Substituir os dados mockados pelos endpoints existentes em `backend/src/routes.js`.
- Configurar `js/api.js` apontando para o mesmo host do backend.
- Migrar login HTML para o JWT de autenticação já previsto em `backend/src/auth.js`.

---

## 📜 Licença

Uso interno — ST Serviços de Logística · SM Torres. Todos os direitos reservados.
