const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./utils/env');
const { errorHandler, notFound } = require('./middlewares/error');
const authRoutes = require('./routes/auth');
const resourceRoutes = require('./routes/resources');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SF TORRES API</title>
  <style>
    body{font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;color:#15243b;margin:0;padding:40px}
    main{max-width:760px;margin:auto;background:#fff;border:1px solid #d8e0ec;border-radius:8px;padding:28px;box-shadow:0 10px 30px rgba(20,40,80,.08)}
    h1{margin:0 0 8px;font-size:26px} p{color:#53657f;line-height:1.5}
    code{background:#eef3fa;border:1px solid #d8e0ec;border-radius:5px;padding:2px 6px}
    li{margin:8px 0}
  </style>
</head>
<body>
  <main>
    <h1>SF TORRES API</h1>
    <p>Backend rodando. Para abrir o sistema visual, use <code>http://127.0.0.1:8080/</code>.</p>
    <ul>
      <li><a href="/health">GET /health</a></li>
      <li><code>POST /api/auth/login</code></li>
      <li><code>GET /api/dashboard/summary</code></li>
      <li><code>GET /api/workOrders</code></li>
      <li><code>GET /api/clients</code></li>
    </ul>
  </main>
</body>
</html>`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sf-torres-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', resourceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
