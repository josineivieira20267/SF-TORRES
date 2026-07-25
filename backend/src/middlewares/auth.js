const jwt = require('jsonwebtoken');
const { env } = require('../utils/env');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: { message: 'Token ausente' } });
  }

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Token invalido ou expirado' } });
  }
}

module.exports = { requireAuth };
