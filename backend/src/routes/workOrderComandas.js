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

function uppercaseText(value) {
  return safeText(value).toLocaleUpperCase('pt-BR');
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

function leftTextShrink(page, font, text, x, y, width, size = 8, options = {}) {
  const value = safeText(text);
  if (!value) return;
  let nextSize = size;
  while (nextSize > 6 && font.widthOfTextAtSize(value, nextSize) > width - 6) {
    nextSize -= 0.5;
  }
  leftText(page, font, value, x, y, width, nextSize, options);
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

function sideArrow(page, x, yTop, yBottom, yPoint) {
  const color = rgb(0.28, 0.55, 0.84);
  page.drawLine({ start: { x, y: yTop }, end: { x, y: yBottom }, thickness: 1.8, color });
  page.drawLine({ start: { x, y: yTop }, end: { x: x + 12, y: yTop }, thickness: 1.8, color });
  page.drawLine({ start: { x, y: yBottom }, end: { x: x + 12, y: yBottom }, thickness: 1.8, color });
  page.drawLine({ start: { x: x + 2, y: yPoint + 5 }, end: { x: x + 10, y: yPoint }, thickness: 1.8, color });
  page.drawLine({ start: { x: x + 2, y: yPoint - 5 }, end: { x: x + 10, y: yPoint }, thickness: 1.8, color });
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
    const scale = Math.min(42 / image.width, 25 / image.height);
    page.drawImage(image, { x: 90, y: 754, width: image.width * scale, height: image.height * scale });
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
  const left = 70;
  const width = 492;
  const right = left + width;
  const dateSplit = 294;
  const templateSplit = 474;

  await drawLogo(pdf, page);

  rect(page, left, 728, width, 58, 1.4);
  line(page, left, 751, right, 751, 1);
  line(page, templateSplit, 728, templateSplit, 786, 1);
  line(page, dateSplit, 728, dateSplit, 751, 1);
  centerText(page, bold, 'PROVEDOR : SF TORRES - ME', 150, 762, 260, 10);
  centerText(page, bold, templateLabels[templateKey], templateSplit, 762, right - templateSplit, 9);
  leftText(page, font, 'DATA:', left, 730, 48, 9);
  leftText(page, font, scheduled.date, 104, 731, 90, 8);
  leftText(page, font, 'ORDEM DE SERVICO Nº:', dateSplit, 730, 150, 8);
  centerText(page, font, order.number, templateSplit, 730, right - templateSplit, 10, { color: rgb(0, 0, 0.85) });

  sectionTitle(page, font, 'DADOS DO CLIENTE', left, 709, width, 16);
  rect(page, left, 672, width, 37, 1);
  leftText(page, font, 'SEMP TCL INDUSTRIAL E COMERCIO DE ELETROELETRONICOS S.A', left, 692, width, 9);
  leftText(page, font, 'Rua Ica, 500 Anexo B - Distrito Industrial I , Manaus - AM, 69075-090', left, 676, width, 9);

  rect(page, left, 650, width, 19, 1);
  leftText(page, font, 'TRANSPORTADOR:', left, 656, 110, 9);
  leftText(page, font, uppercaseText(order.carrier), 172, 656, 380, 9);
  rect(page, left, 631, width, 19, 1);
  leftText(page, font, 'RESPONSAVEL OPERACIONAL:', left, 637, 165, 9);
  leftText(page, font, uppercaseText(order.responsible), 218, 637, 334, 9);

  sectionTitle(page, font, 'TIPO DE SERVICO', left, 612, width, 17);
  rect(page, left, 548, width, 64, 1);
  line(page, left, 589, right, 589, 0.8);
  line(page, left, 568, right, 568, 0.8);
  checkbox(page, font, 'OVA', 80, 597, marks.ova);
  checkbox(page, font, 'DESOVA', 170, 597, marks.desova);
  checkbox(page, font, 'TRANSBORDO', 310, 597, marks.transbordo);
  checkbox(page, font, 'DIARIA', 472, 597, marks.diaria);
  checkbox(page, font, 'CONTEINER', 80, 576, normalize(order.equipment).includes('container'));
  checkbox(page, font, 'CARRETA', 80, 555, isPlateEquipment(order));
  checkbox(page, font, 'M3', 300, 555, false);
  centerText(page, font, 'QUANTIDADE DE PRODUTO', 352, 555, 145, 8);
  rect(page, 512, 550, 48, 18, 0.8);
  centerText(page, font, uppercaseText(order.product), 512, 556, 48, 8);

  sectionTitle(page, font, 'EQUIPAMENTO', left, 523, width, 17);
  rect(page, left, 477, width, 46, 1.4);
  line(page, left, 500, right, 500, 0.8);
  leftText(page, bold, 'CONTEINER Nº:', left, 509, 120, 10);
  leftText(page, bold, uppercaseText(order.containerNumber), 176, 509, 240, 10);
  leftText(page, bold, 'TIPO:', 466, 509, 42, 10);
  leftTextShrink(page, bold, uppercaseText(equipment.type), 503, 509, 56, 10);
  leftText(page, bold, 'PLACA Nº:', left, 486, 100, 10);
  leftText(page, bold, uppercaseText(order.trailerPlate), 135, 486, 270, 10);
  leftText(page, bold, 'FROTA:', 466, 486, 48, 10);
  leftText(page, bold, uppercaseText(equipment.code), 510, 486, 48, 10);
  sideArrow(page, 60, 568, 500, 500);
  sideArrow(page, 54, 548, 477, 477);

  sectionTitle(page, font, 'INTEGRANTE DA EQUIPE', left, 457, width, 16);
  rect(page, left, 302, width, 155, 1.4);
  const nameW = 224;
  const roleW = 151;
  const percentW = 28;
  const valueW = width - nameW - roleW - percentW;
  line(page, left + nameW, 302, left + nameW, 457, 1);
  line(page, left + nameW + roleW, 302, left + nameW + roleW, 457, 1);
  line(page, left + nameW + roleW + percentW, 302, left + nameW + roleW + percentW, 457, 1);
  line(page, left, 441, right, 441, 0.8);
  leftText(page, font, 'Nome:', left, 446, nameW, 8);
  centerText(page, font, 'Funcao', left + nameW, 446, roleW, 8);
  centerText(page, font, '%', left + nameW + roleW, 446, percentW, 8);
  centerText(page, font, 'Valor R$', left + nameW + roleW + percentW, 446, valueW, 8);
  for (let i = 0; i < 7; i += 1) line(page, left, 423 - (i * 17.4), right, 423 - (i * 17.4), 0.8);
  const members = Array.isArray(order.teamMembers) ? order.teamMembers.slice(0, 7) : [];
  members.forEach((member, index) => {
    const y = 429 - (index * 17.4);
    leftText(page, font, uppercaseText(member), left, y, nameW, 8);
    leftText(page, font, uppercaseText(roleText(order, member)), left + nameW, y, roleW, 8);
  });
  leftText(page, font, 'OBS:', left, 310, 45, 8);
  leftText(page, font, uppercaseText(order.teamNote), 100, 310, 455, 8);

  rect(page, left, 237, width, 28, 1.2);
  leftText(page, font, 'LEGENDA DO CONTEINER OU CARRETA', left + 12, 247, 230, 8);
  const progress = progressMark(order.progress);
  [['25', 274], ['50', 323], ['75', 366], ['100', 410]].forEach(([label, x]) => {
    rect(page, x, 242, 17, 17, 0.8);
    if (progress === label) centerText(page, bold, 'X', x, 246, 17, 9);
    leftText(page, bold, `${label}%`, x + 20, 247, 34, 7);
  });

  sectionTitle(page, font, 'REGISTRO OPERACIONAL', left, 218, width, 17);
  sectionTitle(page, font, 'SEPARACAO', left, 198, width, 20);
  rect(page, left, 158, width, 40, 1);
  line(page, dateSplit, 158, dateSplit, 198, 0.8);
  leftText(page, font, 'INICIO:', left, 180, 52, 8);
  leftText(page, font, marks.separacao ? start.date : '', 108, 180, 110, 8);
  leftText(page, font, 'TERMINO:', dateSplit, 180, 65, 8);
  leftText(page, font, marks.separacao ? end.date : '', 350, 180, 110, 8);
  leftText(page, font, 'HORA:', left, 164, 45, 8);
  leftText(page, font, marks.separacao ? start.time : '', 108, 164, 80, 8);
  leftText(page, font, 'HORA:', dateSplit, 164, 45, 8);
  leftText(page, font, marks.separacao ? end.time : '', 350, 164, 80, 8);

  sectionTitle(page, font, 'OVA OU DESOVA', left, 138, width, 20);
  rect(page, left, 98, width, 40, 1);
  line(page, dateSplit, 98, dateSplit, 138, 0.8);
  const fillOvaDates = marks.ova || marks.desova || !marks.separacao;
  leftText(page, font, 'INICIO:', left, 120, 52, 8);
  leftText(page, font, fillOvaDates ? start.date : '', 108, 120, 110, 8);
  leftText(page, font, 'TERMINO:', dateSplit, 120, 65, 8);
  leftText(page, font, fillOvaDates ? end.date : '', 350, 120, 110, 8);
  leftText(page, font, 'HORA:', left, 104, 45, 8);
  leftText(page, font, fillOvaDates ? start.time : '', 108, 104, 80, 8);
  leftText(page, font, 'HORA:', dateSplit, 104, 45, 8);
  leftText(page, font, fillOvaDates ? end.time : '', 350, 104, 80, 8);

  rect(page, left, 36, width, 62, 1.2);
  line(page, dateSplit, 36, dateSplit, 98, 0.8);
  leftText(page, font, 'CARIMBO E ASSINATURA', left, 86, 180, 8);
  leftText(page, font, 'CARIMBO E ASSINATURA', dateSplit, 86, 180, 8);

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
