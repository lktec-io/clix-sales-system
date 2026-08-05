// Isolated from utils/tokenStorage.js by construction — a separate
// module-scoped closure variable, never localStorage/sessionStorage/window.
// Two separate ES modules never share this kind of state, so a platform
// admin session and a tenant session can never collide in the same tab.
let platformAccessToken = null;

export function getPlatformAccessToken() {
  return platformAccessToken;
}

export function setPlatformAccessToken(token) {
  platformAccessToken = token;
}

export function clearPlatformAccessToken() {
  platformAccessToken = null;
}
