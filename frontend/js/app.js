import {
  archivePiece,
  assignShowcasePassages,
  changeOwnPassword,
  createExhibitionPick,
  createPassage,
  createPiece,
  createShowcase,
  createUser,
  deactivateUser,
  deleteUserPermanently,
  getCurrentUser,
  getCustodyAlerts,
  getExhibitionPicks,
  getPassages,
  getPieceLoans,
  getPieceMovements,
  getPieces,
  getPieceStats,
  getShowcases,
  getUsers,
  login,
  logout,
  registerPieceMovement,
  reactivateUser,
  updateUserPassword,
  returnPieceLoan,
  updateExhibitionPickStatus,
  updatePiece,
  updateShowcase,
  uploadPassageImage,
  uploadPieceImage
} from './api.js';
import { renderPassageInventory, renderPieceCards } from './inventory.js';
import { formatSqliteTimestamp, renderLoans } from './loans.js';
import { renderMounting } from './mounting.js';
import { renderShowcases } from './showcases.js';

const state = {
  currentUser: null,
  users: [],
  pieces: [],
  alerts: [],
  loans: [],
  exhibitionPicks: [],
  passages: [],
  showcases: [],
  passageExpansion: new Map()
};

const els = {};
let statusTimer = null;

document.addEventListener('DOMContentLoaded', () => init().catch((error) => setStatus(error.message, true)));

async function init() {
  cacheElements();
  bindEvents();
  await loadComponents();
  await restoreSession();
}

function cacheElements() {
  Object.assign(els, {
    nav: document.querySelector('.top-nav'),
    loginForm: document.getElementById('login-form'),
    loginStatus: document.getElementById('login-status'),
    loginPassword: document.getElementById('login-password'),
    loginPasswordToggle: document.getElementById('login-password-toggle'),
    accountButton: document.getElementById('account-button'),
    accountModal: document.getElementById('account-modal'),
    accountForm: document.getElementById('account-form'),
    accountStatus: document.getElementById('account-status'),
    logoutButton: document.getElementById('logout-button'),
    panels: document.querySelectorAll('[data-view-panel]'),
    filters: document.getElementById('inventory-filters'),
    appStatus: document.getElementById('app-status'),
    grid: document.getElementById('inventory-grid'),
    alertsGrid: document.getElementById('alerts-grid'),
    mountingList: document.getElementById('mounting-list'),
    showcaseGrid: document.getElementById('showcase-grid'),
    showcaseTemplate: document.getElementById('showcase-card-template'),
    showcaseFilters: document.getElementById('showcase-filters'),
    showcaseSearch: document.getElementById('showcase-search'),
    showcaseAssignmentFilter: document.getElementById('showcase-assignment-filter'),
    newShowcaseButton: document.getElementById('new-showcase-button'),
    mountingPassageFilter: document.getElementById('mounting-passage-filter'),
    mountingStatusFilter: document.getElementById('mounting-status-filter'),
    loanList: document.getElementById('loan-list'),
    loanFilters: document.getElementById('loan-filters'),
    loanStatusFilter: document.getElementById('loan-status-filter'),
    loanOriginFilter: document.getElementById('loan-origin-filter'),
    loanDestinationFilter: document.getElementById('loan-destination-filter'),
    loanDueFilter: document.getElementById('loan-due-filter'),
    movementFilters: document.getElementById('movement-filters'),
    clearMovementFiltersButton: document.getElementById('clear-movement-filters'),
    movementList: document.getElementById('movement-list'),
    status: document.getElementById('inventory-status'),
    newPassageButton: document.getElementById('new-passage-button'),
    newPieceButton: document.getElementById('new-piece-button'),
    userForm: document.getElementById('user-form'),
    userList: document.getElementById('user-list'),
    userTemplate: document.getElementById('user-row-template'),
    pieceTemplate: document.getElementById('piece-card-template'),
    passageTemplate: document.getElementById('passage-group-template'),
    movementTemplate: document.getElementById('movement-row-template'),
    mountingTemplate: document.getElementById('mounting-row-template'),
    mountingPassageTemplate: document.getElementById('mounting-passage-template'),
    loanTemplate: document.getElementById('loan-row-template'),
    loanPassageTemplate: document.getElementById('loan-passage-template'),
    passageImageInput: document.getElementById('passage-image-input'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    passwordModal: document.getElementById('password-modal'),
    passwordForm: document.getElementById('password-form'),
    passwordInput: document.getElementById('password-reset-value'),
    passwordStatus: document.getElementById('password-status'),
    imageViewer: document.getElementById('image-viewer'),
    imageViewerImg: document.getElementById('image-viewer-img'),
    componentRoot: document.getElementById('component-root')
  });
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.loginPasswordToggle.addEventListener('click', toggleLoginPassword);
  els.accountButton.addEventListener('click', () => openAccountModal(false));
  els.logoutButton.addEventListener('click', handleLogout);
  els.nav.addEventListener('click', handleNavClick);
  document.getElementById('testament-filter').addEventListener('change', () => populatePassageFilter(state.passages));
  document.getElementById('search-input').addEventListener('input', debounce(loadPieces, 250));
  els.filters.addEventListener('change', (event) => {
    if (event.target.id !== 'search-input') loadPieces();
  });
  els.grid.addEventListener('click', handlePieceAction);
  els.alertsGrid.addEventListener('click', handlePieceAction);
  els.mountingList.addEventListener('click', handleMountingAction);
  els.showcaseGrid.addEventListener('click', handleShowcaseAction);
  els.showcaseSearch.addEventListener('input', debounce(renderShowcaseCatalog, 180));
  els.showcaseFilters.addEventListener('change', renderShowcaseCatalog);
  els.newShowcaseButton.addEventListener('click', () => openShowcaseModal());
  els.mountingPassageFilter.addEventListener('change', loadExhibitionPicks);
  els.mountingStatusFilter.addEventListener('change', loadExhibitionPicks);
  els.loanList.addEventListener('click', handleLoanAction);
  els.loanFilters.addEventListener('change', loadLoans);
  els.movementFilters.addEventListener('change', loadMovements);
  els.clearMovementFiltersButton.addEventListener('click', clearMovementFilters);
  els.newPassageButton.addEventListener('click', openPassageModal);
  els.newPieceButton.addEventListener('click', () => openPieceModal());
  els.userForm.addEventListener('submit', saveUser);
  els.userList.addEventListener('click', handleUserAction);
  els.confirmModal.addEventListener('click', handleConfirmModalClick);
  els.passwordModal.addEventListener('click', handlePasswordModalClick);
  els.passwordForm.addEventListener('submit', handlePasswordSubmit);
  els.accountModal.addEventListener('click', handleAccountModalClick);
  els.accountForm.addEventListener('submit', saveOwnPassword);
  window.addEventListener('inventory:unauthorized', showLogin);
  document.addEventListener('click', closePresenceMenusOnOutsideClick);
  document.addEventListener('click', handleImageViewerClick);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModals();
    if (event.key === 'Escape') closeAccountModal();
    if (event.key === 'Escape') closeConfirmModal(false);
    if (event.key === 'Escape') closePasswordModal(null);
    if (event.key === 'Escape') closeImageViewer();
  });
}

async function restoreSession() {
  try {
    const result = await getCurrentUser();
    await enterApplication(result.user);
  } catch (error) {
    showLogin();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.loginForm));
  const submitButton = els.loginForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.loginStatus, 'Verificando acceso...');
    const result = await login(data.email, data.password);
    els.loginForm.reset();
    setModalStatus(els.loginStatus, '');
    await enterApplication(result.user);
  } catch (error) {
    setModalStatus(els.loginStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
  } finally {
    state.currentUser = null;
    showLogin();
  }
}

async function enterApplication(user) {
  state.currentUser = user;
  document.body.classList.add('is-authenticated');
  document.body.classList.toggle('is-admin', user.role === 'admin');
  document.body.classList.toggle('is-readonly', user.role === 'consulta');
  activateView('inventory');
  if (user.must_change_password) {
    document.body.classList.add('password-change-required');
    openAccountModal(true);
    return;
  }
  document.body.classList.remove('password-change-required');
  await refreshAll();
  if (user.role === 'admin') await loadUsers();
}

function showLogin(message = '') {
  document.body.classList.remove('is-authenticated', 'is-admin', 'is-readonly', 'password-change-required');
  state.currentUser = null;
  state.passageExpansion.clear();
  setLoginPasswordVisibility(false);
  closeAccountModal(true);
  if (typeof message === 'string') setModalStatus(els.loginStatus, message);
}

function toggleLoginPassword() {
  setLoginPasswordVisibility(els.loginPassword.type === 'password');
}

function setLoginPasswordVisibility(visible) {
  els.loginPassword.type = visible ? 'text' : 'password';
  const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
  els.loginPasswordToggle.setAttribute('aria-label', label);
  els.loginPasswordToggle.setAttribute('aria-pressed', String(visible));
  els.loginPasswordToggle.title = label;
}

function openAccountModal(required) {
  if (!state.currentUser) return;
  els.accountForm.reset();
  setModalStatus(els.accountStatus, '');
  document.getElementById('account-user-name').textContent = state.currentUser.name;
  document.getElementById('account-user-email').textContent = state.currentUser.email;
  document.getElementById('account-eyebrow').textContent = required ? 'Primer acceso' : 'Mi cuenta';
  document.getElementById('account-guidance').textContent = required
    ? 'Tu acceso usa una contraseña temporal. Crea una contraseña personal para continuar.'
    : 'Usa tu contraseña actual para confirmar el cambio.';
  els.accountModal.querySelectorAll('[data-account-close]').forEach((button) => {
    button.hidden = Boolean(required);
  });
  openModal(els.accountModal);
}

function handleAccountModalClick(event) {
  if (event.target.closest('[data-account-close]')) closeAccountModal();
  if (event.target === els.accountModal) closeAccountModal();
}

function closeAccountModal(force = false) {
  if (!els.accountModal || (document.body.classList.contains('password-change-required') && !force)) return;
  els.accountModal.classList.remove('is-open');
  els.accountModal.setAttribute('aria-hidden', 'true');
}

async function saveOwnPassword(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.accountForm));
  if (data.password !== data.password_confirmation) {
    setModalStatus(els.accountStatus, 'La confirmación de la contraseña no coincide', true);
    return;
  }
  const submitButton = els.accountForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.accountStatus, 'Actualizando contraseña...');
    await changeOwnPassword(data.current_password, data.password, data.password_confirmation);
    showLogin('Contraseña actualizada. Entra nuevamente con tu nueva contraseña.');
  } catch (error) {
    setModalStatus(els.accountStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function loadComponents() {
  const fragments = await Promise.all([
    fetchComponent('/frontend/components/piece-form.html'),
    fetchComponent('/frontend/components/passage-form.html'),
    fetchComponent('/frontend/components/condition-dialog.html'),
    fetchComponent('/frontend/components/return-loan-dialog.html'),
    fetchComponent('/frontend/components/exhibition-pick-dialog.html'),
    fetchComponent('/frontend/components/showcase-form.html'),
    fetchComponent('/frontend/components/showcase-assignment-dialog.html')
  ]);
  els.componentRoot.innerHTML = fragments.join('');

  els.pieceModal = document.getElementById('piece-modal');
  els.pieceForm = document.getElementById('piece-form');
  els.passageModal = document.getElementById('passage-modal');
  els.passageForm = document.getElementById('passage-form');
  els.passageStatus = document.getElementById('passage-status');
  els.conditionModal = document.getElementById('condition-modal');
  els.conditionForm = document.getElementById('condition-form');
  els.exhibitionPickModal = document.getElementById('exhibition-pick-modal');
  els.exhibitionPickForm = document.getElementById('exhibition-pick-form');
  els.exhibitionPickStatus = document.getElementById('exhibition-pick-status');
  els.returnLoanModal = document.getElementById('return-loan-modal');
  els.returnLoanForm = document.getElementById('return-loan-form');
  els.returnLoanStatus = document.getElementById('return-loan-status');
  els.imageInput = document.getElementById('image-input');
  els.showcaseModal = document.getElementById('showcase-modal');
  els.showcaseForm = document.getElementById('showcase-form');
  els.showcaseFormStatus = document.getElementById('showcase-form-status');
  els.showcaseAssignmentModal = document.getElementById('showcase-assignment-modal');
  els.showcaseAssignmentForm = document.getElementById('showcase-assignment-form');
  els.showcaseAssignmentStatus = document.getElementById('showcase-assignment-status');
  els.showcasePassageSearch = document.getElementById('showcase-passage-search');
  els.showcasePassageList = document.getElementById('showcase-passage-list');

  els.pieceModal.addEventListener('click', closeOnBackdrop);
  els.passageModal.addEventListener('click', closeOnBackdrop);
  els.conditionModal.addEventListener('click', closeOnBackdrop);
  els.exhibitionPickModal.addEventListener('click', closeOnBackdrop);
  els.returnLoanModal.addEventListener('click', closeOnBackdrop);
  els.showcaseModal.addEventListener('click', closeOnBackdrop);
  els.showcaseAssignmentModal.addEventListener('click', closeOnBackdrop);
  els.pieceForm.addEventListener('submit', savePiece);
  els.passageForm.addEventListener('submit', savePassage);
  els.conditionForm.addEventListener('submit', saveCondition);
  els.exhibitionPickForm.addEventListener('submit', saveExhibitionPick);
  document.getElementById('exhibition-pick-target-passage').addEventListener('change', updateExhibitionBorrowFields);
  els.returnLoanForm.addEventListener('submit', saveReturnLoan);
  els.showcaseForm.addEventListener('submit', saveShowcase);
  els.showcaseAssignmentForm.addEventListener('submit', saveShowcaseAssignments);
  els.showcasePassageSearch.addEventListener('input', filterPassageAssignments);
  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', closeModals);
  });
}

async function fetchComponent(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);
  return response.text();
}

async function refreshAll() {
  await Promise.all([loadPassages(), loadShowcases()]);
  await Promise.all([loadStats(), loadPieces(), loadAlerts(), loadMovements(), loadLoans(), loadExhibitionPicks()]);
}

async function refreshOperationalData() {
  await Promise.all([loadStats(), loadPieces(), loadAlerts(), loadMovements(), loadLoans(), loadExhibitionPicks()]);
}

async function loadStats() {
  const stats = await getPieceStats();
  document.getElementById('stat-pieces').textContent = stats.totals.pieces;
  document.getElementById('stat-loaned').textContent = stats.totals.loaned;
  document.getElementById('stat-missing').textContent = stats.totals.in_restoration;
  document.getElementById('stat-maintenance').textContent = stats.totals.maintenance;
}

async function loadPassages() {
  state.passages = await getPassages();
  populatePassageFilter(state.passages);
  populateMountingPassageFilter(state.passages);
  populateLoanPassageFilters(state.passages);
}

let pieceRequestSequence = 0;
async function loadPieces() {
  const requestSequence = ++pieceRequestSequence;
  try {
    const pieces = await getPieces(getFilterValues());
    if (requestSequence !== pieceRequestSequence) return;
    state.pieces = pieces;
    renderInventory();
    els.status.textContent = `${state.pieces.length} piezas sincronizadas desde SQLite.`;
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadShowcases() {
  state.showcases = await getShowcases();
  populateShowcaseFilter(state.showcases);
  renderShowcaseCatalog();
}

async function loadAlerts() {
  state.alerts = await getCustodyAlerts();
  renderPieceCards(els.alertsGrid, state.alerts, els.pieceTemplate, labelFor);
}

async function loadMovements() {
  const movements = await getPieceMovements(getMovementFilterValues());
  els.movementList.innerHTML = '';
  if (!movements.length) {
    els.movementList.innerHTML = '<p class="empty-state">Sin movimientos registrados.</p>';
    return;
  }
  movements.forEach((movement) => {
    const node = els.movementTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.movement-type').textContent = labelFor(movement.type);
    node.querySelector('.movement-piece').textContent = `${movement.internal_code} · ${movement.piece_name}`;
    const changedPresence = movement.from_presence_status !== movement.to_presence_status;
    node.querySelector('.movement-transition').textContent = changedPresence
      ? `${labelFor(movement.from_presence_status) || '-'} → ${labelFor(movement.to_presence_status) || '-'}`
      : labelFor(movement.to_presence_status) || '-';
    node.querySelector('.movement-detail').textContent = movementDetails(movement);
    node.querySelector('.movement-date').textContent = formatSqliteTimestamp(movement.created_at);
    els.movementList.appendChild(node);
  });
}

async function loadLoans() {
  state.loans = await getPieceLoans({
    status: els.loanStatusFilter.value,
    originPassageId: els.loanOriginFilter.value,
    destinationPassageId: els.loanDestinationFilter.value,
    due: els.loanDueFilter.value
  });
  renderLoans({
    container: els.loanList,
    groupTemplate: els.loanPassageTemplate,
    cardTemplate: els.loanTemplate,
    loans: state.loans,
    labelFor
  });
}

async function loadUsers() {
  if (state.currentUser?.role !== 'admin') return;
  state.users = await getUsers();
  renderUsers();
}

async function loadExhibitionPicks() {
  state.exhibitionPicks = await getExhibitionPicks({
    targetPassageId: els.mountingPassageFilter.value,
    status: els.mountingStatusFilter.value
  });
  renderMounting({
    container: els.mountingList,
    groupTemplate: els.mountingPassageTemplate,
    cardTemplate: els.mountingTemplate,
    picks: state.exhibitionPicks,
    passages: state.passages,
    labelFor
  });
}

function renderInventory() {
  renderPassageInventory({
    container: els.grid,
    pieces: state.pieces,
    passages: state.passages,
    passageTemplate: els.passageTemplate,
    pieceTemplate: els.pieceTemplate,
    filters: getFilterValues(),
    passageExpansion: state.passageExpansion,
    labelFor
  });
}

function renderShowcaseCatalog() {
  renderShowcases({
    container: els.showcaseGrid,
    template: els.showcaseTemplate,
    showcases: state.showcases,
    filters: {
      q: els.showcaseSearch.value,
      assignment: els.showcaseAssignmentFilter.value
    }
  });
}

function getFilterValues() {
  const passageValue = document.getElementById('passage-filter').value;
  const [passageTestament, passageNumber] = passageValue ? passageValue.split(':') : ['', ''];
  return {
    q: document.getElementById('search-input').value.trim(),
    testament: passageTestament || document.getElementById('testament-filter').value,
    passageNumber,
    showcase: document.getElementById('showcase-filter').value,
    presenceStatus: document.getElementById('presence-filter').value,
    conditionStatus: document.getElementById('condition-filter').value,
    maintenanceRequired: document.getElementById('maintenance-filter').checked
  };
}

function handleNavClick(event) {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  if (button.dataset.view === 'users' && state.currentUser?.role !== 'admin') return;
  activateView(button.dataset.view);
}

function activateView(view) {
  const button = document.querySelector(`[data-view="${view}"]`);
  if (!button) return;
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('is-active', item === button));
  els.panels.forEach((panel) => panel.classList.toggle('is-hidden', panel.dataset.viewPanel !== view));
  if (view === 'users') loadUsers();
}

async function handlePieceAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'passage-image') {
    choosePassageImage(button.dataset.passageId);
    return;
  }

  const card = button.closest('[data-piece-id]');
  if (!card) return;
  const piece = findPiece(card.dataset.pieceId);
  if (!piece) return;

  if (action === 'edit') openPieceModal(piece);
  if (action === 'archive') await archiveSelectedPiece(piece);
  if (action === 'present') await quickMovement(piece, 'ingreso', { presence_status: 'en_caja' });
  if (action === 'showcase') await quickMovement(piece, 'ingreso', { presence_status: 'en_vitrina' });
  if (action === 'restoration-presence') {
    await quickMovement(piece, 'mantenimiento', {
      presence_status: 'en_mantenimiento',
      condition_status: 'en_mantenimiento'
    });
  }
  if (action === 'condition') openConditionModal(piece);
  if (action === 'select-exhibition') openExhibitionPickModal(piece);
  if (action === 'image') chooseImage(piece);
}

function handleShowcaseAction(event) {
  const button = event.target.closest('[data-action]');
  const card = button?.closest('[data-showcase-id]');
  if (!button || !card) return;
  const showcase = state.showcases.find((item) => String(item.id) === card.dataset.showcaseId);
  if (!showcase) return;
  if (button.dataset.action === 'edit-showcase') openShowcaseModal(showcase);
  if (button.dataset.action === 'assign-passages') openShowcaseAssignment(showcase);
}

async function handleMountingAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('[data-pick-id]');
  if (!row) return;

  if (button.dataset.action === 'pick-return') {
    const pick = state.exhibitionPicks.find((item) => String(item.id) === String(row.dataset.pickId));
    if (pick?.active_loan_id) openReturnLoanModal({ id: pick.active_loan_id, internal_code: pick.internal_code });
    return;
  }

  const nextStatus = {
    'pick-out': 'sacada',
    'pick-mounted': 'montada',
    'pick-finished': 'finalizada',
    'pick-cancel': 'cancelada'
  }[button.dataset.action];
  if (!nextStatus) return;
  if (nextStatus === 'cancelada') {
    const pick = state.exhibitionPicks.find((item) => String(item.id) === String(row.dataset.pickId));
    const pieceLabel = pick ? `${pick.internal_code} · ${pick.piece_name}` : 'esta pieza';
    const confirmed = await confirmAction({
      title: 'Cancelar salida',
      message: `Vas a quitar ${pieceLabel} de la guía de montaje. La pieza ya no aparecerá como seleccionada para salir.`,
      acceptLabel: 'Cancelar salida'
    });
    if (!confirmed) return;
  }
  await updatePick(row.dataset.pickId, nextStatus);
}

function handleLoanAction(event) {
  const button = event.target.closest('[data-action="return-loan"]');
  if (!button) return;
  const row = button.closest('[data-loan-id]');
  const loan = state.loans.find((item) => String(item.id) === String(row.dataset.loanId));
  if (loan) openReturnLoanModal(loan);
}

async function handleUserAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const row = button.closest('[data-user-id]');
  if (!row) return;
  const user = state.users.find((item) => String(item.id) === String(row.dataset.userId));
  if (!user) return;

  if (button.dataset.action === 'deactivate-user') {
    const confirmed = await confirmAction({
      title: 'Desactivar usuario',
      message: `Vas a desactivar el acceso de ${user.name}. Esta persona ya no podrá entrar al inventario.`,
      acceptLabel: 'Desactivar'
    });
    if (!confirmed) return;
    try {
      await deactivateUser(user.id);
      await loadUsers();
      setStatus('Usuario desactivado.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (button.dataset.action === 'reactivate-user') {
    try {
      await reactivateUser(user.id);
      await loadUsers();
      setStatus('Usuario reactivado. Ya puede iniciar sesión nuevamente.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (button.dataset.action === 'delete-user') {
    const confirmed = await confirmAction({
      title: 'Eliminar usuario definitivamente',
      message: `Vas a eliminar permanentemente la cuenta de ${user.name}. Esta acción no se puede deshacer.`,
      acceptLabel: 'Eliminar definitivamente'
    });
    if (!confirmed) return;
    try {
      await deleteUserPermanently(user.id);
      await loadUsers();
      setStatus('Usuario eliminado definitivamente.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  if (button.dataset.action === 'reset-user-password') {
    const password = await requestPassword();
    if (!password) return;
    try {
      await updateUserPassword(user.id, password);
      await loadUsers();
      setStatus('Contraseña temporal asignada. Se solicitará cambiarla al entrar.');
    } catch (error) {
      setStatus(error.message, true);
    }
  }
}

async function saveUser(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.userForm));
  const submitButton = els.userForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    await createUser(data);
    els.userForm.reset();
    await loadUsers();
    setStatus('Usuario creado.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

function renderUsers() {
  els.userList.innerHTML = '';
  if (!state.users.length) {
    els.userList.innerHTML = '<p class="empty-state">No hay usuarios registrados.</p>';
    return;
  }
  state.users.forEach((user) => {
    const node = els.userTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.userId = user.id;
    node.classList.toggle('is-disabled', !user.active);
    node.querySelector('.user-name').textContent = user.name;
    node.querySelector('.user-email').textContent = user.email;
    node.querySelector('.user-role').textContent = labelFor(user.role);
    node.querySelector('.user-state').textContent = user.active ? 'Activo' : 'Inactivo';
    const passwordState = node.querySelector('.user-password-state');
    passwordState.textContent = user.must_change_password ? 'Cambio pendiente' : 'Contraseña personal';
    passwordState.classList.toggle('is-pending', Boolean(user.must_change_password));
    node.querySelector('[data-action="deactivate-user"]').hidden = !user.active || user.id === state.currentUser?.id;
    node.querySelector('[data-action="reactivate-user"]').hidden = Boolean(user.active);
    node.querySelector('[data-action="delete-user"]').hidden = Boolean(user.active) || user.id === state.currentUser?.id;
    els.userList.appendChild(node);
  });
}

function handleImageViewerClick(event) {
  const image = event.target.closest('.piece-image, .mounting-image, .mounting-passage-photo img, .passage-photo img, .loan-image, .loan-passage-photo img');
  if (image?.src) {
    openImageViewer(image.dataset.fullImage || image.src, image.alt);
    return;
  }
  if (event.target.closest('.image-viewer-close') || event.target === els.imageViewer) closeImageViewer();
}

function handleConfirmModalClick(event) {
  if (event.target === els.confirmModal || event.target.closest('[data-confirm-cancel]')) {
    closeConfirmModal(false);
    return;
  }
  if (event.target.closest('[data-confirm-accept]')) closeConfirmModal(true);
}

function handlePasswordModalClick(event) {
  if (event.target === els.passwordModal || event.target.closest('[data-password-cancel]')) {
    closePasswordModal(null);
  }
}

function handlePasswordSubmit(event) {
  event.preventDefault();
  const password = els.passwordInput.value;
  if (password.length < 8) {
    setModalStatus(els.passwordStatus, 'La contraseña debe tener al menos 8 caracteres', true);
    return;
  }
  closePasswordModal(password);
}

function openPieceModal(piece) {
  els.pieceForm.reset();
  setFormValue('piece-id', piece?.id || '');
  setFormValue('internal_code', piece?.internal_code || '');
  setFormValue('name', piece?.name || '');
  setFormValue('testament', piece?.testament || 'AT');
  setFormValue('passage_number', piece?.passage_number || '');
  setFormValue('registry_number', piece?.registry_number || '');
  setFormValue('global_number', piece?.global_number || '');
  setFormValue('box', piece?.box || '');
  setFormValue('drawer', piece?.drawer || '');
  setFormValue('exhibition_location', piece?.exhibition_location || '');
  setFormValue('custodian', piece?.custodian || '');
  setFormValue('material', piece?.material || '');
  setFormValue('deep', piece?.deep || '');
  setFormValue('length', piece?.length || '');
  setFormValue('height', piece?.height || '');
  setFormValue('observations', piece?.observations || '');
  openModal(els.pieceModal);
}

function openConditionModal(piece) {
  els.conditionForm.reset();
  setFormValue('condition-piece-id', piece.id);
  setFormValue('condition-status', piece.condition_status || 'sin_revisar');
  document.getElementById('condition-title').textContent = `Conservación · ${piece.internal_code}`;
  openModal(els.conditionModal);
}

function openExhibitionPickModal(piece) {
  els.exhibitionPickForm.reset();
  setFormValue('exhibition-pick-piece-id', piece.id);
  populateExhibitionPickTargetSelect(piece);
  updateExhibitionBorrowFields();
  setModalStatus(els.exhibitionPickStatus, '');
  document.getElementById('exhibition-pick-title').textContent = `Salida a exposición · ${piece.internal_code}`;
  openModal(els.exhibitionPickModal);
}

function openPassageModal() {
  els.passageForm.reset();
  setModalStatus(els.passageStatus, '');
  openModal(els.passageModal);
}

function openShowcaseModal(showcase = null) {
  els.showcaseForm.reset();
  setFormValue('showcase-id', showcase?.id || '');
  setFormValue('showcase-code', showcase?.code || '');
  setFormValue('showcase-name', showcase?.name || '');
  setFormValue('showcase-support-type', showcase?.support_type || 'Vitrina');
  setFormValue('showcase-shape', showcase?.shape || 'rectangular');
  setFormValue('showcase-location', showcase?.location || '');
  setFormValue('showcase-length', showcase?.length_cm || '');
  setFormValue('showcase-width', showcase?.width_cm || '');
  setFormValue('showcase-height', showcase?.height_cm || '');
  setFormValue('showcase-diameter', showcase?.diameter_cm || '');
  setFormValue('showcase-measurement-notes', showcase?.measurement_notes || '');
  setFormValue('showcase-observations', showcase?.observations || '');
  document.getElementById('showcase-form-title').textContent = showcase ? `Editar · ${showcase.code}` : 'Nueva vitrina';
  setModalStatus(els.showcaseFormStatus, '');
  openModal(els.showcaseModal);
}

function openShowcaseAssignment(showcase) {
  els.showcaseAssignmentForm.reset();
  setFormValue('showcase-assignment-id', showcase.id);
  document.getElementById('showcase-assignment-title').textContent = `${showcase.code} · ${showcase.name}`;
  els.showcasePassageSearch.value = '';
  setModalStatus(els.showcaseAssignmentStatus, '');
  renderPassageAssignments(showcase);
  openModal(els.showcaseAssignmentModal);
}

function renderPassageAssignments(showcase) {
  els.showcasePassageList.innerHTML = '';
  state.passages.forEach((passage) => {
    const row = document.createElement('label');
    row.className = 'passage-assignment-row';
    row.dataset.search = `${passage.testament} p${passage.number} ${passage.name}`.toLocaleLowerCase('es-MX');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'passage_ids';
    checkbox.value = passage.id;
    checkbox.checked = Number(passage.showcase_id) === Number(showcase.id);
    const identity = document.createElement('span');
    identity.className = 'passage-assignment-identity';
    const title = document.createElement('strong');
    title.textContent = `${passage.testament} P${passage.number} · ${passage.name}`;
    const detail = document.createElement('small');
    detail.textContent = passage.showcase_id && Number(passage.showcase_id) !== Number(showcase.id)
      ? `Actualmente en ${passage.showcase_code}`
      : `${passage.pieces} piezas`;
    identity.append(title, detail);
    row.append(checkbox, identity);
    els.showcasePassageList.appendChild(row);
  });
}

function filterPassageAssignments() {
  const query = els.showcasePassageSearch.value.trim().toLocaleLowerCase('es-MX');
  els.showcasePassageList.querySelectorAll('.passage-assignment-row').forEach((row) => {
    row.hidden = Boolean(query) && !row.dataset.search.includes(query);
  });
}

function openReturnLoanModal(loan) {
  els.returnLoanForm.reset();
  setFormValue('return-loan-id', loan.id);
  setFormValue('return-presence-status', 'en_caja');
  setFormValue('return-condition-status', 'bueno');
  setModalStatus(els.returnLoanStatus, '');
  document.getElementById('return-loan-title').textContent = `Devolución · ${loan.internal_code}`;
  openModal(els.returnLoanModal);
}

function getMovementFilterValues() {
  return {
    dateFrom: document.getElementById('movement-date-from').value,
    dateTo: document.getElementById('movement-date-to').value
  };
}

function movementDetails(movement) {
  const details = [];
  if (movement.responsible) details.push(`Responsable: ${movement.responsible}`);
  if (movement.counterparty) details.push(`Destino: ${movement.counterparty}`);
  if (movement.reason) details.push(movement.reason);
  return details.join(' · ');
}

function clearMovementFilters() {
  document.getElementById('movement-date-from').value = '';
  document.getElementById('movement-date-to').value = '';
  loadMovements();
}

function closePresenceMenusOnOutsideClick(event) {
  if (event.target.closest('.action-menu')) return;
  document.querySelectorAll('.action-menu[open]').forEach((menu) => menu.removeAttribute('open'));
}

async function savePiece(event) {
  event.preventDefault();
  try {
    const data = piecePayload(new FormData(els.pieceForm));
    const id = data.id;
    delete data.id;
    if (id) await updatePiece(id, data);
    else await createPiece(data);
    closeModals();
    await refreshAll();
    setStatus('Pieza guardada.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function savePassage(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.passageForm));
  const submitButton = els.passageForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.passageStatus, 'Creando pasaje...');
    await createPassage({
      testament: data.testament,
      number: Number(data.number),
      name: data.name,
      box: data.box,
      drawer: data.drawer,
      observations: data.observations
    });
    closeModals();
    await refreshAll();
    setStatus('Pasaje creado.');
  } catch (error) {
    setModalStatus(els.passageStatus, error.message, true);
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function saveShowcase(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.showcaseForm));
  const id = data.id;
  delete data.id;
  const submitButton = els.showcaseForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.showcaseFormStatus, 'Guardando vitrina...');
    if (id) await updateShowcase(id, data);
    else await createShowcase(data);
    closeModals();
    await loadShowcases();
    setStatus('Vitrina guardada.');
  } catch (error) {
    setModalStatus(els.showcaseFormStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function saveShowcaseAssignments(event) {
  event.preventDefault();
  const data = new FormData(els.showcaseAssignmentForm);
  const showcaseId = Number(data.get('showcase_id'));
  const passageIds = data.getAll('passage_ids').map(Number);
  const showcase = state.showcases.find((item) => item.id === showcaseId);
  const reassigned = state.passages.filter((passage) => (
    passageIds.includes(Number(passage.id))
    && passage.showcase_id
    && Number(passage.showcase_id) !== showcaseId
  ));
  if (reassigned.length) {
    const confirmed = await confirmAction({
      title: 'Reasignar pasajes',
      message: `${reassigned.length} pasaje${reassigned.length === 1 ? '' : 's'} cambiará${reassigned.length === 1 ? '' : 'n'} de vitrina a ${showcase.code}.`,
      acceptLabel: 'Reasignar'
    });
    if (!confirmed) return;
  }
  const submitButton = els.showcaseAssignmentForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.showcaseAssignmentStatus, 'Guardando asignación...');
    await assignShowcasePassages(showcaseId, passageIds);
    closeModals();
    await Promise.all([loadPassages(), loadShowcases()]);
    await loadPieces();
    setStatus('Asignación de vitrina actualizada.');
  } catch (error) {
    setModalStatus(els.showcaseAssignmentStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function saveCondition(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.conditionForm));
  const piece = findPiece(data.piece_id);
  try {
    await registerPieceMovement(data.piece_id, {
      type: 'mantenimiento',
      presence_status: data.condition_status === 'en_mantenimiento' ? 'en_mantenimiento' : piece?.presence_status,
      condition_status: data.condition_status,
      responsible: data.responsible,
      reason: data.reason
    });
    closeModals();
    await refreshOperationalData();
    setStatus('Conservación actualizada.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveExhibitionPick(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.exhibitionPickForm));
  const piece = findPiece(data.piece_id);
  const submitButton = els.exhibitionPickForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.exhibitionPickStatus, 'Agregando a guía...');
    await createExhibitionPick(data.piece_id, {
      target_passage_id: Number(data.target_passage_id),
      requested_by: data.requested_by,
      expected_return_date: data.expected_return_date,
      responsible_out: data.responsible_out,
      notes: data.notes
    });
    closeModals();
    await refreshOperationalData();
    const borrowed = piece && Number(data.target_passage_id) !== piece.passage_id;
    setStatus(borrowed ? 'Salida y préstamo registrados.' : 'Pieza agregada a la guía de salida.');
  } catch (error) {
    setModalStatus(els.exhibitionPickStatus, error.message, true);
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function saveReturnLoan(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(els.returnLoanForm));
  const submitButton = els.returnLoanForm.querySelector('button[type="submit"]');
  try {
    submitButton.disabled = true;
    setModalStatus(els.returnLoanStatus, 'Registrando devolución...');
    await returnPieceLoan(data.loan_id, {
      presence_status: data.presence_status,
      condition_status: data.condition_status,
      responsible_in: data.responsible_in,
      notes: data.notes
    });
    setModalStatus(els.returnLoanStatus, 'Devolución registrada.');
    closeModals();
    await refreshOperationalData();
    setStatus('Devolución registrada.');
  } catch (error) {
    setModalStatus(els.returnLoanStatus, error.message, true);
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
}

async function updatePick(id, status) {
  try {
    await updateExhibitionPickStatus(id, { status });
    await refreshOperationalData();
    setStatus(`Guía actualizada: ${labelFor(status)}.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function quickMovement(piece, type, updates) {
  try {
    await registerPieceMovement(piece.id, {
      type,
      condition_status: piece.condition_status,
      responsible: '',
      reason: labelFor(type),
      ...updates
    });
    await refreshOperationalData();
    setStatus('Estado actualizado.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function archiveSelectedPiece(piece) {
  const confirmed = await confirmAction({
    title: 'Archivar pieza',
    message: `Vas a archivar ${piece.internal_code} · ${piece.name}. La pieza dejará de aparecer en el inventario activo.`,
    acceptLabel: 'Archivar'
  });
  if (!confirmed) return;
  try {
    await archivePiece(piece.id);
    await refreshAll();
    setStatus('Pieza archivada.');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function chooseImage(piece) {
  els.imageInput.onchange = async () => {
    if (!els.imageInput.files.length) return;
    try {
      await uploadPieceImage(piece.id, els.imageInput.files[0]);
      await Promise.all([loadPieces(), loadAlerts()]);
      setStatus('Imagen subida y vinculada.');
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      els.imageInput.value = '';
    }
  };
  els.imageInput.click();
}

function choosePassageImage(passageId) {
  els.passageImageInput.onchange = async () => {
    if (!els.passageImageInput.files.length) return;
    try {
      await uploadPassageImage(passageId, els.passageImageInput.files[0]);
      els.passageImageInput.value = '';
      await loadPassages();
      renderInventory();
      setStatus('Foto de pasaje actualizada.');
    } catch (error) {
      setStatus(error.message, true);
    }
  };
  els.passageImageInput.click();
}

function piecePayload(formData) {
  const data = Object.fromEntries(formData);
  return {
    id: data.id,
    internal_code: data.internal_code.trim(),
    name: data.name.trim(),
    testament: data.testament,
    passage_number: Number(data.passage_number),
    registry_number: data.registry_number.trim(),
    global_number: data.global_number ? Number(data.global_number) : null,
    box: data.box.trim(),
    drawer: data.drawer.trim(),
    exhibition_location: data.exhibition_location.trim(),
    custodian: data.custodian.trim(),
    material: data.material.trim(),
    deep: data.deep.trim(),
    length: data.length.trim(),
    height: data.height.trim(),
    observations: data.observations.trim()
  };
}

function findPiece(id) {
  return [...state.pieces, ...state.alerts].find((piece) => String(piece.id) === String(id));
}

function closeOnBackdrop(event) {
  if (event.target.classList.contains('modal-backdrop')) closeModals();
}

function openModal(modal) {
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  modal.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
}

function closeModals() {
  document.querySelectorAll('.modal-backdrop:not(#confirm-modal):not(#password-modal):not(#account-modal)').forEach((modal) => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.action-menu[open]').forEach((menu) => menu.removeAttribute('open'));
}

let pendingConfirmation = null;
let pendingPassword = null;

function confirmAction({ title, message, acceptLabel }) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmModal.querySelector('[data-confirm-accept]').textContent = acceptLabel;
  openModal(els.confirmModal);
  return new Promise((resolve) => {
    pendingConfirmation = resolve;
  });
}

function closeConfirmModal(accepted) {
  if (!els.confirmModal.classList.contains('is-open')) return;
  els.confirmModal.classList.remove('is-open');
  els.confirmModal.setAttribute('aria-hidden', 'true');
  if (pendingConfirmation) pendingConfirmation(Boolean(accepted));
  pendingConfirmation = null;
}

function requestPassword() {
  els.passwordForm.reset();
  setModalStatus(els.passwordStatus, '');
  openModal(els.passwordModal);
  return new Promise((resolve) => {
    pendingPassword = resolve;
  });
}

function closePasswordModal(value) {
  if (!els.passwordModal.classList.contains('is-open')) return;
  els.passwordModal.classList.remove('is-open');
  els.passwordModal.setAttribute('aria-hidden', 'true');
  if (pendingPassword) pendingPassword(value);
  pendingPassword = null;
}

function openImageViewer(src, alt) {
  els.imageViewerImg.src = src;
  els.imageViewerImg.alt = alt || 'Imagen ampliada';
  els.imageViewer.classList.add('is-open');
  els.imageViewer.setAttribute('aria-hidden', 'false');
}

function closeImageViewer() {
  if (!els.imageViewer) return;
  els.imageViewer.classList.remove('is-open');
  els.imageViewer.setAttribute('aria-hidden', 'true');
  els.imageViewerImg.src = '';
}

function setFormValue(id, value) {
  document.getElementById(id).value = value;
}

function setStatus(message, isError) {
  if (!els.appStatus) return;
  if (statusTimer) clearTimeout(statusTimer);
  els.appStatus.textContent = message;
  els.appStatus.classList.toggle('is-error', Boolean(isError));
  if (!message) return;
  statusTimer = setTimeout(() => {
    els.appStatus.textContent = '';
    els.appStatus.classList.remove('is-error');
    statusTimer = null;
  }, isError ? 8000 : 3500);
}

function setModalStatus(element, message, isError) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-error', Boolean(isError));
}

function labelFor(value) {
  return {
    activo: 'Activo',
    devuelto: 'Devuelto',
    cancelado: 'Cancelado',
    en_caja: 'En caja',
    no_en_caja: 'No en caja',
    en_vitrina: 'En vitrina',
    prestada: 'Prestada',
    en_uso: 'En vitrina',
    en_mantenimiento: 'En restauración',
    no_localizada: 'No localizada',
    sin_confirmar: 'Sin confirmar',
    bueno: 'Bueno',
    regular: 'Regular',
    roto: 'Roto',
    requiere_mantenimiento: 'Necesita restauración',
    sin_revisar: 'Sin revisar',
    ingreso: 'Ingreso a resguardo',
    salida: 'Salida para montaje',
    uso: 'Montaje en vitrina',
    prestamo: 'Préstamo',
    devolucion: 'Devolución',
    traslado: 'Traslado',
    mantenimiento: 'Restauración',
    cambio_estado: 'Cambio de estado',
    ajuste: 'Ajuste',
    seleccionada: 'Seleccionada',
    sacada: 'Sacada',
    montada: 'Montada',
    finalizada: 'Finalizada',
    cancelada: 'Cancelada',
    no_seleccionada: 'No seleccionada',
    admin: 'Admin',
    operador: 'Operador',
    consulta: 'Consulta'
  }[value] || value;
}

function populatePassageFilter(passages) {
  const select = document.getElementById('passage-filter');
  const current = select.value;
  select.innerHTML = '<option value="">Todos</option>';

  passages
    .filter((passage) => {
      const testament = document.getElementById('testament-filter').value;
      return !testament || passage.testament === testament;
    })
    .forEach((passage) => {
      const option = document.createElement('option');
      option.value = `${passage.testament}:${passage.number}`;
      option.textContent = `${passage.testament} P${passage.number} · ${passage.name} (${passage.pieces})`;
      select.appendChild(option);
    });

  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function populateMountingPassageFilter(passages) {
  const select = els.mountingPassageFilter;
  const current = select.value;
  select.innerHTML = '<option value="">Todos</option>';
  passages.forEach((passage) => {
    const option = document.createElement('option');
    option.value = passage.id;
    option.textContent = `${passage.testament} P${passage.number} · ${passage.name}`;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function populateLoanPassageFilters(passages) {
  populateLoanPassageSelect(els.loanOriginFilter, passages);
  populateLoanPassageSelect(els.loanDestinationFilter, passages);
}

function populateLoanPassageSelect(select, passages) {
  const current = select.value;
  select.innerHTML = '<option value="">Todos</option>';
  passages.forEach((passage) => {
    const option = document.createElement('option');
    option.value = passage.id;
    option.textContent = `${passage.testament} P${passage.number} · ${passage.name}`;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function populateExhibitionPickTargetSelect(piece) {
  const select = document.getElementById('exhibition-pick-target-passage');
  select.innerHTML = '<option value="">Selecciona pasaje destino</option>';
  state.passages
    .filter((passage) => !piece.active_loan_id || passage.id === piece.active_loan_passage_id)
    .forEach((passage) => {
    const option = document.createElement('option');
    option.value = passage.id;
    option.textContent = `${passage.testament} P${passage.number} · ${passage.name}`;
    select.appendChild(option);
  });
  select.value = piece.active_loan_passage_id || piece.passage_id;
}

function updateExhibitionBorrowFields() {
  const piece = findPiece(document.getElementById('exhibition-pick-piece-id').value);
  const targetId = Number(document.getElementById('exhibition-pick-target-passage').value);
  const borrowed = Boolean(piece && targetId && targetId !== piece.passage_id);
  const needsLoan = borrowed && !piece.active_loan_id;
  const fields = document.getElementById('exhibition-pick-borrow-fields');
  const returnDate = document.getElementById('exhibition-pick-return-date');
  fields.hidden = !needsLoan;
  returnDate.required = needsLoan;
  returnDate.min = localDateValue(new Date());
  if (!needsLoan) returnDate.value = '';
}

function localDateValue(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function populateShowcaseFilter(showcases) {
  const select = document.getElementById('showcase-filter');
  const current = select.value;
  select.innerHTML = '<option value="">Todas</option>';
  showcases.forEach((showcase) => {
    const option = document.createElement('option');
    option.value = showcase.id;
    option.textContent = `${showcase.code} · ${showcase.name}`;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
