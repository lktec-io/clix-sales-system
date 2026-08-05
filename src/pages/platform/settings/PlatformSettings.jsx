import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as platformSettingsService from '../../../services/platformSettingsService';

function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      companyBrandingName: '', supportEmail: '', supportPhone: '',
      trialDurationDefaultDays: 14, maintenanceMode: false, platformAnnouncement: '',
    },
  });

  useEffect(() => {
    platformSettingsService.getSettings().then((settings) => {
      reset(settings);
      setLoading(false);
    });
  }, [reset]);

  const onSubmit = async (values) => {
    setError('');
    setSaved(false);
    try {
      const updated = await platformSettingsService.updateSettings(values);
      reset(updated);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings.');
    }
  };

  if (loading) return <p className="text-sm text-secondary">Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Settings</h1>
          <p className="page-subtitle">Branding, support contacts, and defaults for the whole platform.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4" role="alert">{error}</div>}
      {saved && <div className="alert alert-success mb-4" role="status">Settings saved.</div>}

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="companyBrandingName">Company Branding Name</label>
              <input id="companyBrandingName" type="text" className="form-control" {...register('companyBrandingName')} />
            </div>

            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="supportEmail">Support Email</label>
                <input
                  id="supportEmail"
                  type="email"
                  className={`form-control ${errors.supportEmail ? 'form-control-error' : ''}`}
                  {...register('supportEmail')}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="supportPhone">Support Phone</label>
                <input id="supportPhone" type="tel" className="form-control" {...register('supportPhone')} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="trialDurationDefaultDays">Default Trial Duration (days)</label>
              <input
                id="trialDurationDefaultDays"
                type="number"
                min="1"
                max="365"
                className="form-control"
                style={{ maxWidth: 160 }}
                {...register('trialDurationDefaultDays', { min: 1, max: 365 })}
              />
              <span className="form-help">Used when resetting a tenant's trial without specifying a custom length. New self-registrations are unaffected by this setting.</span>
            </div>

            <div className="form-group">
              <label className="form-checkbox">
                <input type="checkbox" {...register('maintenanceMode')} />
                Maintenance mode
              </label>
              <span className="form-help">Stored for visibility only in this release — not yet enforced against tenant login or registration.</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="platformAnnouncement">Platform Announcement</label>
              <textarea id="platformAnnouncement" className="form-control" rows={3} {...register('platformAnnouncement')} />
            </div>

            <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              Save Settings
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PlatformSettings;
