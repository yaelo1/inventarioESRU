export function renderPassageInventory({ container, pieces, passages, passageTemplate, pieceTemplate, filters, labelFor }) {
  container.innerHTML = '';
  const piecesByPassage = new Map();
  pieces.forEach((piece) => {
    if (!piecesByPassage.has(piece.passage_id)) piecesByPassage.set(piece.passage_id, []);
    piecesByPassage.get(piece.passage_id).push(piece);
  });

  const visiblePassages = passages.filter((passage) => passageIsVisible(passage, piecesByPassage, filters));
  if (!visiblePassages.length) {
    container.innerHTML = '<p class="empty-state">No hay pasajes para mostrar.</p>';
    return;
  }

  const filteredResult = hasActiveFilters(filters) && pieces.length <= 100;
  visiblePassages.forEach((passage) => {
    const groupPieces = piecesByPassage.get(passage.id) || [];
    const node = passageTemplate.content.firstElementChild.cloneNode(true);
    const photo = node.querySelector('.passage-photo');
    const image = photo.querySelector('img');
    const imageButton = photo.querySelector('[data-action="passage-image"]');
    const passagePreview = passage.thumbnail_path || passage.image_path;
    photo.classList.toggle('has-image', Boolean(passagePreview));
    image.src = passagePreview || '';
    image.dataset.fullImage = passage.image_path || passagePreview || '';
    image.alt = `Foto del pasaje ${passage.name}`;
    imageButton.dataset.passageId = passage.id;
    imageButton.textContent = passage.image_path ? 'Cambiar foto' : 'Subir foto';
    node.querySelector('.passage-reference').textContent = `${passage.testament} · P${passage.number}`;
    node.querySelector('.passage-name').textContent = passage.name;
    node.querySelector('.passage-count').textContent = groupPieces.length === passage.pieces
      ? `${passage.pieces} piezas`
      : `${groupPieces.length} coincidencias · ${passage.pieces} total`;
    const grid = node.querySelector('.passage-piece-grid');
    const toggle = node.querySelector('.passage-toggle');
    let rendered = false;
    const setExpanded = (expanded) => {
      if (expanded && !rendered) {
        groupPieces.forEach((piece) => grid.appendChild(createPieceCard(pieceTemplate, piece, labelFor)));
        if (!groupPieces.length) grid.innerHTML = '<p class="empty-state">Pasaje sin piezas registradas.</p>';
        rendered = true;
      }
      grid.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? 'Ocultar piezas' : `Ver piezas (${groupPieces.length})`;
    };
    toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
    setExpanded(filteredResult);
    container.appendChild(node);
  });
}

export function renderPieceCards(container, pieces, pieceTemplate, labelFor) {
  container.innerHTML = '';
  if (!pieces.length) {
    container.innerHTML = '<p class="empty-state">No hay piezas para mostrar.</p>';
    return;
  }
  pieces.forEach((piece) => container.appendChild(createPieceCard(pieceTemplate, piece, labelFor)));
}

function passageIsVisible(passage, piecesByPassage, filters) {
  if (filters.testament && passage.testament !== filters.testament) return false;
  if (filters.passageNumber && Number(passage.number) !== Number(filters.passageNumber)) return false;
  if ((piecesByPassage.get(passage.id) || []).length) return true;

  const hasPieceFilters = Boolean(filters.showcase || filters.presenceStatus || filters.conditionStatus || filters.maintenanceRequired);
  if (hasPieceFilters) return false;
  if (filters.passageNumber) return true;
  if (!filters.q) return true;
  const query = filters.q.toLocaleLowerCase('es-MX');
  return `${passage.testament} p${passage.number} ${passage.name}`.toLocaleLowerCase('es-MX').includes(query);
}

function hasActiveFilters(filters) {
  return Boolean(
    filters.q
    || filters.testament
    || filters.passageNumber
    || filters.showcase
    || filters.presenceStatus
    || filters.conditionStatus
    || filters.maintenanceRequired
  );
}

function createPieceCard(template, piece, labelFor) {
  const node = template.content.firstElementChild.cloneNode(true);
  const loaned = Boolean(piece.active_loan_id) || piece.presence_status === 'prestada';
  const selected = Boolean(piece.active_pick_id);
  node.dataset.pieceId = piece.id;
  node.classList.toggle('has-custody-alert', isCustodyAlert(piece));
  const previewPath = piece.thumbnail_path || piece.image_path;
  node.classList.toggle('has-image', Boolean(previewPath));
  node.classList.toggle('is-loaned', loaned);
  node.classList.toggle('is-selected', selected);
  node.classList.add(`presence-${piece.presence_status}`);
  const image = node.querySelector('.piece-image');
  image.src = previewPath || '';
  image.dataset.fullImage = piece.image_path || previewPath || '';
  image.alt = piece.name;
  node.querySelector('.piece-code').textContent = piece.internal_code;
  node.querySelector('.piece-passage').textContent = `${piece.testament} · P${piece.passage_number}`;
  node.querySelector('.piece-name').textContent = piece.name;
  node.querySelector('.piece-loan-flag').textContent = loaned
    ? `Prestada${piece.active_loan_destination ? ` · ${piece.active_loan_destination}` : ''}`
    : '';
  node.querySelector('.piece-pick-flag').textContent = selected
    ? `${labelFor(piece.active_pick_status)} para ${piece.active_pick_testament} P${piece.active_pick_passage_number}`
    : '';
  node.querySelector('.piece-presence').textContent = labelFor(piece.presence_status);
  node.querySelector('.piece-condition').textContent = labelFor(piece.condition_status);
  node.querySelector('.piece-display-meta').hidden = !hasDisplayLocation(piece, loaned);
  node.querySelector('.piece-display-location').textContent = displayLocationFor(piece, loaned);
  node.querySelector('.piece-status').textContent = statusFor(piece, loaned, labelFor);
  node.querySelector('.piece-notes').textContent = piece.observations || '';
  node.querySelector('.piece-material').textContent = piece.material || 'Sin material registrado';
  node.querySelector('.piece-measurements').textContent = measurementsFor(piece);
  node.querySelector('.piece-storage-detail').textContent = storageLocationFor(piece);
  node.querySelector('[data-action="select-exhibition"]').disabled = selected || piece.presence_status === 'en_mantenimiento';
  return node;
}

export function storageLocationFor(piece) {
  const parts = [];
  if (piece.box) parts.push(`Caja ${piece.box}`);
  if (piece.drawer) parts.push(`Cajón ${piece.drawer}`);
  return parts.join(' / ') || 'Sin resguardo';
}

function displayLocationFor(piece, loaned) {
  const parts = [];
  if (loaned && piece.active_loan_destination) parts.push(`Pasaje destino: ${piece.active_loan_destination}`);
  if (!loaned && piece.showcase) parts.push(`Vitrina ${piece.showcase}`);
  if (piece.exhibition_location) parts.push(piece.exhibition_location);
  if (piece.custodian) parts.push(`Encargado: ${piece.custodian}`);
  if (parts.length) return parts.join(' / ');
  if (loaned) return 'Prestada a pasaje';
  if (piece.presence_status === 'en_vitrina') return 'En vitrina';
  return '';
}

function hasDisplayLocation(piece, loaned) {
  return Boolean(loaned || piece.presence_status === 'en_vitrina');
}

function measurementsFor(piece) {
  const parts = [];
  if (piece.deep) parts.push(`Prof. ${piece.deep}`);
  if (piece.length) parts.push(`Largo ${piece.length}`);
  if (piece.height) parts.push(`Alto ${piece.height}`);
  return parts.join(' / ') || 'Sin medidas registradas';
}

function isCustodyAlert(piece) {
  return piece.presence_status === 'en_mantenimiento'
    || ['roto', 'requiere_mantenimiento', 'en_mantenimiento'].includes(piece.condition_status);
}

function statusFor(piece, loaned, labelFor) {
  if (loaned) return 'Préstamo activo';
  if (piece.active_pick_id) return `Montaje: ${labelFor(piece.active_pick_status)}`;
  if (isCustodyAlert(piece)) return labelFor(piece.condition_status);
  return 'Sin alerta';
}
