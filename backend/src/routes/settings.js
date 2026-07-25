const express = require('express');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/:key', async (req, res, next) => {
  try {
    if (hasDatabaseUrl) {
      const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
      return res.json({ data: setting?.value || null });
    }

    const db = await readDb();
    const setting = (db.settings || []).find((item) => item.key === req.params.key);
    return res.json({ data: setting?.value || null });
  } catch (error) {
    return next(error);
  }
});

router.put('/:key', async (req, res, next) => {
  try {
    if (hasDatabaseUrl) {
      const setting = await prisma.setting.upsert({
        where: { key: req.params.key },
        update: { value: req.body },
        create: { key: req.params.key, value: req.body }
      });
      return res.json({ data: setting.value });
    }

    const value = await updateDb((db) => {
      db.settings = db.settings || [];
      const index = db.settings.findIndex((item) => item.key === req.params.key);
      const now = new Date().toISOString();
      if (index === -1) {
        db.settings.push({ id: `set_${Date.now()}`, key: req.params.key, value: req.body, createdAt: now, updatedAt: now });
      } else {
        db.settings[index] = { ...db.settings[index], value: req.body, updatedAt: now };
      }
      return req.body;
    });
    return res.json({ data: value });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
