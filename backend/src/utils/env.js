require('dotenv').config();

const parseOrigins = (value) => {
  if (!value) return true;
  return value.split(',').map((origin) => origin.trim()).filter(Boolean);
};

const env = {
  PORT: Number(process.env.PORT || 3333),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  CORS_ORIGIN: parseOrigins(process.env.CORS_ORIGIN || 'http://127.0.0.1:8080,http://localhost:8080,http://127.0.0.1:5173,http://localhost:5173')
};

module.exports = { env };
