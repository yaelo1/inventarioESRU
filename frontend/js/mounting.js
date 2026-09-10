import { storageLocationFor } from './inventory.js';

export function renderMounting({ container, groupTemplate, cardTemplate, picks, passages, labelFor }) {
  container.innerHTML = '';
  if (!picks.length) {
    container.innerHTML = '<p class="empty-state">No hay piezas seleccionadas para salida.</p>';
    return;
  }

  const passagesById = new Map(passages.map((passage) => [Number(passage.id), passage]));
  const picksByTarget = new Map();
  picks.forEach((pick) => {
    const targetId = Number(pick.target_passage_id);
    if (!picksByTarget.has(targetId)) picksByTarget.set(targetId, []);
    picksByTarget.get(targetId).push(pick);
  });

  picksByTarget.forEach((targetPicks, targetId) => {
    const passage = passagesById.get(targetId) || passageFromPick(targetPicks[0]);
    const group = groupTemplate.content.firstElementChild.cloneNode(true);
    const photo = group.querySelector('.mounting-passage-photo');
    const image = photo.querySelector('img');
    const passagePreview = passage.thumbnail_path || passage.image_path;
    photo.classList.toggle('has-image', Boolean(passagePreview));
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = passagePreview || '';
    image.dataset.fullImage = passage.image_path || passagePreview || '';
    image.alt = passagePreview ? `Foto del pasaje ${passage.name}` : '';
    group.querySelector('.mounting-passage-reference').textContent = `${passage.testament} · P${passage.number}`;
    group.querySelector('.mounting-passage-name').textContent = passage.name;
    group.querySelector('.mounting-passage-summary').textContent = summaryFor(targetPicks);
    const grid = group.querySelector('.mounting-piece-grid');
    targetPicks.forEach((pick) => grid.appendChild(createMountingCard(cardTemplate, pick, labelFor)));
    container.appendChild(group);
  });
}

function createMountingCard(template, pick, labelFor) {
    const node = template.content.firstElementChild.cloneNode(true);
    if (pick.id) node.dataset.pickId = pick.id;
    const borrowed = pick.origin_testament !== pick.target_testament
      || Number(pick.origin_passage_number) !== Number(pick.target_passage_number);
    node.classList.add(`status-${pick.status}`);
    const previewPath = pick.thumbnail_path || pick.image_path;
    node.classList.toggle('has-image', Boolean(previewPath));
    node.classList.toggle('is-borrowed', borrowed);
    const image = node.querySelector('.mounting-image');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = previewPath || '';
    image.dataset.fullImage = pick.image_path || previewPath || '';
    image.alt = previewPath ? pick.piece_name : '';
    node.querySelector('.mounting-piece').textContent = `${pick.internal_code} · ${pick.piece_name}`;
    node.querySelector('.mounting-origin').textContent = borrowed
      ? `Préstamo desde ${pick.origin_testament} P${pick.origin_passage_number} · ${pick.origin_passage_name}`
      : 'Pieza propia del pasaje';
    node.querySelector('.mounting-storage').textContent = `Sacar de: ${storageLocationFor(pick)}`;
    node.querySelector('.mounting-notes').textContent = pick.notes ? `Notas: ${pick.notes}` : '';
    node.querySelector('.mounting-requested').textContent = pick.requested_by ? `Solicita: ${pick.requested_by}` : '';
    node.querySelector('.mounting-status').textContent = labelFor(pick.status);
    node.querySelector('[data-action="pick-out"]').hidden = pick.status !== 'seleccionada';
    node.querySelector('[data-action="pick-mounted"]').hidden = pick.status !== 'sacada';
    node.querySelector('[data-action="pick-finished"]').hidden = pick.status !== 'montada' || Boolean(pick.active_loan_id);
    const returnButton = node.querySelector('[data-action="pick-return"]');
    returnButton.hidden = !pick.active_loan_id || !['sacada', 'montada'].includes(pick.status);
    returnButton.textContent = pick.status === 'sacada' ? 'Devolver a resguardo' : 'Desmontar y devolver';
    node.querySelector('[data-action="pick-cancel"]').hidden = !['seleccionada', 'sacada'].includes(pick.status)
      || (Boolean(pick.active_loan_id) && pick.status === 'sacada');
    return node;
}

function passageFromPick(pick) {
  return {
    id: pick.target_passage_id,
    testament: pick.target_testament,
    number: pick.target_passage_number,
    name: pick.target_passage_name,
    image_path: null,
    thumbnail_path: null
  };
}

function summaryFor(picks) {
  const selected = picks.filter((pick) => pick.status !== 'no_seleccionada').length;
  const mounted = picks.filter((pick) => pick.status === 'montada').length;
  const borrowed = picks.filter((pick) => pick.active_loan_id).length;
  const unselected = picks.filter((pick) => pick.status === 'no_seleccionada').length;
  const parts = [`${selected} para montaje`];
  if (mounted) parts.push(`${mounted} montadas`);
  if (borrowed) parts.push(`${borrowed} prestadas`);
  if (unselected) parts.push(`${unselected} no seleccionadas`);
  return parts.join(' · ');
}
