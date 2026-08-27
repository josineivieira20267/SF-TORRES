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
  cpf: z.string().optional().nullable(),
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

const jobSchema = z.object({
  title: z.string().min(3),
  department: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  companyUnit: z.string().optional().default('SF TORRES'),
  contractType: z.string().optional().nullable(),
  workMode: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  responsibilitiesText: z.string().optional().nullable(),
  requirementsText: z.string().optional().nullable(),
  benefitsText: z.string().optional().nullable(),
  responsibilities: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  benefits: z.array(z.string()).optional().default([]),
  salaryRange: z.string().optional().nullable(),
  status: z.string().optional().default('Rascunho'),
  expiresAt: z.string().optional().nullable()
});

const applicationSchema = z.object({
  jobId: z.string().min(1),
  fullName: z.string().min(3),
  cpf: z.string().optional().nullable(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  education: z.string().optional().nullable(),
  experienceYears: z.string().optional().nullable(),
  lastRole: z.string().optional().nullable(),
  desiredSalary: z.coerce.number().optional().nullable(),
  availableStartDate: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  portfolioUrl: z.string().optional().nullable(),
  resume: z.record(z.any()).optional().nullable(),
  coverLetter: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  consentStorage: z.coerce.boolean().optional().default(false)
});

const allowedResumeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

function cpfDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function canTalent(req, level = 'view') {
  const role = normalize(req.user?.role);
  if (role.includes('administrador')) return true;
  const permissions = req.user?.permissions || {};
  const values = ['talentDashboard', 'talents', 'talentNew', 'talentJobs', 'talentApplications', 'talentReports'].map((key) => permissions[key]).filter(Boolean);
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

function textLines(value) {
  return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

function normalizeResume(resume) {
  if (!resume || typeof resume !== 'object') return null;
  const name = String(resume.name || '').trim();
  const type = String(resume.type || '').trim();
  const content = String(resume.content || '').trim();
  const size = Number(resume.size || 0);
  if (!name || !content) return name ? { name, type: type || null, size: Number.isFinite(size) ? size : null } : null;
  if (size > 4 * 1024 * 1024 || content.length > 6 * 1024 * 1024) {
    const error = new Error('Curriculo deve ter no maximo 4 MB');
    error.status = 400;
    throw error;
  }
  if (type && !allowedResumeTypes.has(type)) {
    const error = new Error('Envie o curriculo em PDF, DOC ou DOCX');
    error.status = 400;
    throw error;
  }
  return {
    name,
    type: type || null,
    size: Number.isFinite(size) ? size : null,
    content,
    uploadedAt: resume.uploadedAt || new Date().toISOString()
  };
}

function resumeMeta(resume) {
  if (!resume || typeof resume !== 'object') return null;
  return {
    name: resume.name || null,
    type: resume.type || null,
    size: resume.size || null,
    uploadedAt: resume.uploadedAt || null
  };
}

function normalizeJob(data, req) {
  const payload = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.department !== undefined) payload.department = data.department || null;
  if (data.location !== undefined) payload.location = data.location || null;
  if (data.companyUnit !== undefined) payload.companyUnit = data.companyUnit || 'SF TORRES';
  if (data.contractType !== undefined) payload.contractType = data.contractType || null;
  if (data.workMode !== undefined) payload.workMode = data.workMode || null;
  if (data.summary !== undefined) payload.summary = data.summary || null;
  if (data.responsibilities !== undefined || data.responsibilitiesText !== undefined) payload.responsibilities = data.responsibilities?.length ? data.responsibilities : textLines(data.responsibilitiesText);
  if (data.requirements !== undefined || data.requirementsText !== undefined) payload.requirements = data.requirements?.length ? data.requirements : textLines(data.requirementsText);
  if (data.benefits !== undefined || data.benefitsText !== undefined) payload.benefits = data.benefits?.length ? data.benefits : textLines(data.benefitsText);
  if (data.salaryRange !== undefined) payload.salaryRange = data.salaryRange || null;
  if (data.status !== undefined) {
    payload.status = data.status || 'Rascunho';
    payload.publishedAt = payload.status === 'Publicada' ? new Date() : null;
  }
  if (data.expiresAt !== undefined) payload.expiresAt = data.expiresAt || null;
  if (req.user && data.createdBy === undefined) payload.createdBy = req.user?.name || req.user?.email || null;
  return payload;
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

function appendReportWhere(where, extra) {
  return { ...where, AND: [...(Array.isArray(where.AND) ? where.AND : []), extra] };
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function monthlyCounts(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const date = new Date(row.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([month, total]) => ({ month, total }));
}

router.get('/public/jobs', async (req, res, next) => {
  try {
    const jobs = await prisma.talentJob.findMany({
      where: { status: 'Publicada' },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        department: true,
        location: true,
        companyUnit: true,
        contractType: true,
        workMode: true,
        summary: true,
        responsibilities: true,
        requirements: true,
        benefits: true,
        salaryRange: true,
        expiresAt: true,
        publishedAt: true
      }
    });
    res.json({ data: jobs, meta: { total: jobs.length, limit: jobs.length, offset: 0 } });
  } catch (error) {
    next(error);
  }
});

router.post('/public/applications', async (req, res, next) => {
  try {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: 'Dados da candidatura invalidos', details: parsed.error.flatten() } });
    const job = await prisma.talentJob.findFirst({ where: { id: parsed.data.jobId, status: 'Publicada' } });
    if (!job) return res.status(404).json({ error: { message: 'Vaga nao encontrada ou nao publicada' } });
    if (!parsed.data.consentStorage) return res.status(400).json({ error: { message: 'Consentimento LGPD obrigatorio para enviar candidatura' } });
    const application = await prisma.talentApplication.create({
      data: {
        ...parsed.data,
        cpf: parsed.data.cpf ? cpfDigits(parsed.data.cpf) : null,
        resume: normalizeResume(parsed.data.resume),
        status: 'Nova'
      }
    });
    res.status(201).json({ data: { id: application.id, status: application.status } });
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);
router.use(requireTalent('view'));

router.get('/jobs', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status && req.query.status !== 'Todos') where.status = String(req.query.status);
    if (req.query.q) {
      where.OR = [
        { title: { contains: String(req.query.q), mode: 'insensitive' } },
        { department: { contains: String(req.query.q), mode: 'insensitive' } },
        { location: { contains: String(req.query.q), mode: 'insensitive' } }
      ];
    }
    const data = await prisma.talentJob.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { applications: true } } } });
    res.json({ data, meta: { total: data.length, limit: data.length, offset: 0 } });
  } catch (error) {
    next(error);
  }
});

router.post('/jobs', requireTalent('edit'), async (req, res, next) => {
  try {
    const parsed = jobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: 'Dados da vaga invalidos', details: parsed.error.flatten() } });
    const job = await prisma.talentJob.create({ data: normalizeJob(parsed.data, req) });
    res.status(201).json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.put('/jobs/:id', requireTalent('edit'), async (req, res, next) => {
  try {
    const parsed = jobSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { message: 'Dados da vaga invalidos', details: parsed.error.flatten() } });
    const job = await prisma.talentJob.update({ where: { id: req.params.id }, data: normalizeJob(parsed.data, req) });
    res.json({ data: job });
  } catch (error) {
    next(error);
  }
});

router.get('/applications', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status && req.query.status !== 'Todos') where.status = String(req.query.status);
    if (req.query.jobId && req.query.jobId !== 'Todos') where.jobId = String(req.query.jobId);
    if (req.query.q) {
      where.OR = [
        { fullName: { contains: String(req.query.q), mode: 'insensitive' } },
        { email: { contains: String(req.query.q), mode: 'insensitive' } },
        { phone: { contains: String(req.query.q), mode: 'insensitive' } },
        { city: { contains: String(req.query.q), mode: 'insensitive' } }
      ];
    }
    const data = await prisma.talentApplication.findMany({ where, orderBy: { createdAt: 'desc' }, include: { job: true } });
    const cleanData = data.map((item) => ({ ...item, resume: resumeMeta(item.resume) }));
    res.json({ data: cleanData, meta: { total: data.length, limit: data.length, offset: 0 } });
  } catch (error) {
    next(error);
  }
});

router.get('/applications/:id', async (req, res, next) => {
  try {
    const application = await prisma.talentApplication.findUnique({ where: { id: req.params.id }, include: { job: true } });
    if (!application) return res.status(404).json({ error: { message: 'Candidatura nao encontrada' } });
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
});

router.patch('/applications/:id/status', requireTalent('edit'), async (req, res, next) => {
  try {
    const application = await prisma.talentApplication.update({
      where: { id: req.params.id },
      data: { status: String(req.body.status || 'Em analise'), internalNotes: req.body.internalNotes || undefined, reviewedBy: req.user?.name || req.user?.email || null, reviewedAt: new Date() },
      include: { job: true }
    });
    res.json({ data: application });
  } catch (error) {
    next(error);
  }
});

router.post('/applications/:id/convert', requireTalent('edit'), async (req, res, next) => {
  try {
    const application = await prisma.talentApplication.findUnique({ where: { id: req.params.id }, include: { job: true } });
    if (!application) return res.status(404).json({ error: { message: 'Candidatura nao encontrada' } });
    const candidate = await prisma.talentCandidate.create({
      data: {
        fullName: application.fullName,
        cpf: application.cpf ? cpfDigits(application.cpf) : null,
        phone: application.phone,
        email: application.email,
        city: application.city,
        state: application.state,
        education: application.education,
        lastRole: application.lastRole,
        desiredRole: application.job?.title,
        startAvailability: application.availableStartDate,
        salaryExpectation: application.desiredSalary,
        resume: application.resume,
        internalNotes: application.coverLetter,
        status: 'Novo cadastro',
        relatedCompany: application.job?.companyUnit || 'Banco Geral',
        consentStorage: application.consentStorage,
        consentDate: new Date().toISOString().slice(0, 10),
        consentOrigin: 'Candidatura externa',
        source: `Vaga: ${application.job?.title || 'Trabalhe Conosco'}`,
        registeredBy: req.user?.name || req.user?.email || null
      }
    });
    await history('Candidatura convertida em candidato', candidate, req, { toStatus: candidate.status, note: application.job?.title || null });
    const updated = await prisma.talentApplication.update({ where: { id: application.id }, data: { status: 'Convertida', convertedCandidateId: candidate.id, reviewedBy: req.user?.name || req.user?.email || null, reviewedAt: new Date() }, include: { job: true } });
    res.json({ data: { application: updated, candidate } });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: { message: 'Ja existe candidato cadastrado com este CPF' } });
    next(error);
  }
});

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

router.get('/reports', async (req, res, next) => {
  try {
    const where = buildCandidateWhere(req.query);
    const [total, recent, available, analysis, hired, archived, cnhCount, rows, roles, statuses, cities, education, cnhCategories, salaryByRole] = await Promise.all([
      prisma.talentCandidate.count({ where }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { createdAt: { gte: daysAgo(30) } }) }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { status: 'Disponivel' }) }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { status: 'Em analise' }) }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { status: 'Contratado' }) }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { status: 'Arquivado' }) }),
      prisma.talentCandidate.count({ where: appendReportWhere(where, { hasCnh: true }) }),
      prisma.talentCandidate.findMany({ where, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
      prisma.talentCandidate.groupBy({ by: ['desiredRole'], _count: { desiredRole: true }, where: appendReportWhere(where, { desiredRole: { not: null } }), orderBy: { _count: { desiredRole: 'desc' } }, take: 10 }),
      prisma.talentCandidate.groupBy({ by: ['status'], _count: { status: true }, where, orderBy: { _count: { status: 'desc' } } }),
      prisma.talentCandidate.groupBy({ by: ['city'], _count: { city: true }, where: appendReportWhere(where, { city: { not: null } }), orderBy: { _count: { city: 'desc' } }, take: 10 }),
      prisma.talentCandidate.groupBy({ by: ['education'], _count: { education: true }, where: appendReportWhere(where, { education: { not: null } }), orderBy: { _count: { education: 'desc' } }, take: 10 }),
      prisma.talentCandidate.groupBy({ by: ['cnhCategory'], _count: { cnhCategory: true }, where: appendReportWhere(where, { cnhCategory: { not: null } }), orderBy: { _count: { cnhCategory: 'desc' } } }),
      prisma.talentCandidate.groupBy({ by: ['desiredRole'], _avg: { salaryExpectation: true }, _count: { desiredRole: true }, where: appendReportWhere(where, { desiredRole: { not: null }, salaryExpectation: { not: null } }), orderBy: { _count: { desiredRole: 'desc' } }, take: 10 })
    ]);
    res.json({
      data: {
        indicators: { total, recent, available, analysis, hired, archived, cnhCount },
        roles,
        statuses,
        cities,
        education,
        cnhCategories,
        salaryByRole,
        monthly: monthlyCounts(rows)
      }
    });
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
