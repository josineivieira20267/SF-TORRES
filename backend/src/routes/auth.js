const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { readDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { env } = require('../utils/env');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { message: 'Dados de login invalidos', details: parsed.error.flatten() } });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = hasDatabaseUrl
      ? await prisma.user.findUnique({ where: { email } })
      : (await readDb()).users.find((item) => item.email.toLowerCase() === email);
    if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
      return res.status(401).json({ error: { message: 'E-mail ou senha invalidos' } });
    }

    const payload = { id: user.id, name: user.name, email: user.email, role: user.role, permissions: user.permissions || null };
    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ data: { user: payload, token } });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

module.exports = router;
