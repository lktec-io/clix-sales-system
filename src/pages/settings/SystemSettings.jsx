import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import SettingsTabs from '../../components/common/SettingsTabs';
import Skeleton from '../../components/common/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as settingsService from '../../services/settingsService';
import '../../styles/pages/Notifications.css';

function SystemSettings() {
  const canManage = usePermission('settings.manage');
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { taxEnabled: false, taxRate: 0, notificationEmailEnabled: true, receiptQrVerificationEnabled: false } });

  useEffect(() => {
    settingsService
      .getSystemSettings()
      .then(reset)
      .catch(() => setFormError('Failed to load system settings.'))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const updated = await settingsService.updateSystemSettings({
        taxEnabled: values.taxEnabled,
        taxRate: Number(values.taxRate) || 0,
        notificationEmailEnabled: values.notificationEmailEnabled,
        receiptQrVerificationEnabled: values.receiptQrVerificationEnabled,
      });
      reset(updated);
      toast.success('Settings saved successfully.');
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save settings.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Tax rate, notification email, and receipt preferences</p>
        </div>
      </div>

      <SettingsTabs />

      {!canManage && (
        <div className="alert alert-info mb-4" role="status">
          Only Super Administrators can edit system settings. You are viewing this in read-only mode.
        </div>
      )}
      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      {loading ? (
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Skeleton height="1rem" width="40%" />
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="1rem" width="35%" />
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="card mb-5">
            <div className="card-header"><span className="card-title">Tax</span></div>
            <div className="card-body">
              <label className="form-switch mb-3">
                <input type="checkbox" disabled={!canManage} {...register('taxEnabled')} />
                Enable tax on sales
              </label>
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label" htmlFor="taxRate">Tax Rate (%)</label>
                <input id="taxRate" type="number" min="0" max="100" step="0.01" className="form-control" disabled={!canManage} {...register('taxRate')} />
              </div>
            </div>
          </div>

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">Email</span></div>
            <div className="card-body">
              <label className="form-switch">
                <input type="checkbox" disabled={!canManage} {...register('notificationEmailEnabled')} />
                Send email notifications (in addition to in-app notifications)
              </label>
            </div>
          </div>

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">Receipt</span></div>
            <div className="card-body">
              <label className="form-switch">
                <input type="checkbox" disabled={!canManage} {...register('receiptQrVerificationEnabled')} />
                Print a verification QR code on receipts
              </label>
            </div>
          </div>

          {canManage && (
            <div className="form-actions">
              <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
                Save Changes
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default SystemSettings;
