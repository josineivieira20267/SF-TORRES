const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const publicUser = (user) => {
  const { passwordHash, ...safe } = user;
  return safe;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeEnvironment = (value) => value === 'talents' ? 'talents' : 'operational';

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const environment = normalizeEnvironment(req.query.environment || req.user?.environment);
    if (hasDatabaseUrl) {
      const users = await prisma.user.findMany({ where: { environment }, orderBy: { createdAt: 'desc' } });
      return res.json({ data: users.map(publicUser), meta: { total: users.length, limit: users.length, offset: 0 } });
    }
    const db = await readDb();
    const users = (db.users || []).filter((item) => normalizeEnvironment(item.environment) === environment);
    return res.json({ data: users.map(publicUser), meta: { total: users.length, limit: users.length, offset: 0 } });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const passwordHash = bcrypt.hashSync(req.body.password || '123456', 10);
    const data = {
      name: String(req.body.name || '').trim(),
      email: normalizeEmail(req.body.email),
      role: req.body.role || 'Operacional',
      status: req.body.status || 'Ativo',
      environment: normalizeEnvironment(req.body.environment || req.query.environment || req.user?.environment),
      permissions: req.body.permissions || null,
      passwordHash
    };

    if (hasDatabaseUrl) {
      const user = await prisma.user.create({ data });
      return res.status(201).json({ data: publicUser(user) });
    }

    const user = await updateDb((db) => {
      const item = { id: `usr_${Date.now()}`, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.users.push(item);
      return item;
    });
    return res.status(201).json({ data: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.name !== undefined) data.name = String(data.name || '').trim();
    if (data.email !== undefined) data.email = normalizeEmail(data.email);
    if (data.password) {
      data.passwordHash = bcrypt.hashSync(data.password, 10);
    }
    delete data.password;
    if (data.permissions === undefined) delete data.permissions;

    if (hasDatabaseUrl) {
      const user = await prisma.user.update({ where: { id: req.params.id }, data });
      return res.json({ data: publicUser(user) });
    }

    const user = await updateDb((db) => {
      const index = db.users.findIndex((item) => item.id === req.params.id);
      if (index === -1) return null;
      db.users[index] = { ...db.users[index], ...data, updatedAt: new Date().toISOString() };
      return db.users[index];
    });
    if (!user) return res.status(404).json({ error: { message: 'Usuario nao encontrado' } });
    return res.json({ data: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (hasDatabaseUrl) {
      await prisma.user.delete({ where: { id: req.params.id } });
      return res.status(204).send();
    }
    const removed = await updateDb((db) => {
      const index = db.users.findIndex((item) => item.id === req.params.id);
      if (index === -1) return null;
      return db.users.splice(index, 1)[0];
    });
    if (!removed) return res.status(404).json({ error: { message: 'Usuario nao encontrado' } });
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
