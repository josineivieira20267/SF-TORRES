require('dotenv').config();

const DEFAULT_CORS_ORIGINS = [
  'https://sf-torres-web.onrender.com',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://localhost:5173'
];

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

const parseOrigins = (value) => {
  const configured = String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set([...configured, ...DEFAULT_CORS_ORIGINS.map(normalizeOrigin)])];
};

const env = {
  PORT: Number(process.env.PORT || 3333),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  CORS_ORIGIN: parseOrigins(process.env.CORS_ORIGIN)
};

module.exports = { env, normalizeOrigin };
