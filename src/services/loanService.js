import apiClient from './apiClient';

export async function listLoans(params) {
  const { data } = await apiClient.get('/loans', { params });
  return data.data;
}

export async function getLoan(id) {
  const { data } = await apiClient.get(`/loans/${id}`);
  return data.data;
}

export async function applyForLoan(payload) {
  const { data } = await apiClient.post('/loans', payload);
  return data.data;
}

export async function markUnderReview(id) {
  const { data } = await apiClient.post(`/loans/${id}/review`);
  return data.data;
}

export async function approveLoan(id, payload) {
  const { data } = await apiClient.post(`/loans/${id}/approve`, payload);
  return data.data;
}

export async function rejectLoan(id, payload) {
  const { data } = await apiClient.post(`/loans/${id}/reject`, payload);
  return data.data;
}

export async function disburseLoan(id) {
  const { data } = await apiClient.post(`/loans/${id}/disburse`);
  return data.data;
}

export async function writeOffLoan(id) {
  const { data } = await apiClient.post(`/loans/${id}/write-off`);
  return data.data;
}

export async function getPortfolioKpis() {
  const { data } = await apiClient.get('/loans/kpis');
  return data.data;
}

export async function getRecentApplications(limit) {
  const { data } = await apiClient.get('/loans/recent', { params: limit ? { limit } : undefined });
  return data.data;
}

export async function listRepayments(params) {
  const { data } = await apiClient.get('/repayments', { params });
  return data.data;
}

export async function recordRepayment(payload) {
  const { data } = await apiClient.post('/repayments', payload);
  return data.data;
}
