import apiClient from './apiClient';

export async function login({ identifier, password, rememberMe }) {
  const { data } = await apiClient.post('/auth/login', { identifier, password, rememberMe });
  return data.data;
}

export async function refresh() {
  const { data } = await apiClient.post('/auth/refresh');
  return data.data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function logoutAll() {
  await apiClient.post('/auth/logout-all');
}

export async function forgotPassword(email) {
  const { data } = await apiClient.post('/auth/forgot-password', { email });
  return data.message;
}

export async function resetPassword({ token, newPassword }) {
  const { data } = await apiClient.post('/auth/reset-password', { token, newPassword });
  return data.message;
}

export async function getMe() {
  const { data } = await apiClient.get('/auth/me');
  return data.data;
}

export async function getSessions() {
  const { data } = await apiClient.get('/auth/sessions');
  return data.data;
}

export async function revokeSession(id) {
  await apiClient.delete(`/auth/sessions/${id}`);
}

export async function updateProfile(payload) {
  const { data } = await apiClient.put('/auth/profile', payload);
  return data.data;
}

export async function updateLanguage(preferredLanguage) {
  const { data } = await apiClient.patch('/auth/language', { preferredLanguage });
  return data.data;
}

export async function uploadProfileAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const { data } = await apiClient.post('/auth/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
  return data.message;
}
