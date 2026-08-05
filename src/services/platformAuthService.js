import platformApiClient from './platformApiClient';

export async function login({ email, password }) {
  const { data } = await platformApiClient.post('/auth/login', { email, password });
  return data.data;
}

export async function refresh() {
  const { data } = await platformApiClient.post('/auth/refresh');
  return data.data;
}

export async function logout() {
  await platformApiClient.post('/auth/logout');
}

export async function getMe() {
  const { data } = await platformApiClient.get('/auth/me');
  return data.data;
}
