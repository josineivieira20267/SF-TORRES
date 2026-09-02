const { nanoid } = require('nanoid');
const { readDb, updateDb } = require('../db/jsonStore');
const { prisma, hasDatabaseUrl } = require('../db/prisma');

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function applyQuery(items, query, searchableFields, options = {}) {
  let result = [...items];
  const dateField = options.dateField;
  const skipKeys = new Set(['q', 'limit', 'offset', 'from', 'to', ...(options.filterKeys || [])]);

  if (query.q) {
    const needle = normalize(query.q);
    result = result.filter((item) =>
      searchableFields.some((field) => normalize(item[field]).includes(needle))
    );
  }

  if (dateField && (query.from || query.to)) {
    result = result.filter((item) => {
      const value = String(item[dateField] || '');
      if (!value) return false;
      if (query.from && value < String(query.from)) return false;
      if (query.to && value > String(query.to)) return false;
      return true;
    });
  }

  if (options.applyJsonFilters) {
    result = options.applyJsonFilters(result, query, options.request) || result;
  }

  for (const [key, value] of Object.entries(query)) {
    if (skipKeys.has(key) || value === undefined || value === '') continue;
    result = result.filter((item) => normalize(item[key]) === normalize(value));
  }

  const total = result.length;
  const offset = Math.max(Number(query.offset || 0), 0);
  const limit = Math.min(Math.max(Number(query.limit || 100), 1), 500);
  result = result.slice(offset, offset + limit);

  return { data: result, meta: { total, limit, offset } };
}

function buildWhere(query, searchableFields, options = {}) {
  const where = {};
  const dateField = options.dateField;
  const skipKeys = new Set(['q', 'limit', 'offset', 'from', 'to', ...(options.filterKeys || [])]);

  if (query.q) {
    where.OR = searchableFields.map((field) => ({
      [field]: { contains: String(query.q), mode: 'insensitive' }
    }));
  }

  if (dateField && (query.from || query.to)) {
    where[dateField] = {};
    if (query.from) where[dateField].gte = String(query.from);
    if (query.to) where[dateField].lte = String(query.to);
  }

  for (const [key, value] of Object.entries(query)) {
    if (skipKeys.has(key) || value === undefined || value === '') continue;
    where[key] = String(value);
  }

  return where;
}

function createController(collection, searchableFields = ['name', 'code', 'description'], prismaModel = collection, options = {}) {
  return {
    async list(req, res, next) {
      try {
        if (hasDatabaseUrl) {
          let where = buildWhere(req.query, searchableFields, options);
          if (options.applyPrismaWhere) where = options.applyPrismaWhere(where, req.query, req) || where;
          const skip = Math.max(Number(req.query.offset || 0), 0);
          const take = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
          const [data, total] = await Promise.all([
            prisma[prismaModel].findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
            prisma[prismaModel].count({ where })
          ]);
          const extraMeta = options.metaPrisma ? await options.metaPrisma(req.query, req) : {};
          return res.json({ data, meta: { total, limit: take, offset: skip, ...extraMeta } });
        }

        const db = await readDb();
        const result = applyQuery(db[collection] || [], req.query, searchableFields, { ...options, request: req });
        const extraMeta = options.metaJson ? await options.metaJson(db[collection] || [], req.query, req) : {};
        res.json({ ...result, meta: { ...result.meta, ...extraMeta } });
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
        let body = collection === 'workOrders' && req.user
          ? { ...req.body, createdBy: req.body.createdBy || req.user.name || req.user.email }
          : req.body;
        if (options.prepareCreate) body = await options.prepareCreate(body, req);
        if (hasDatabaseUrl) {
          const item = await prisma[prismaModel].create({ data: body });
          return res.status(201).json({ data: item });
        }

        const now = new Date().toISOString();
        const item = { id: nanoid(10), ...body, createdAt: now, updatedAt: now };
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
        let body = req.body;
        if (options.prepareUpdate) body = await options.prepareUpdate(body, req);
        if (hasDatabaseUrl) {
          const item = await prisma[prismaModel].update({ where: { id: req.params.id }, data: body });
          return res.json({ data: item });
        }

        const item = await updateDb((db) => {
          const list = db[collection] || [];
          const index = list.findIndex((entry) => entry.id === req.params.id);
          if (index === -1) return null;
          list[index] = { ...list[index], ...body, id: list[index].id, updatedAt: new Date().toISOString() };
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

module.exports = { createController, buildWhere, normalize };
