const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db/prisma');
const { requireAuth } = require('../middlewares/auth');
const { normalize } = require('../utils/crud');

const router = express.Router();

const statuses = [
  'Novo cadastro',
  'Disponivel',
  'Em analise',
  'Entrevista',
  'Aprovado',
  'Banco de reserva',
  'Contratado',
  'Reprovado',
  'Indisponivel',
  'Arquivado'
];

const candidateSchema = z.object({
  fullName: z.string().min(3),
  cpf: z.string().min(11),
  rg: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  zipCode: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  courses: z.array(z.record(z.any())).optional().default([]),
  experiences: z.array(z.record(z.any())).optional().default([]),
  lastRole: z.string().optional().nullable(),
  desiredRole: z.string().optional().nullable(),
  startAvailability: z.string().optional().nullable(),
  scheduleAvailability: z.array(z.string()).optional().default([]),
  salaryExpectation: z.coerce.number().optional().nullable(),
  hasCnh: z.coerce.boolean().optional().default(false),
  cnhCategory: z.string().optional().nullable(),
  cnhNumber: z.string().optional().nullable(),
  cnhExpiration: z.string().optional().nullable(),
  resume: z.record(z.any()).optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  status: z.string().optional().default('Novo cadastro'),
  relatedCompany: z.string().optional().default('Banco Geral'),
  consentStorage: z.coerce.boolean().optional().default(false),
  consentDate: z.string().optional().nullable(),
  consentOrigin: z.string().optional().nullable(),
  source: z.string().optional().nullable()
});

function cpfDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function canTalent(req, level = 'view') {
  const role = normalize(req.user?.role);
  if (role.includes('administrador')) return true;
  const permissions = req.user?.permissions || {};
  const values = ['talentDashboard', 'talents', 'talentNew', 'talentReports'].map((key) => permissions[key]).filter(Boolean);
  if (level === 'view') return values.some((value) => ['view', 'edit'].includes(value));
  return values.some((value) => value === 'edit');
}

function requireTalent(level = 'view') {
  return (req, res, next) => {
    if (req.user?.environment !== 'talents') {
      return res.status(403).json({ error: { message: 'Acesse o ambiente Banco de Talentos para usar este modulo' } });
    }
    if (canTalent(req, level)) return next();
    return res.status(403).json({ error: { message: 'Sem permissao para acessar o Banco de Talentos' } });
  };
}

function normalizeCandidate(data, req) {
  const cpf = cpfDigits(data.cpf);
  return {
    ...data,
    cpf,
    fullName: String(data.fullName || '').trim(),
    email: data.email || null,
    status: data.status || 'Novo cadastro',
    relatedCompany: data.relatedCompany || 'Banco Geral',
    salaryExpectation: data.salaryExpectation === '' || data.salaryExpectation === undefined ? null : data.salaryExpectation,
    registeredBy: data.registeredBy || req.user?.name || req.user?.email || null
  };
}

function history(action, candidate, req, extra = {}) {
  return prisma.talentCandidateHistory.create({
    data: {
      candidateId: candidate.id,
      action,
      userId: req.user?.id || null,
      userName: req.user?.name || req.user?.email || null,
      ...extra
    }
  });
}

function buildCandidateWhere(query) {
  const where = {};
  const and = [];

  if (query.q) {
    const q = String(query.q);
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { cpf: { contains: cpfDigits(q) || q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { desiredRole: { contains: q, mode: 'insensitive' } },
      { lastRole: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { education: { contains: q, mode: 'insensitive' } },
      { internalNotes: { contains: q, mode: 'insensitive' } }
    ];
  }

  ['status', 'education', 'city', 'state', 'startAvailability', 'relatedCompany', 'cnhCategory'].forEach((key) => {
    if (query[key] && !['Todos', 'Todas'].includes(query[key])) where[key] = String(query[key]);
  });

  if (query.desiredRole && !['Todos', 'Todas'].includes(query.desiredRole)) {
    where.desiredRole = { contains: String(query.desiredRole), mode: 'insensitive' };
  }

  if (query.hasCnh && query.hasCnh !== 'Todos') where.hasCnh = query.hasCnh === 'Sim' || query.hasCnh === 'true';
  if (query.salaryMin) and.push({ salaryExpectation: { gte: Number(query.salaryMin) } });
  if (query.salaryMax) and.push({ salaryExpectation: { lte: Number(query.salaryMax) } });
  if (query.from || query.to) {
    and.push({
      createdAt: {
        ...(query.from ? { gte: new Date(`${query.from}T00:00:00`) } : {}),
        ...(query.to ? { lte: new Date(`${query.to}T23:59:59`) } : {})
      }
    });
  }
  if (and.length) where.AND = and;
  return where;
}

router.use(requireAuth);
router.use(requireTalent('view'));

router.get('/summary', async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [total, available, analysis, selected, hired, recent, latest, roles, movements, statusBreakdown, cityBreakdown, educationBreakdown, cnhCount] = await Promise.all([
      prisma.talentCandidate.count(),
      prisma.talentCandidate.count({ where: { status: 'Disponivel' } }),
      prisma.talentCandidate.count({ where: { status: 'Em analise' } }),
      prisma.talentCandidate.count({ where: { status: { in: ['Aprovado', 'Banco de reserva'] } } }),
      prisma.talentCandidate.count({ where: { status: 'Contratado' } }),
      prisma.talentCandidate.count({ where: { createdAt: { gte: since } } }),
      prisma.talentCandidate.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
      prisma.talentCandidate.groupBy({ by: ['desiredRole'], _count: { desiredRole: true }, where: { desiredRole: { not: null } }, orderBy: { _count: { desiredRole: 'desc' } }, take: 6 }),
      prisma.talentCandidateHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { candidate: { select: { fullName: true } } } }),
      prisma.talentCandidate.groupBy({ by: ['status'], _count: { status: true }, orderBy: { _count: { status: 'desc' } } }),
      prisma.talentCandidate.groupBy({ by: ['city'], _count: { city: true }, where: { city: { not: null } }, orderBy: { _count: { city: 'desc' } }, take: 6 }),
      prisma.talentCandidate.groupBy({ by: ['education'], _count: { education: true }, where: { education: { not: null } }, orderBy: { _count: { education: 'desc' } }, take: 6 }),
      prisma.talentCandidate.count({ where: { hasCnh: true } })
    ]);
    res.json({ data: { total, available, analysis, selected, hired, recent, latest, roles, movements, statusBreakdown, cityBreakdown, educationBreakdown, cnhCount } });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const skip = Math.max(Number(req.query.offset || 0), 0);
    const take = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const sort = ['fullName', 'createdAt', 'startAvailability', 'salaryExpectation', 'status'].includes(req.query.sort) ? req.query.sort : 'createdAt';
    const direction = req.query.direction === 'asc' ? 'asc' : 'desc';
    const where = buildCandidateWhere(req.query);
    const [data, total] = await Promise.all([
      prisma.talentCandidate.findMany({ where, skip, take, orderBy: { [sort]: direction } }),
      prisma.talentCandidate.count({ where })
    ]);
    res.json({ data, meta: { total, limit: take, offset: skip } });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireTalent('edit'), async (req, res, next) => {
  try {
    const parsed = candidateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: 'Dados do candidato invalidos', details: parsed.error.flatten() } });
    const data = normalizeCandidate(parsed.data, req);
    const candidate = await prisma.talentCandidate.create({ data });
    await history('Candidato cadastrado', candidate, req, { toStatus: candidate.status });
    res.status(201).json({ data: candidate });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: { message: 'Ja existe candidato cadastrado com este CPF' } });
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const candidate = await prisma.talentCandidate.findUnique({
      where: { id: req.params.id },
      include: { history: { orderBy: { createdAt: 'desc' } } }
    });
    if (!candidate) return res.status(404).json({ error: { message: 'Candidato nao encontrado' } });
    res.json({ data: candidate });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireTalent('edit'), async (req, res, next) => {
  try {
    const current = await prisma.talentCandidate.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: { message: 'Candidato nao encontrado' } });
    const parsed = candidateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: 'Dados do candidato invalidos', details: parsed.error.flatten() } });
    const data = normalizeCandidate({ ...current, ...parsed.data }, req);
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.history;
    const candidate = await prisma.talentCandidate.update({ where: { id: req.params.id }, data });
    await history(current.status !== candidate.status ? 'Status alterado' : 'Cadastro editado', candidate, req, {
      fromStatus: current.status,
      toStatus: candidate.status
    });
    res.json({ data: candidate });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: { message: 'Ja existe candidato cadastrado com este CPF' } });
    next(error);
  }
});

router.patch('/:id/status', requireTalent('edit'), async (req, res, next) => {
  try {
    const status = String(req.body.status || '');
    if (!statuses.includes(status)) return res.status(400).json({ error: { message: 'Status invalido' } });
    const current = await prisma.talentCandidate.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: { message: 'Candidato nao encontrado' } });
    const candidate = await prisma.talentCandidate.update({
      where: { id: req.params.id },
      data: { status, archivedAt: status === 'Arquivado' ? new Date() : null }
    });
    await history(status === 'Arquivado' ? 'Candidato arquivado' : 'Status alterado', candidate, req, {
      fromStatus: current.status,
      toStatus: status,
      note: req.body.note || null
    });
    res.json({ data: candidate });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
