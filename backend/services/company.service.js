import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { ApiError } from '../utils/apiError.js';
import * as companyRepository from '../repositories/company.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { resolveUploadedFileUrl, deleteUploadedFile } from '../middlewares/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

export async function getProfile(tenantId) {
  return companyRepository.get(tenantId);
}

// A field the current form doesn't render at all (e.g. after the Settings
// simplification pass) is `undefined` in `data`, not empty — that must keep
// whatever value is already in the database rather than falling through to
// a hard default, or every save from a simplified form would silently wipe
// columns the UI no longer exposes (VRN, timezone, etc.) back to null/TZS.
// A field the form DOES render (present but empty) still clears to the
// fallback, same as before.
function preserveIfOmitted(newValue, existingValue, fallback = null) {
  if (newValue !== undefined) return newValue || fallback;
  return existingValue ?? fallback;
}

export async function upsertProfile(data, userId, tenantId) {
  const existing = await companyRepository.get(tenantId);

  const payload = {
    tenantId,
    companyName: data.companyName,
    businessType: preserveIfOmitted(data.businessType, existing?.business_type),
    tinNumber: preserveIfOmitted(data.tinNumber, existing?.tin_number),
    vrn: preserveIfOmitted(data.vrn, existing?.vrn),
    registrationNumber: preserveIfOmitted(data.registrationNumber, existing?.registration_number),
    address: preserveIfOmitted(data.address, existing?.address),
    region: preserveIfOmitted(data.region, existing?.region),
    district: preserveIfOmitted(data.district, existing?.district),
    street: preserveIfOmitted(data.street, existing?.street),
    phone: preserveIfOmitted(data.phone, existing?.phone),
    altPhone: preserveIfOmitted(data.altPhone, existing?.alt_phone),
    email: preserveIfOmitted(data.email, existing?.email),
    website: preserveIfOmitted(data.website, existing?.website),
    currency: preserveIfOmitted(data.currency, existing?.currency, 'TZS'),
    timezone: preserveIfOmitted(data.timezone, existing?.timezone, 'Africa/Dar_es_Salaam'),
    receiptFooter: preserveIfOmitted(data.receiptFooter, existing?.receipt_footer),
    description: preserveIfOmitted(data.description, existing?.description),
    status: preserveIfOmitted(data.status, existing?.status, 'active'),
    userId,
  };

  if (!existing) {
    return companyRepository.insert({ ...payload, logoPath: null });
  }

  return companyRepository.update(existing.id, tenantId, payload);
}

export async function updateLogo(file, userId, tenantId) {
  const existing = await companyRepository.get(tenantId);
  if (!existing) {
    throw new ApiError(400, 'Create the company profile before uploading a logo');
  }

  const logoPath = resolveUploadedFileUrl(file, 'logo');
  const updated = await companyRepository.updateLogoPath(existing.id, tenantId, logoPath);

  if (existing.logo_path) {
    if (existing.logo_path.startsWith('/uploads/')) {
      const oldFilePath = path.join(UPLOADS_ROOT, existing.logo_path.replace('/uploads/', ''));
      fs.unlink(oldFilePath).catch(() => {
        // Old file already gone or inaccessible — not fatal.
      });
    } else {
      deleteUploadedFile(existing.logo_path).catch(() => {
        // Cloudinary cleanup failures are already logged inside deleteUploadedFile — not fatal.
      });
    }
  }

  await activityLogRepository.create({
    tenantId,
    userId,
    branchId: null,
    description: 'Company logo updated',
    referenceType: 'company_settings',
    referenceId: existing.id,
  });

  return updated;
}
