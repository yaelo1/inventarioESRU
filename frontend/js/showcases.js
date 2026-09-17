export function renderShowcases({ container, template, showcases, filters = {} }) {
  container.innerHTML = '';
  const query = String(filters.q || '').trim().toLocaleLowerCase('es-MX');
  const visible = showcases.filter((showcase) => {
    if (filters.assignment === 'assigned' && !showcase.passage_count) return false;
    if (filters.assignment === 'empty' && showcase.passage_count) return false;
    if (!query) return true;
    const passageText = showcase.passages
      .map((passage) => `${passage.testament} p${passage.number} ${passage.name}`)
      .join(' ');
    return `${showcase.code} ${showcase.name} ${showcase.location || ''} ${passageText}`
      .toLocaleLowerCase('es-MX').includes(query);
  });

  if (!visible.length) {
    container.innerHTML = '<p class="empty-state">No hay vitrinas que coincidan con los filtros.</p>';
    return;
  }

  visible.forEach((showcase) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.showcaseId = showcase.id;
    node.querySelector('.showcase-code').textContent = showcase.code;
    node.querySelector('.showcase-name').textContent = showcase.name;
    node.querySelector('.showcase-measurements').textContent = measurementsFor(showcase);
    node.querySelector('.showcase-support').textContent = showcase.support_type || 'Vitrina';
    node.querySelector('.showcase-shape').textContent = shapeLabel(showcase.shape);
    node.querySelector('.showcase-location').textContent = showcase.location || 'Sin ubicación registrada';
    node.querySelector('.showcase-counts').textContent = `${showcase.passage_count} pasaje${showcase.passage_count === 1 ? '' : 's'} · ${showcase.piece_count} piezas`;
    node.querySelector('.showcase-notes').textContent = showcase.observations || '';
    const passageList = node.querySelector('.showcase-passages');
    if (!showcase.passages.length) {
      passageList.innerHTML = '<li class="is-empty">Sin pasajes asignados</li>';
    } else {
      showcase.passages.forEach((passage) => {
        const item = document.createElement('li');
        item.textContent = `${passage.testament} P${passage.number} · ${passage.name} (${passage.pieces})`;
        passageList.appendChild(item);
      });
    }
    container.appendChild(node);
  });
}

export function measurementsFor(showcase) {
  if (showcase.measurement_notes) return showcase.measurement_notes;
  const parts = [];
  if (showcase.length_cm) parts.push(`Largo ${formatNumber(showcase.length_cm)} cm`);
  if (showcase.width_cm) parts.push(`Ancho ${formatNumber(showcase.width_cm)} cm`);
  if (showcase.height_cm) parts.push(`Alto ${formatNumber(showcase.height_cm)} cm`);
  if (showcase.diameter_cm) parts.push(`Diámetro ${formatNumber(showcase.diameter_cm)} cm`);
  return parts.join(' · ') || 'Sin medidas registradas';
}

function shapeLabel(shape) {
  return {
    rectangular: 'Rectangular',
    circular: 'Circular',
    irregular: 'Irregular',
    otro: 'Otra'
  }[shape] || shape;
}

function formatNumber(value) {
  return Number(value).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}
