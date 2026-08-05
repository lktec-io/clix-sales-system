import * as platformSettingsRepository from '../repositories/platformSettings.repository.js';

const DEFAULTS = {
  company_branding_name: 'Clix Digital Works',
  support_email: '',
  support_phone: '',
  trial_duration_default_days: '14',
  // Stored/displayed only this phase — not enforced anywhere yet (real
  // enforcement would require touching auth.service.js's login(), which is
  // explicitly out of scope for this phase). See the Phase 3 plan/report.
  maintenance_mode: 'false',
  platform_announcement: '',
  // Phase 4 — how many days a subscription stays in 'grace_period' after
  // its end_date passes before subscriptionLifecycleJob.js expires it.
  grace_period_default_days: '7',
};

export async function getSettings() {
  const rows = await platformSettingsRepository.findAll();
  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]));

  return {
    companyBrandingName: map.get('company_branding_name') ?? DEFAULTS.company_branding_name,
    supportEmail: map.get('support_email') ?? DEFAULTS.support_email,
    supportPhone: map.get('support_phone') ?? DEFAULTS.support_phone,
    trialDurationDefaultDays: Number(map.get('trial_duration_default_days') ?? DEFAULTS.trial_duration_default_days),
    maintenanceMode: (map.get('maintenance_mode') ?? DEFAULTS.maintenance_mode) === 'true',
    platformAnnouncement: map.get('platform_announcement') ?? DEFAULTS.platform_announcement,
    gracePeriodDefaultDays: Number(map.get('grace_period_default_days') ?? DEFAULTS.grace_period_default_days),
  };
}

// Used internally by platformTenant.service.js's resetTrial() default —
// a narrow read, not routed through a controller.
export async function getTrialDurationDefaultDays() {
  const settings = await getSettings();
  return settings.trialDurationDefaultDays;
}

// Used internally by subscriptionLifecycle.service.js's
// sweepLifecycleTransitions() — same narrow-read pattern as
// getTrialDurationDefaultDays() above.
export async function getGracePeriodDefaultDays() {
  const settings = await getSettings();
  return settings.gracePeriodDefaultDays;
}

export async function updateSettings(data, platformAdminId) {
  await platformSettingsRepository.upsert('company_branding_name', String(data.companyBrandingName ?? DEFAULTS.company_branding_name), 'string', platformAdminId);
  await platformSettingsRepository.upsert('support_email', String(data.supportEmail || ''), 'string', platformAdminId);
  await platformSettingsRepository.upsert('support_phone', String(data.supportPhone || ''), 'string', platformAdminId);
  await platformSettingsRepository.upsert('trial_duration_default_days', String(Number(data.trialDurationDefaultDays) || 14), 'number', platformAdminId);
  await platformSettingsRepository.upsert('maintenance_mode', String(Boolean(data.maintenanceMode)), 'boolean', platformAdminId);
  await platformSettingsRepository.upsert('platform_announcement', String(data.platformAnnouncement || ''), 'string', platformAdminId);
  await platformSettingsRepository.upsert('grace_period_default_days', String(Number(data.gracePeriodDefaultDays) || 7), 'number', platformAdminId);
  return getSettings();
}
