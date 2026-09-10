export function renderLoans({ container, groupTemplate, cardTemplate, loans, labelFor }) {
  container.innerHTML = '';
  if (!loans.length) {
    container.innerHTML = '<p class="empty-state">No hay préstamos para mostrar.</p>';
    return;
  }

  groupLoansByDestination(loans).forEach((groupLoans) => {
    const group = groupTemplate.content.firstElementChild.cloneNode(true);
    const firstLoan = groupLoans[0];
    const photo = group.querySelector('.loan-passage-photo');
    const photoImage = photo.querySelector('img');
    const imagePath = firstLoan.destination_passage_image_path;
    const previewPath = firstLoan.destination_passage_thumbnail_path || imagePath;
    photo.classList.toggle('has-image', Boolean(previewPath));
    photoImage.loading = 'lazy';
    photoImage.decoding = 'async';
    photoImage.src = previewPath || '';
    photoImage.dataset.fullImage = imagePath || previewPath || '';
    photoImage.alt = previewPath ? `Foto del pasaje ${destinationName(firstLoan)}` : '';
    group.querySelector('.loan-passage-reference').textContent = destinationReference(firstLoan);
    group.querySelector('.loan-passage-name').textContent = destinationName(firstLoan);
    group.querySelector('.loan-passage-summary').textContent = summaryFor(groupLoans);

    const grid = group.querySelector('.loan-card-grid');
    groupLoans.forEach((loan) => grid.appendChild(createLoanCard(cardTemplate, loan, labelFor)));
    container.appendChild(group);
  });
}

function createLoanCard(template, loan, labelFor) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.loanId = loan.id;
    node.classList.add(`status-${loan.status}`);
    node.classList.toggle('is-overdue', isOverdue(loan));
    node.classList.toggle('is-due-soon', isDueSoon(loan));
    const previewPath = loan.thumbnail_path || loan.image_path;
    node.classList.toggle('has-image', Boolean(previewPath));
    const image = node.querySelector('.loan-image');
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = previewPath || '';
    image.dataset.fullImage = loan.image_path || previewPath || '';
    image.alt = previewPath ? loan.piece_name : '';
    node.querySelector('.loan-piece').textContent = `${loan.internal_code} · ${loan.piece_name}`;
    node.querySelector('.loan-passage').textContent = `Origen: ${loan.testament} P${loan.passage_number} · ${loan.passage_name}`;
    node.querySelector('.loan-recipient').textContent = `Destino: ${destinationReference(loan)} · ${destinationName(loan)}`;
    node.querySelector('.loan-dates').textContent = loanDateText(loan);
    const notes = [];
    if (loan.notes) notes.push(`Salida: ${loan.notes}`);
    if (loan.return_notes) notes.push(`Devolución: ${loan.return_notes}`);
    node.querySelector('.loan-notes').textContent = notes.join(' · ');
    node.querySelector('.loan-status').textContent = labelFor(loan.status);
    node.querySelector('.loan-return-button').hidden = loan.status !== 'activo';
    return node;
}

export function formatDateOnly(value) {
  if (!value) return 'sin fecha';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX').format(new Date(year, month - 1, day));
}

export function formatSqliteTimestamp(value) {
  if (!value) return 'sin fecha';
  const isoValue = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(isoValue).toLocaleString('es-MX');
}

function loanDateText(loan) {
  const checkout = formatSqliteTimestamp(loan.checkout_date);
  if (loan.status === 'devuelto') return `Salida: ${checkout} · Regresó: ${formatSqliteTimestamp(loan.returned_at)}`;
  const expected = loan.expected_return_date ? formatDateOnly(loan.expected_return_date) : 'sin fecha esperada';
  const urgency = isOverdue(loan) ? ' · Atrasado' : isDueSoon(loan) ? ' · Próximo' : '';
  return `Salida: ${checkout} · Esperado: ${expected}${urgency}`;
}

function groupLoansByDestination(loans) {
  const groups = new Map();
  loans.forEach((loan) => {
    const key = loan.loaned_to_passage_id || loan.loaned_to || 'sin-destino';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(loan);
  });
  return groups;
}

function destinationReference(loan) {
  if (loan.destination_testament && loan.destination_passage_number) {
    return `${loan.destination_testament} P${loan.destination_passage_number}`;
  }
  return 'Destino sin pasaje';
}

function destinationName(loan) {
  return loan.destination_passage_name || loan.loaned_to || 'Sin destino registrado';
}

function summaryFor(loans) {
  const active = loans.filter((loan) => loan.status === 'activo').length;
  const returned = loans.filter((loan) => loan.status === 'devuelto').length;
  const overdue = loans.filter(isOverdue).length;
  const soon = loans.filter(isDueSoon).length;
  const parts = [`${loans.length} préstamos`];
  if (active) parts.push(`${active} activos`);
  if (returned) parts.push(`${returned} devueltos`);
  if (overdue) parts.push(`${overdue} atrasados`);
  else if (soon) parts.push(`${soon} próximos`);
  return parts.join(' · ');
}

function isOverdue(loan) {
  return loan.status === 'activo'
    && Boolean(loan.expected_return_date)
    && loan.expected_return_date < todayValue();
}

function isDueSoon(loan) {
  if (loan.status !== 'activo' || !loan.expected_return_date || isOverdue(loan)) return false;
  const due = new Date(`${loan.expected_return_date}T00:00:00`);
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + 7);
  return due <= limit;
}

function todayValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');
}
