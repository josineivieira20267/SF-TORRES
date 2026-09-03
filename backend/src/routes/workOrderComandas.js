const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { requireAuth } = require('../middlewares/auth');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { readDb } = require('../db/jsonStore');

const router = express.Router();

const templateDir = path.join(__dirname, '..', '..', 'assets', 'work-order-templates');
const templates = {
  cd: path.join(templateDir, 'cd.pdf'),
  hines: path.join(templateDir, 'hines.pdf'),
  tv: path.join(templateDir, 'tv.pdf')
};

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function templateFromClient(client) {
  const value = normalize(client);
  if (value.includes('hines')) return 'hines';
  if (value.includes('fabrica') || value.includes('tv')) return 'tv';
  if (value.includes('tucunare')) return 'cd';
  return '';
}

function templateFromRequest(req, order) {
  const requested = normalize(req.query.template);
  if (templates[requested]) return requested;
  return templateFromClient(order.client);
}

function parseDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return { date: '', time: '' };
  const br = text.match(/^(\d{2}\/\d{2}\/\d{4})(?:,?\s+(\d{2}:\d{2}))?/);
  if (br) return { date: br[1], time: br[2] || '' };
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)?(\d{2}:\d{2})?/);
  if (iso) return { date: `${iso[3]}/${iso[2]}/${iso[1]}`, time: iso[4] || '' };
  return { date: text.slice(0, 10), time: text.match(/\b\d{2}:\d{2}\b/)?.[0] || '' };
}

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitEquipment(equipment) {
  const parts = safeText(equipment).split(' - ');
  return {
    code: parts.length > 1 ? parts[0] : '',
    type: parts.length > 1 ? parts.slice(1).join(' - ') : parts[0] || ''
  };
}

function isPlateEquipment(order) {
  const value = normalize(`${order.equipment} ${order.equipmentType || ''}`);
  return value.includes('carreta') || value.includes('caminh') || value.includes('truck');
}

function drawText(page, font, text, x, y, options = {}) {
  const value = safeText(text);
  if (!value) return;
  page.drawText(value.slice(0, options.limit || 90), {
    x,
    y,
    size: options.size || 9,
    font,
    color: options.color || rgb(0, 0, 0)
  });
}

function drawWrappedText(page, font, text, x, y, options = {}) {
  const value = safeText(text);
  if (!value) return;
  const size = options.size || 8;
  const maxWidth = options.maxWidth || 220;
  const lineHeight = options.lineHeight || size + 2;
  const maxLines = options.maxLines || 2;
  const words = value.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => drawText(page, font, item, x, y - (index * lineHeight), { size }));
}

function mark(page, font, x, y) {
  page.drawText('X', { x, y, size: 9, font, color: rgb(0, 0, 0) });
}

function serviceMarks(order) {
  const service = normalize(order.service);
  return {
    ova: service.includes('ova') && !service.includes('desova'),
    desova: service.includes('desova'),
    transbordo: service.includes('transbordo'),
    diaria: service.includes('diaria'),
    separacao: service.includes('separ')
  };
}

function progressMark(progress) {
  const value = Number(progress || 0);
  if (value >= 100) return '100';
  if (value >= 75) return '75';
  if (value >= 50) return '50';
  if (value >= 25) return '25';
  return '';
}

function roleText(order, member) {
  const roles = order.teamRoles?.[member];
  if (Array.isArray(roles)) return roles.join(', ');
  return safeText(roles);
}

async function findWorkOrder(id) {
  if (hasDatabaseUrl) return prisma.workOrder.findUnique({ where: { id } });
  const db = await readDb();
  return (db.workOrders || []).find((item) => item.id === id);
}

async function buildComandaPdf(order, templateKey) {
  const templateBytes = await fs.readFile(templates[templateKey]);
  const templatePdf = await PDFDocument.load(templateBytes);
  const outputPdf = await PDFDocument.create();
  const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
  outputPdf.addPage(templatePage);

  const page = outputPdf.getPage(0);
  const font = await outputPdf.embedFont(StandardFonts.Helvetica);
  const bold = await outputPdf.embedFont(StandardFonts.HelveticaBold);
  const scheduled = parseDateTime(order.date);
  const start = parseDateTime(order.operationStart);
  const end = parseDateTime(order.operationEnd);
  const equipment = splitEquipment(order.equipment);
  const marks = serviceMarks(order);

  page.drawRectangle({ x: 507, y: 722, width: 78, height: 24, color: rgb(1, 1, 1) });
  drawText(page, font, scheduled.date, 103, 731, { size: 9 });
  drawText(page, font, order.number, 512, 731, { size: 10, color: rgb(0, 0, 0.85) });
  drawText(page, font, order.carrier, 162, 651, { size: 8, limit: 75 });
  drawText(page, font, order.responsible, 219, 633, { size: 8, limit: 70 });

  if (marks.ova) mark(page, font, 115, 603);
  if (marks.desova) mark(page, font, 197, 603);
  if (marks.transbordo) mark(page, font, 335, 603);
  if (marks.diaria) mark(page, font, 527, 603);

  if (normalize(order.equipment).includes('container')) mark(page, font, 142, 581);
  if (isPlateEquipment(order)) mark(page, font, 142, 558);
  drawWrappedText(page, font, order.product, 476, 561, { size: 7, maxWidth: 64, maxLines: 1 });

  drawText(page, bold, order.containerNumber, 184, 506, { size: 8, limit: 32 });
  drawText(page, bold, equipment.type, 503, 506, { size: 7, limit: 24 });
  drawText(page, bold, order.trailerPlate, 145, 482, { size: 8, limit: 32 });
  drawText(page, bold, equipment.code, 518, 482, { size: 8, limit: 24 });

  const members = Array.isArray(order.teamMembers) ? order.teamMembers.slice(0, 7) : [];
  members.forEach((member, index) => {
    const y = 430 - (index * 17.4);
    drawWrappedText(page, font, member, 72, y, { size: 6.5, maxWidth: 210, maxLines: 1 });
    drawWrappedText(page, font, roleText(order, member), 296, y, { size: 6.5, maxWidth: 130, maxLines: 1 });
  });
  drawWrappedText(page, font, order.teamNote, 72, 279, { size: 8, maxWidth: 480, maxLines: 2 });

  const progress = progressMark(order.progress);
  const progressPositions = { 25: 283, 50: 331, 75: 374, 100: 417 };
  if (progress) mark(page, font, progressPositions[progress], 248);

  const operationY = marks.separacao ? 183 : 133;
  const operationTimeY = marks.separacao ? 166 : 116;
  drawText(page, font, start.date, 96, operationY, { size: 8, limit: 12 });
  drawText(page, font, start.time, 96, operationTimeY, { size: 8, limit: 8 });
  drawText(page, font, end.date, 338, operationY, { size: 8, limit: 12 });
  drawText(page, font, end.time, 338, operationTimeY, { size: 8, limit: 8 });

  return outputPdf.save();
}

router.get('/:id/comanda', requireAuth, async (req, res, next) => {
  try {
    const order = await findWorkOrder(req.params.id);
    if (!order) return res.status(404).json({ error: { message: 'OS nao encontrada' } });

    const templateKey = templateFromRequest(req, order);
    if (!templateKey) {
      return res.status(400).json({
        error: { message: 'Escolha o modelo da comanda para esta OS' },
        templates: [
          { value: 'cd', label: 'CD TUCUNARE' },
          { value: 'hines', label: 'HINES' },
          { value: 'tv', label: 'TV/FABRICA' }
        ]
      });
    }

    const bytes = await buildComandaPdf(order, templateKey);
    const filename = `comanda-os-${safeText(order.number || order.id).replace(/[^a-z0-9-]+/gi, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(bytes));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
