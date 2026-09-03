const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { requireAuth } = require('../middlewares/auth');
const { prisma, hasDatabaseUrl } = require('../db/prisma');
const { readDb } = require('../db/jsonStore');

const router = express.Router();

const templateLabels = {
  cd: 'CD TUCUNARE',
  hines: 'HINES',
  tv: 'TV'
};

const logoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'sf-torres-logo-transparent.png');

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
  if (templateLabels[requested]) return requested;
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

function fitText(value, font, size, maxWidth) {
  let text = safeText(value);
  if (!text) return '';
  while (text.length > 1 && font.widthOfTextAtSize(text, size) > maxWidth) {
    text = text.slice(0, -1);
  }
  return text.length < safeText(value).length ? `${text.slice(0, -1)}...` : text;
}

function centerText(page, font, text, x, y, width, size = 8, options = {}) {
  const value = fitText(text, font, size, width - 6);
  if (!value) return;
  const textWidth = font.widthOfTextAtSize(value, size);
  page.drawText(value, {
    x: x + Math.max((width - textWidth) / 2, 3),
    y,
    size,
    font,
    color: options.color || rgb(0, 0, 0)
  });
}

function leftText(page, font, text, x, y, width, size = 8, options = {}) {
  const value = fitText(text, font, size, width - 6);
  if (!value) return;
  page.drawText(value, {
    x: x + 3,
    y,
    size,
    font,
    color: options.color || rgb(0, 0, 0)
  });
}

function line(page, x1, y1, x2, y2, width = 0.8) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: width, color: rgb(0, 0, 0) });
}

function rect(page, x, y, width, height, thickness = 1) {
  page.drawRectangle({ x, y, width, height, borderWidth: thickness, borderColor: rgb(0, 0, 0) });
}

function sectionTitle(page, font, label, x, y, width, height) {
  rect(page, x, y, width, height);
  centerText(page, font, label, x, y + 5, width, 8);
}

function checkbox(page, font, label, x, y, checked = false, size = 8) {
  page.drawText(label, { x, y, size, font, color: rgb(0, 0, 0) });
  const boxX = x + font.widthOfTextAtSize(label, size) + 10;
  page.drawText(`( ${checked ? 'X' : ' '} )`, { x: boxX, y, size, font, color: rgb(0, 0, 0) });
}

async function findWorkOrder(id) {
  if (hasDatabaseUrl) return prisma.workOrder.findUnique({ where: { id } });
  const db = await readDb();
  return (db.workOrders || []).find((item) => item.id === id);
}

async function drawLogo(pdf, page) {
  try {
    const bytes = await fs.readFile(logoPath);
    const image = await pdf.embedPng(bytes);
    const scale = Math.min(42 / image.width, 28 / image.height);
    page.drawImage(image, { x: 62, y: 750, width: image.width * scale, height: image.height * scale });
  } catch {
    page.drawCircle({ x: 75, y: 750, size: 12, borderWidth: 1, borderColor: rgb(0, 0, 0.5) });
    page.drawText('ST', { x: 68, y: 727, size: 14, color: rgb(0, 0, 0.5) });
  }
}

async function buildComandaPdf(order, templateKey) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.setSize(595.32, 841.92);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const scheduled = parseDateTime(order.date);
  const start = parseDateTime(order.operationStart);
  const end = parseDateTime(order.operationEnd);
  const equipment = splitEquipment(order.equipment);
  const marks = serviceMarks(order);
  const left = 44;
  const width = 507;

  await drawLogo(pdf, page);

  rect(page, left, 722, width, 62, 1.4);
  line(page, left, 744, left + width, 744, 1);
  line(page, 458, 722, 458, 784, 1);
  line(page, 275, 722, 275, 744, 1);
  centerText(page, bold, 'PROVEDOR : SF TORRES - ME', 110, 756, 330, 10);
  centerText(page, bold, templateLabels[templateKey], 458, 758, 93, 9);
  leftText(page, font, 'DATA:', left, 730, 48, 9);
  leftText(page, font, scheduled.date, 78, 730, 90, 8);
  leftText(page, font, 'ORDEM DE SERVICO No:', 275, 730, 150, 8);
  centerText(page, font, order.number, 458, 730, 93, 10, { color: rgb(0, 0, 0.85) });

  sectionTitle(page, font, 'DADOS DO CLIENTE', left, 696, width, 18);
  rect(page, left, 656, width, 40, 1);
  leftText(page, font, 'SEMP TCL INDUSTRIAL E COMERCIO DE ELETROELETRONICOS S.A', left, 678, width, 9);
  leftText(page, font, 'Rua Ica, 500 Anexo B - Distrito Industrial I , Manaus - AM, 69075-090', left, 661, width, 9);

  rect(page, left, 634, width, 20, 1);
  leftText(page, font, 'TRANSPORTADOR:', left, 641, 110, 9);
  leftText(page, font, order.carrier, 144, 641, 400, 8);
  rect(page, left, 614, width, 20, 1);
  leftText(page, font, 'RESPONSAVEL OPERACIONAL:', left, 621, 165, 9);
  leftText(page, font, order.responsible, 207, 621, 335, 8);

  sectionTitle(page, font, 'TIPO DE SERVICO', left, 592, width, 18);
  rect(page, left, 542, width, 50, 1);
  line(page, left, 567, left + width, 567, 0.8);
  checkbox(page, font, 'OVA', 54, 577, marks.ova);
  checkbox(page, font, 'DESOVA', 150, 577, marks.desova);
  checkbox(page, font, 'TRANSBORDO', 278, 577, marks.transbordo);
  checkbox(page, font, 'DIARIA', 448, 577, marks.diaria);
  checkbox(page, font, 'CONTEINER', 54, 552, normalize(order.equipment).includes('container'));
  checkbox(page, font, 'CARRETA', 54, 527, isPlateEquipment(order));
  checkbox(page, font, 'M3', 275, 527, false);
  leftText(page, font, 'QUANTIDADE DE PRODUTO', 352, 527, 145, 8);
  rect(page, 495, 519, 48, 18, 0.8);
  centerText(page, font, order.product, 495, 525, 48, 7);

  sectionTitle(page, font, 'EQUIPAMENTO', left, 500, width, 18);
  rect(page, left, 454, width, 46, 1.4);
  line(page, left, 477, left + width, 477, 0.8);
  leftText(page, bold, 'CONTEINER No:', left, 486, 120, 10);
  leftText(page, bold, order.containerNumber, 155, 486, 240, 8);
  leftText(page, bold, 'TIPO:', 426, 486, 50, 10);
  leftText(page, bold, equipment.type, 463, 486, 85, 7);
  leftText(page, bold, 'PLACA No:', left, 463, 100, 10);
  leftText(page, bold, order.trailerPlate, 125, 463, 250, 8);
  leftText(page, bold, 'FROTA:', 426, 463, 55, 10);
  leftText(page, bold, equipment.code, 466, 463, 82, 8);

  sectionTitle(page, font, 'INTEGRANTE DA EQUIPE', left, 432, width, 18);
  rect(page, left, 262, width, 170, 1.4);
  const nameW = 275;
  const roleW = 155;
  const percentW = 28;
  const valueW = width - nameW - roleW - percentW;
  line(page, left + nameW, 262, left + nameW, 432, 1);
  line(page, left + nameW + roleW, 262, left + nameW + roleW, 432, 1);
  line(page, left + nameW + roleW + percentW, 262, left + nameW + roleW + percentW, 432, 1);
  line(page, left, 414, left + width, 414, 0.8);
  leftText(page, font, 'Nome:', left, 420, nameW, 8);
  centerText(page, font, 'Funcao', left + nameW, 420, roleW, 8);
  centerText(page, font, '%', left + nameW + roleW, 420, percentW, 8);
  centerText(page, font, 'Valor R$', left + nameW + roleW + percentW, 420, valueW, 8);
  for (let i = 0; i < 7; i += 1) line(page, left, 396 - (i * 18), left + width, 396 - (i * 18), 0.8);
  const members = Array.isArray(order.teamMembers) ? order.teamMembers.slice(0, 7) : [];
  members.forEach((member, index) => {
    const y = 402 - (index * 18);
    leftText(page, font, member, left, y, nameW, 6.8);
    leftText(page, font, roleText(order, member), left + nameW, y, roleW, 6.8);
  });
  leftText(page, font, 'OBS:', left, 270, 45, 8);
  leftText(page, font, order.teamNote, 75, 270, 470, 7);

  rect(page, left, 240, width, 28, 1.2);
  leftText(page, font, 'LEGENDA DO CONTEINER OU CARRETA', left + 12, 250, 230, 8);
  const progress = progressMark(order.progress);
  [['25', 276], ['50', 323], ['75', 369], ['100', 415]].forEach(([label, x]) => {
    rect(page, x, 246, 16, 16, 0.8);
    if (progress === label) centerText(page, bold, 'X', x, 250, 16, 9);
    leftText(page, bold, `${label}%`, x + 20, 251, 34, 7);
  });

  sectionTitle(page, font, 'REGISTRO OPERACIONAL', left, 218, width, 18);
  sectionTitle(page, font, 'SEPARACAO', left, 198, width, 20);
  rect(page, left, 158, width, 40, 1);
  line(page, 275, 158, 275, 198, 0.8);
  leftText(page, font, 'INICIO:', left, 180, 52, 8);
  leftText(page, font, marks.separacao ? start.date : '', 84, 180, 110, 8);
  leftText(page, font, 'TERMINO:', 275, 180, 65, 8);
  leftText(page, font, marks.separacao ? end.date : '', 330, 180, 110, 8);
  leftText(page, font, 'HORA:', left, 164, 45, 8);
  leftText(page, font, marks.separacao ? start.time : '', 84, 164, 80, 8);
  leftText(page, font, 'HORA:', 275, 164, 45, 8);
  leftText(page, font, marks.separacao ? end.time : '', 330, 164, 80, 8);

  sectionTitle(page, font, 'OVA OU DESOVA', left, 138, width, 20);
  rect(page, left, 98, width, 40, 1);
  line(page, 275, 98, 275, 138, 0.8);
  const fillOvaDates = marks.ova || marks.desova || !marks.separacao;
  leftText(page, font, 'INICIO:', left, 120, 52, 8);
  leftText(page, font, fillOvaDates ? start.date : '', 84, 120, 110, 8);
  leftText(page, font, 'TERMINO:', 275, 120, 65, 8);
  leftText(page, font, fillOvaDates ? end.date : '', 330, 120, 110, 8);
  leftText(page, font, 'HORA:', left, 104, 45, 8);
  leftText(page, font, fillOvaDates ? start.time : '', 84, 104, 80, 8);
  leftText(page, font, 'HORA:', 275, 104, 45, 8);
  leftText(page, font, fillOvaDates ? end.time : '', 330, 104, 80, 8);

  rect(page, left, 36, width, 62, 1.2);
  line(page, 275, 36, 275, 98, 0.8);
  leftText(page, font, 'CARIMBO E ASSINATURA', left, 86, 180, 8);
  leftText(page, font, 'CARIMBO E ASSINATURA', 275, 86, 180, 8);

  return pdf.save();
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
