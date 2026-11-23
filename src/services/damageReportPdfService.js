const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const env = require('../config/env');
const { storedPathFromPublic } = require('./imageService');

const colors = {
  brown: '#3d2b1a',
  brownMid: '#6b4a2e',
  brownLight: '#9c7a5a',
  cream: '#fefcf7',
  parchment: '#faf6ed',
  parchmentDark: '#f0e8d5',
  gold: '#c9a84c',
  red: '#c0392b',
  green: '#2d6a4f',
  blue: '#3f6f8f',
  amber: '#b8872d'
};

async function generateDamageReportsPdf({ reports, filters = {}, generatedBy }) {
  const document = new PDFDocument({
    size: 'LETTER',
    margins: { top: 42, right: 42, bottom: 42, left: 42 },
    compress: true,
    info: {
      Title: 'Reporte de piezas dañadas',
      Author: 'Inventario ESRU / FAMMA',
      Subject: 'Seguimiento de conservación y restauración'
    }
  });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });

  drawCover(document, reports, filters, generatedBy);
  for (let index = 0; index < reports.length; index += 1) {
    if (index % 2 === 0) drawReportPage(document, Math.floor(index / 2) + 2);
    const y = index % 2 === 0 ? 82 : 405;
    await drawReportCard(document, reports[index], y);
  }
  if (!reports.length) {
    document.font('Helvetica').fontSize(12).fillColor(colors.brownLight)
      .text('No hay piezas que coincidan con los filtros seleccionados.', 80, 550, { align: 'center', width: 452 });
  }
  document.end();
  return completed;
}

function drawCover(document, reports, filters, generatedBy) {
  document.rect(0, 0, 612, 118).fill(colors.brown);
  drawLogos(document, 42, 35, 180, 143);
  document.font('Helvetica').fontSize(9).fillColor(colors.gold)
    .text('COLECCIÓN NACIMIENTO · AER', 42, 158, { characterSpacing: 1.2 });
  document.font('Times-Bold').fontSize(29).fillColor(colors.brown)
    .text('Reporte de piezas dañadas', 42, 180);
  document.font('Helvetica').fontSize(10).fillColor(colors.brownLight)
    .text('Seguimiento de conservación y restauración', 42, 219);

  const counts = reports.reduce((result, report) => {
    result[report.status] = (result[report.status] || 0) + 1;
    return result;
  }, {});
  const cards = [
    ['PIEZAS', reports.length, colors.brown],
    ['PENDIENTES', counts.abierto || 0, colors.amber],
    ['EN RESTAURACIÓN', counts.en_restauracion || 0, colors.red],
    ['RESUELTOS', counts.resuelto || 0, colors.green]
  ];
  cards.forEach(([label, value, color], index) => {
    const x = 42 + (index % 2) * 266;
    const y = 270 + Math.floor(index / 2) * 82;
    document.roundedRect(x, y, 248, 64, 4).fillAndStroke(colors.cream, colors.parchmentDark);
    document.font('Helvetica-Bold').fontSize(21).fillColor(color).text(String(value), x + 12, y + 11, { width: 224 });
    document.font('Helvetica').fontSize(7).fillColor(colors.brownLight)
      .text(label, x + 12, y + 42, { characterSpacing: 0.8, width: 224 });
  });

  document.font('Helvetica-Bold').fontSize(9).fillColor(colors.brown)
    .text('FILTROS APLICADOS', 42, 454, { characterSpacing: 0.9 });
  document.font('Helvetica').fontSize(9).fillColor(colors.brownMid)
    .text(filterSummary(reports, filters), 42, 474, { lineGap: 5, width: 528 });

  document.moveTo(42, 625).lineTo(570, 625).strokeColor(colors.parchmentDark).stroke();
  document.font('Helvetica').fontSize(8).fillColor(colors.brownLight)
    .text(`Generado: ${formatDate(new Date())}`, 42, 642);
  document.text(`Responsable de descarga: ${generatedBy?.name || 'Usuario del inventario'}`, 42, 660);
  drawFooter(document, 1);
}

function drawReportPage(document, pageNumber) {
  document.addPage();
  document.rect(0, 0, 612, 54).fill(colors.brown);
  drawCompactLogos(document);
  document.font('Helvetica').fontSize(7).fillColor(colors.gold)
    .text('REPORTE DE CONSERVACIÓN', 360, 24, { align: 'right', characterSpacing: 0.8, width: 222 });
  drawFooter(document, pageNumber);
}

async function drawReportCard(document, report, y) {
  const x = 42;
  const width = 528;
  const height = 285;
  document.roundedRect(x, y, width, height, 5).fillAndStroke(colors.cream, colors.parchmentDark);
  document.rect(x, y, 5, height).fill(statusColor(report.status));

  const imageX = x + 18;
  const imageY = y + 52;
  const imageWidth = 142;
  const imageHeight = 174;
  document.roundedRect(imageX, imageY, imageWidth, imageHeight, 3).fill(colors.parchmentDark);
  const image = await reportImage(report);
  if (image) {
    document.image(image, imageX, imageY, {
      fit: [imageWidth, imageHeight],
      align: 'center',
      valign: 'center'
    });
  } else {
    document.font('Helvetica').fontSize(9).fillColor(colors.brownLight)
      .text('Sin imagen disponible', imageX + 12, imageY + 82, { align: 'center', width: imageWidth - 24 });
  }

  document.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.brownLight)
    .text(report.internal_code, x + 18, y + 18, { characterSpacing: 0.5 });
  document.font('Times-Bold').fontSize(19).fillColor(colors.brown)
    .text(report.piece_name, x + 175, y + 18, { ellipsis: true, width: 335 });

  const contentX = x + 175;
  const contentWidth = 335;
  drawPill(document, label(report.status), contentX, y + 51, statusColor(report.status), 118);
  drawPill(document, label(report.condition_status), contentX + 126, y + 51, colors.brownMid, 209);
  drawLine(document, 'Pasaje', `${report.testament} P${report.passage_number} · ${report.passage_name}`, contentX, y + 83, contentWidth);
  drawLine(document, 'Peso', formatWeight(report.weight_grams), contentX, y + 109, contentWidth);
  drawLine(document, 'Responsable', report.responsible || 'Sin asignar', contentX, y + 135, contentWidth);
  drawLine(document, 'Apertura', formatSqliteDate(report.opened_at), contentX, y + 161, contentWidth);

  if (report.resolution_notes) {
    drawAnnotationBox(document, {
      title: 'ANOTACIÓN DEL REPORTE',
      text: report.description || 'Sin anotaciones',
      x: contentX,
      y: y + 188,
      width: contentWidth,
      height: 39,
      accent: colors.gold
    });
    drawAnnotationBox(document, {
      title: 'RESOLUCIÓN',
      text: report.resolution_notes,
      x: contentX,
      y: y + 233,
      width: contentWidth,
      height: 39,
      accent: colors.green
    });
  } else {
    drawAnnotationBox(document, {
      title: 'ANOTACIONES DEL REPORTE',
      text: report.description || 'Sin anotaciones registradas',
      x: contentX,
      y: y + 188,
      width: contentWidth,
      height: 84,
      accent: colors.gold
    });
  }

  document.font('Helvetica').fontSize(8.25).fillColor(colors.brownLight)
    .text(`Presencia: ${label(report.presence_status)}`, imageX, y + 237, { width: imageWidth });
  document.text(report.resolved_at ? `Resuelto: ${formatSqliteDate(report.resolved_at)}` : 'Expediente activo', imageX, y + 251, { width: imageWidth });
}

async function reportImage(report) {
  const storedPath = storedPathFromPublic(report.thumbnail_path || report.image_path);
  if (!storedPath || !fs.existsSync(storedPath)) return null;
  try {
    return await sharp(storedPath, { failOn: 'none', limitInputPixels: env.imageMaxPixels })
      .rotate()
      .resize({ width: 520, height: 640, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: colors.parchmentDark })
      .jpeg({ quality: 76, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    return null;
  }
}

function drawLogos(document, x, y, fammaWidth, esruWidth) {
  const famma = path.join(env.rootDir, 'frontend/assets/logo-famma.png');
  const esru = path.join(env.rootDir, 'frontend/assets/logo-esru.png');
  document.image(famma, x, y, { fit: [fammaWidth, 35] });
  document.image(esru, 612 - x - esruWidth, y, { fit: [esruWidth, 35], align: 'right' });
}

function drawCompactLogos(document) {
  const famma = path.join(env.rootDir, 'frontend/assets/logo-famma.png');
  const esru = path.join(env.rootDir, 'frontend/assets/logo-esru.png');
  document.image(famma, 28, 16, { fit: [116, 24] });
  document.image(esru, 166, 16, { fit: [96, 24] });
}

function drawFooter(document, pageNumber) {
  document.font('Helvetica').fontSize(7).fillColor(colors.brownLight)
    .text('Inventario ESRU / FAMMA · Documento interno', 42, 735, { width: 420 });
  document.text(`Página ${pageNumber}`, 500, 735, { align: 'right', width: 70 });
}

function drawLine(document, title, value, x, y, width) {
  document.font('Helvetica-Bold').fontSize(8).fillColor(colors.brownLight)
    .text(title.toUpperCase(), x, y, { characterSpacing: 0.45, width: 88 });
  document.font('Helvetica').fontSize(9.5).fillColor(colors.brownMid)
    .text(value, x + 94, y - 1.5, { ellipsis: true, width: width - 94 });
}

function drawAnnotationBox(document, { title, text, x, y, width, height, accent }) {
  document.roundedRect(x, y, width, height, 3).fillAndStroke(colors.parchment, colors.parchmentDark);
  document.rect(x, y, 4, height).fill(accent);
  document.font('Helvetica-Bold').fontSize(7.75).fillColor(accent)
    .text(title, x + 13, y + 9, { characterSpacing: 0.55, lineBreak: false, width: width - 25 });
  document.font('Helvetica').fontSize(9.75).fillColor(colors.brown)
    .text(text, x + 13, y + 23, {
      ellipsis: true,
      height: height - 29,
      lineGap: 2.5,
      width: width - 25
    });
}

function drawPill(document, value, x, y, color, width) {
  const text = value.toUpperCase();
  const availableWidth = width - 14;
  document.font('Helvetica-Bold').fontSize(8);
  const measuredWidth = document.widthOfString(text);
  const fontSize = Math.max(6.25, Math.min(8, 8 * availableWidth / measuredWidth));
  document.roundedRect(x, y, width, 23, 3).fill(color);
  document.fontSize(fontSize).fillColor(colors.cream)
    .text(text, x + 7, y + (23 - fontSize) / 2 - 0.5, {
      align: 'center',
      lineBreak: false,
      width: availableWidth
    });
}

function filterSummary(reports, filters) {
  const parts = [];
  parts.push(`Estado: ${filters.status === 'activos' || !filters.status ? 'Activos' : label(filters.status)}`);
  if (filters.conditionStatus) parts.push(`Conservación: ${label(filters.conditionStatus)}`);
  if (filters.q) parts.push(`Búsqueda: ${filters.q}`);
  if (filters.dateFrom || filters.dateTo) parts.push(`Periodo: ${filters.dateFrom || 'inicio'} a ${filters.dateTo || 'hoy'}`);
  const passages = new Map(reports.map((report) => [report.passage_id, `${report.testament} P${report.passage_number} · ${report.passage_name}`]));
  if (filters.passageId && passages.size === 1) parts.push(`Pasaje: ${[...passages.values()][0]}`);
  return parts.join('\n') || 'Sin filtros adicionales';
}

function formatWeight(weightGrams) {
  const grams = Number(weightGrams);
  if (!Number.isFinite(grams) || grams <= 0) return 'Sin peso registrado';
  if (grams >= 1000) return `${(grams / 1000).toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`;
  return `${grams.toLocaleString('es-MX', { maximumFractionDigits: 2 })} g`;
}

function formatSqliteDate(value) {
  if (!value) return 'Sin fecha';
  return formatDate(new Date(`${String(value).replace(' ', 'T')}Z`));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: env.timezone
  }).format(value);
}

function statusColor(status) {
  return {
    abierto: colors.amber,
    en_revision: colors.blue,
    en_restauracion: colors.red,
    resuelto: colors.green
  }[status] || colors.brownMid;
}

function label(value) {
  return {
    abierto: 'Pendiente',
    en_restauracion: 'En restauración',
    resuelto: 'Resuelto',
    roto: 'Roto',
    requiere_mantenimiento: 'Necesita restauración',
    en_mantenimiento: 'En restauración',
    bueno: 'Bueno',
    regular: 'Regular',
    en_caja: 'En caja',
    en_vitrina: 'En vitrina',
    prestada: 'Prestada',
    sin_confirmar: 'Sin confirmar'
  }[value] || value || 'Sin dato';
}

module.exports = { generateDamageReportsPdf };
