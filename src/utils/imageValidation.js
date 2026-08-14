// Shared by every avatar/logo upload flow (Profile.jsx, CompanySettings.jsx)
// so the 2MB limit and allowed formats live in exactly one place, matching
// the backend's own createUploader() defaults in backend/middlewares/upload.js.
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Returns a translated error message if the file fails validation, or null
// if it's fine to upload. Frontend check only — the backend enforces the
// same rules independently and is never trusted to be bypassed safely.
export function validateImageFile(file, t) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return t('common:imageUpload.unsupportedFormat');
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return t('common:imageUpload.tooLarge');
  }
  return null;
}
