import * as systemSettingsRepository from '../repositories/systemSettings.repository.js';

// Company Information/Logo/Receipt Footer/Currency already live in
// company_settings (Phase 2). This key-value store covers what Phase 2
// didn't: Tax and notification Email preferences — real, persisted,
// admin-editable settings, not hardcoded constants.
const DEFAULTS = {
  tax_enabled: 'false',
  tax_rate: '0',
  notification_email_enabled: 'true',
  // Off by default — an existing install shouldn't have its printed
  // receipt layout change until an admin opts in.
  receipt_qr_verification_enabled: 'false',
};

export async function getSettings() {
  const rows = await systemSettingsRepository.findAll();
  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));

  return {
    taxEnabled: (map.get('tax_enabled') ?? DEFAULTS.tax_enabled) === 'true',
    taxRate: Number(map.get('tax_rate') ?? DEFAULTS.tax_rate),
    notificationEmailEnabled: (map.get('notification_email_enabled') ?? DEFAULTS.notification_email_enabled) === 'true',
    receiptQrVerificationEnabled: (map.get('receipt_qr_verification_enabled') ?? DEFAULTS.receipt_qr_verification_enabled) === 'true',
  };
}

export async function updateSettings(data, userId) {
  await systemSettingsRepository.upsert('tax_enabled', String(Boolean(data.taxEnabled)), 'boolean', userId);
  await systemSettingsRepository.upsert('tax_rate', String(Number(data.taxRate) || 0), 'number', userId);
  await systemSettingsRepository.upsert(
    'notification_email_enabled',
    String(Boolean(data.notificationEmailEnabled)),
    'boolean',
    userId,
  );
  await systemSettingsRepository.upsert(
    'receipt_qr_verification_enabled',
    String(Boolean(data.receiptQrVerificationEnabled)),
    'boolean',
    userId,
  );
  return getSettings();
}
