import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import SettingsTabs from '../../components/common/SettingsTabs';
import Skeleton from '../../components/common/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import * as settingsService from '../../services/settingsService';
import '../../styles/pages/Notifications.css';

function SystemSettings() {
  const { t } = useTranslation(['settings', 'common']);
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
      .catch(() => setFormError(t('settings:system.loadError')))
      .finally(() => setLoading(false));
  }, [reset, t]);

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
      toast.success(t('settings:system.saveSuccess'));
    } catch (err) {
      setFormError(err.response?.data?.message || t('settings:system.saveError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings:system.pageTitle')}</h1>
          <p className="page-subtitle">{t('settings:system.pageSubtitle')}</p>
        </div>
      </div>

      <SettingsTabs />

      {!canManage && (
        <div className="alert alert-info mb-4" role="status">
          {t('settings:system.readOnlyNotice')}
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
            <div className="card-header"><span className="card-title">{t('settings:system.taxTitle')}</span></div>
            <div className="card-body">
              <label className="form-switch mb-3">
                <input type="checkbox" disabled={!canManage} {...register('taxEnabled')} />
                {t('settings:system.taxEnabledLabel')}
              </label>
              <div className="form-group" style={{ maxWidth: 200 }}>
                <label className="form-label" htmlFor="taxRate">{t('settings:system.taxRateLabel')}</label>
                <input id="taxRate" type="number" min="0" max="100" step="0.01" className="form-control" disabled={!canManage} {...register('taxRate')} />
              </div>
            </div>
          </div>

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">{t('settings:system.emailTitle')}</span></div>
            <div className="card-body">
              <label className="form-switch">
                <input type="checkbox" disabled={!canManage} {...register('notificationEmailEnabled')} />
                {t('settings:system.emailNotificationsLabel')}
              </label>
            </div>
          </div>

          <div className="card mb-5">
            <div className="card-header"><span className="card-title">{t('settings:system.receiptTitle')}</span></div>
            <div className="card-body">
              <label className="form-switch">
                <input type="checkbox" disabled={!canManage} {...register('receiptQrVerificationEnabled')} />
                {t('settings:system.receiptQrLabel')}
              </label>
            </div>
          </div>

          {canManage && (
            <div className="form-actions">
              <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
                {t('common:actions.saveChanges')}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default SystemSettings;
