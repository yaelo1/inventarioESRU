import { formatWeight } from './inventory.js';

export function renderDamageReports({ container, template, reports, labelFor, formatDate }) {
  container.innerHTML = '';
  if (!reports.length) {
    container.innerHTML = '<p class="empty-state">No hay reportes que coincidan con los filtros.</p>';
    return;
  }
  reports.forEach((report) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.damageReportId = report.id;
    node.classList.add(`status-${report.status}`);
    const image = node.querySelector('.damage-report-image');
    const preview = report.thumbnail_path || report.image_path;
    node.classList.toggle('has-image', Boolean(preview));
    image.src = preview || '';
    image.dataset.fullImage = report.image_path || preview || '';
    image.alt = report.piece_name;
    node.querySelector('.damage-report-piece').textContent = `${report.internal_code} · ${report.piece_name}`;
    node.querySelector('.damage-report-passage').textContent = `${report.testament} P${report.passage_number} · ${report.passage_name}`;
    node.querySelector('.damage-report-weight').textContent = formatWeight(report.weight_grams);
    node.querySelector('.damage-report-status').textContent = labelFor(report.status);
    node.querySelector('.damage-report-condition').textContent = labelFor(report.condition_status);
    node.querySelector('.damage-report-description').textContent = report.description;
    node.querySelector('.damage-report-responsible').textContent = report.responsible
      ? `Responsable: ${report.responsible}`
      : 'Sin responsable asignado';
    node.querySelector('.damage-report-date').textContent = formatDate(report.opened_at);
    if (report.status === 'resuelto') {
      node.querySelector('.damage-follow-up').textContent = 'Ver detalle';
    }
    container.appendChild(node);
  });
}
