import platformApiClient from './platformApiClient';

function openPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function getSubscription(tenantId) {
  const { data } = await platformApiClient.get(`/subscriptions/${tenantId}`);
  return data.data;
}

export async function getHistory(tenantId, params) {
  const { data } = await platformApiClient.get(`/subscriptions/${tenantId}/history`, { params });
  return data.data;
}

export async function upgradePlan(tenantId, planId, billingCycle) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/upgrade`, { planId, billingCycle });
  return data.data;
}

export async function downgradePlan(tenantId, planId, billingCycle) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/downgrade`, { planId, billingCycle });
  return data.data;
}

export async function renewSubscription(tenantId) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/renew`);
  return data.data;
}

export async function cancelSubscription(tenantId, reason) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/cancel`, { reason });
  return data.data;
}

export async function resumeSubscription(tenantId) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/resume`);
  return data.data;
}

export async function scheduleChange(tenantId, planId, billingCycle, effectiveDate) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/schedule`, { planId, billingCycle, effectiveDate });
  return data.data;
}

export async function generateInvoice(tenantId) {
  const { data } = await platformApiClient.post(`/subscriptions/${tenantId}/invoices`);
  return data.data;
}

export async function listInvoices(params) {
  const { data } = await platformApiClient.get('/subscriptions/invoices', { params });
  return data.data;
}

export async function getInvoice(invoiceId) {
  const { data } = await platformApiClient.get(`/subscriptions/invoices/${invoiceId}`);
  return data.data;
}

export async function viewInvoicePdf(invoiceId) {
  const { data } = await platformApiClient.get(`/subscriptions/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  openPdfBlob(data);
}

export async function markInvoicePaid(invoiceId) {
  const { data } = await platformApiClient.post(`/subscriptions/invoices/${invoiceId}/mark-paid`);
  return data.data;
}
