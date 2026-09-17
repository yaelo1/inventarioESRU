const API_BASE = window.INVENTORY_API_BASE;

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? options.headers || {}
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'same-origin' });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('inventory:unauthorized'));
  }
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || (body.errors || []).join(', ') || message;
    } catch (error) {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export function getCurrentUser() {
  return request('/auth/me');
}

export function changeOwnPassword(currentPassword, password, passwordConfirmation) {
  return request('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation
    })
  });
}

export function getUsers() {
  return request('/users');
}

export function createUser(user) {
  return request('/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function deactivateUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}

export function reactivateUser(id) {
  return request(`/users/${id}/reactivate`, { method: 'PATCH' });
}

export function deleteUserPermanently(id) {
  return request(`/users/${id}/permanent`, { method: 'DELETE' });
}

export function updateUserPassword(id, password) {
  return request(`/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ password })
  });
}

export function getPieces(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.testament) params.set('testament', filters.testament);
  if (filters.passageNumber) params.set('passageNumber', filters.passageNumber);
  if (filters.showcase) params.set('showcase', filters.showcase);
  if (filters.presenceStatus) params.set('presenceStatus', filters.presenceStatus);
  if (filters.conditionStatus) params.set('conditionStatus', filters.conditionStatus);
  if (filters.maintenanceRequired) params.set('maintenanceRequired', 'true');
  return request(`/pieces?${params.toString()}`);
}

export function getPassages() {
  return request('/passages');
}

export function getShowcases() {
  return request('/showcases');
}

export function createShowcase(showcase) {
  return request('/showcases', {
    method: 'POST',
    body: JSON.stringify(showcase)
  });
}

export function updateShowcase(id, showcase) {
  return request(`/showcases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(showcase)
  });
}

export function assignShowcasePassages(id, passageIds) {
  return request(`/showcases/${id}/passages`, {
    method: 'PUT',
    body: JSON.stringify({ passage_ids: passageIds })
  });
}

export function createPassage(passage) {
  return request('/passages', {
    method: 'POST',
    body: JSON.stringify(passage)
  });
}

export function uploadPassageImage(id, file) {
  const body = new FormData();
  body.append('image', file);
  return request(`/passages/${id}/image`, {
    method: 'POST',
    body
  });
}

export function createPiece(piece) {
  return request('/pieces', {
    method: 'POST',
    body: JSON.stringify(piece)
  });
}

export function updatePiece(id, piece) {
  return request(`/pieces/${id}`, {
    method: 'PUT',
    body: JSON.stringify(piece)
  });
}

export function archivePiece(id) {
  return request(`/pieces/${id}`, { method: 'DELETE' });
}

export function registerPieceMovement(id, movement) {
  return request(`/pieces/${id}/movements`, {
    method: 'POST',
    body: JSON.stringify(movement)
  });
}

export function getPieceLoans(filters = {}) {
  const params = new URLSearchParams();
  if (typeof filters === 'string') {
    if (filters) params.set('status', filters);
  } else {
    if (filters.status) params.set('status', filters.status);
    if (filters.originPassageId) params.set('originPassageId', filters.originPassageId);
    if (filters.destinationPassageId) params.set('destinationPassageId', filters.destinationPassageId);
    if (filters.due) params.set('due', filters.due);
  }
  return request(`/pieces/loans?${params.toString()}`);
}

export function returnPieceLoan(id, data) {
  return request(`/pieces/loans/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function getExhibitionPicks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.targetPassageId) params.set('targetPassageId', filters.targetPassageId);
  if (filters.status) params.set('status', filters.status);
  if (filters.includeCompleted) params.set('includeCompleted', 'true');
  return request(`/exhibition-picks?${params.toString()}`);
}

export function createExhibitionPick(pieceId, data) {
  return request(`/exhibition-picks/${pieceId}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateExhibitionPickStatus(id, data) {
  return request(`/exhibition-picks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

export function uploadPieceImage(id, file) {
  const body = new FormData();
  body.append('image', file);
  return request(`/pieces/${id}/image`, {
    method: 'POST',
    body
  });
}

export function getPieceMovements(filters = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return request(`/pieces/movements/history?${params.toString()}`);
}

export function getCustodyAlerts() {
  const params = new URLSearchParams({ custodyAlert: 'true' });
  return request(`/pieces?${params.toString()}`);
}

export function getPieceStats() {
  return request('/pieces/stats/summary');
}
