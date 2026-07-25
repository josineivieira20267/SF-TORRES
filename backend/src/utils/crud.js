const { nanoid } = require('nanoid');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function applyQuery(items, query, searchableFields) {
  let result = [...items];

  if (query.q) {
    const needle = normalize(query.q);
    result = result.filter((item) =>
      searchableFields.some((field) => normalize(item[field]).includes(needle))
    );
  }

  for (const [key, value] of Object.entries(query)) {
    if (['q', 'limit', 'offset'].includes(key) || value === undefined || value === '') continue;
    result = result.filter((item) => normalize(item[key]) === normalize(value));
  }

  const total = result.length;
  const offset = Math.max(Number(query.offset || 0), 0);
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  result = result.slice(offset, offset + limit);

  return { data: result, meta: { total, limit, offset } };
}

function buildWhere(query, searchableFields) {
  const where = {};

  if (query.q) {
    where.OR = searchableFields.map((field) => ({
      [field]: { contains: String(query.q), mode: 'insensitive' }
    }));
  }

  for (const [key, value] of Object.entries(query)) {
    if (['q', 'limit', 'offset'].includes(key) || value === undefined || value === '') continue;
    where[key] = String(value);
  }

  return where;
}

function createController(collection, searchableFields = ['name', 'code', 'description'], prismaModel = collection) {
  return {
    async list(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          const where = buildWhere(req.query, searchableFields);
          const skip = Math.max(Number(req.query.offset || 0), 0);
          const take = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
          const [data, total] = await Promise.all([
            prisma[prismaModel].findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
            prisma[prismaModel].count({ where })
          ]);
          return res.json({ data, meta: { total, limit: take, offset: skip } });
        }

        const db = await readDb();
        res.json(applyQuery(db[collection] || [], req.query, searchableFields));
      } catch (error) {
        next(error);
      }
    },

    async get(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          const item = await prisma[prismaModel].findUnique({ where: { id: req.params.id } });
          if (!item) return res.status(404).json({ error: { message: 'Registro nao encontrado' } });
          return res.json({ data: item });
        }

        const db = await readDb();
        const item = (db[collection] || []).find((entry) => entry.id === req.params.id);
        if (!item) return res.status(404).json({ error: { message: 'Registro nao encontrado' } });
        return res.json({ data: item });
      } catch (error) {
        return next(error);
      }
    },

    async create(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          const item = await prisma[prismaModel].create({ data: req.body });
          return res.status(201).json({ data: item });
        }

        const now = new Date().toISOString();
        const item = { id: nanoid(10), ...req.body, createdAt: now, updatedAt: now };
        await updateDb((db) => {
          db[collection] = db[collection] || [];
          db[collection].push(item);
        });
        res.status(201).json({ data: item });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          const item = await prisma[prismaModel].update({ where: { id: req.params.id }, data: req.body });
          return res.json({ data: item });
        }

        const item = await updateDb((db) => {
          const list = db[collection] || [];
          const index = list.findIndex((entry) => entry.id === req.params.id);
          if (index === -1) return null;
          list[index] = { ...list[index], ...req.body, id: list[index].id, updatedAt: new Date().toISOString() };
          return list[index];
        });
        if (!item) return res.status(404).json({ error: { message: 'Registro nao encontrado' } });
        return res.json({ data: item });
      } catch (error) {
        return next(error);
      }
    },

    async remove(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          await prisma[prismaModel].delete({ where: { id: req.params.id } });
          return res.status(204).send();
        }

        const removed = await updateDb((db) => {
          const list = db[collection] || [];
          const index = list.findIndex((entry) => entry.id === req.params.id);
          if (index === -1) return null;
          const [item] = list.splice(index, 1);
          return item;
        });
        if (!removed) return res.status(404).json({ error: { message: 'Registro nao encontrado' } });
        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    }
  };
}

module.exports = { createController };
