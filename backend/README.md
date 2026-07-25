# Backend SF TORRES

API local para o Centro Operacional SF TORRES.

## Executar

```bash
cd backend
npm install
npm run dev
```

A API sobe em `http://127.0.0.1:3333`.

## PostgreSQL

O backend usa PostgreSQL automaticamente quando `DATABASE_URL` estiver configurada.
Sem `DATABASE_URL`, ele continua usando o JSON local para desenvolvimento.

```bash
npm run db:migrate
npm run db:seed
```

No Render, use:

- Build Command: `npm install --production=false`
- Pre-Deploy Command: `npx prisma migrate deploy && npx prisma db seed`
- Start Command: `npm run start`

## Login de desenvolvimento

- E-mail: `admin@sftorres.local`
- Senha: `admin123`

## Rotas

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/summary`
- CRUD protegido por token:
  - `/api/clients`
  - `/api/employees`
  - `/api/services`
  - `/api/equipment`
  - `/api/locations`
  - `/api/workOrders`
  - `/api/measurements`

Use o header:

```http
Authorization: Bearer <token>
```

As listagens aceitam `q`, `limit`, `offset` e filtros por campos simples, por exemplo:

```http
GET /api/workOrders?q=semp&status=Aprovada
```
