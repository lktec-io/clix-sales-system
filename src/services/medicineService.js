import apiClient from './apiClient';

export async function listActiveMedicines() {
  const { data } = await apiClient.get('/medicines/active');
  return data.data;
}

export async function listMedicines(params) {
  const { data } = await apiClient.get('/medicines', { params });
  return data.data;
}

export async function getMedicine(id) {
  const { data } = await apiClient.get(`/medicines/${id}`);
  return data.data;
}

export async function createMedicine(payload) {
  const { data } = await apiClient.post('/medicines', payload);
  return data.data;
}

export async function updateMedicine(id, payload) {
  const { data } = await apiClient.put(`/medicines/${id}`, payload);
  return data.data;
}

export async function deleteMedicine(id) {
  await apiClient.delete(`/medicines/${id}`);
}

export async function getDashboardSummary() {
  const { data } = await apiClient.get('/medicines/dashboard-summary');
  return data.data;
}

export async function listExpiring(params) {
  const { data } = await apiClient.get('/medicines/expiring', { params });
  return data.data;
}

// Powers the Pharmacy POS's search-and-add grid — mirrors
// productService.js#listSellableProducts exactly.
export async function listSellableMedicines(params) {
  const { data } = await apiClient.get('/medicines/sellable', { params });
  return data.data;
}

// Exact-match barcode lookup, for a typed/scanned code — resolves to null,
// not an error, when nothing matches.
export async function lookupSellableMedicineByBarcode(params) {
  const { data } = await apiClient.get('/medicines/lookup', { params });
  return data.data;
}
