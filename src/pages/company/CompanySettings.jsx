import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FiUpload } from 'react-icons/fi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useCompany } from '../../hooks/useCompany';
import SettingsTabs from '../../components/common/SettingsTabs';
import PageSkeleton from '../../components/common/PageSkeleton';
import * as companyService from '../../services/companyService';
import { validateImageFile } from '../../utils/imageValidation';
import '../../styles/pages/CompanySettings.css';
import '../../styles/pages/Notifications.css';

const EMPTY_FORM = {
  companyName: '',
  address: '',
  region: '',
  district: '',
  street: '',
  phone: '',
  email: '',
  receiptFooter: '',
};

function CompanySettings() {
  const { t } = useTranslation(['settings', 'common']);
  const canManage = usePermission('company.manage');
  const toast = useToast();
  const { updateCompany: updateCompanyBrand } = useCompany();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [logoPath, setLogoPath] = useState(null);
  const [formError, setFormError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY_FORM });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profile = await companyService.getCompany();
        if (cancelled) return;
        if (profile) {
          reset({
            companyName: profile.company_name || '',
            address: profile.address || '',
            region: profile.region || '',
            district: profile.district || '',
            street: profile.street || '',
            phone: profile.phone || '',
            email: profile.email || '',
            receiptFooter: profile.receipt_footer || '',
          });
          setLogoPath(profile.logo_path || null);
        }
      } catch {
        if (!cancelled) setFormError(t('settings:company.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is only used inside the catch's error message; including it would re-run this whole data fetch on every language switch
  }, [reset]);

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const profile = await companyService.updateCompany(values);
      updateCompanyBrand(profile);
      toast.success(t('settings:company.saveSuccess'));
    } catch (err) {
      setFormError(err.response?.data?.message || t('settings:company.saveError'));
    }
  };

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFormError('');
    const validationError = validateImageFile(file, t);
    if (validationError) {
      setFormError(validationError);
      event.target.value = '';
      return;
    }

    setUploadingLogo(true);
    try {
      const profile = await companyService.uploadLogo(file);
      setLogoPath(profile.logo_path);
      // Pushes the new logo into every branding consumer (Login, Sidebar,
      // Navbar, Reports) immediately — they all read from this same
      // CompanyContext, which otherwise only fetches once at app mount.
      updateCompanyBrand(profile);
      toast.success(t('settings:company.logoUploadSuccess'));
    } catch (err) {
      setFormError(err.response?.data?.message || t('settings:company.logoUploadError'));
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings:company.pageTitle')}</h1>
          <p className="page-subtitle">{t('settings:company.pageSubtitle')}</p>
        </div>
      </div>

      <SettingsTabs />

      {!canManage && (
        <div className="alert alert-info mb-4" role="status">
          {t('settings:company.readOnlyNotice')}
        </div>
      )}

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <div className="card mb-5">
        <div className="card-body flex items-center gap-4">
          <div className="company-logo-preview">
            {logoPath ? <img src={logoPath} alt={t('settings:company.logoAlt')} /> : <span className="company-logo-placeholder">{t('settings:company.noLogo')}</span>}
          </div>
          {canManage && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="visually-hidden"
                onChange={handleLogoChange}
              />
              <button
                type="button"
                className={`btn btn-secondary ${uploadingLogo ? 'btn-loading' : ''}`}
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUpload aria-hidden="true" /> {t('settings:company.uploadLogo')}
              </button>
              <p className="form-help mt-2">{t('settings:company.logoHint')}</p>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('settings:company.businessIdentity')}</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="companyName">{t('settings:company.companyName')}</label>
              <input
                id="companyName"
                className={`form-control ${errors.companyName ? 'form-control-error' : ''}`}
                disabled={!canManage}
                {...register('companyName', { required: t('settings:company.companyNameRequired') })}
              />
              {errors.companyName && <span className="form-error">{errors.companyName.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="receiptFooter">{t('settings:company.receiptFooter')}</label>
              <textarea id="receiptFooter" className="form-control" disabled={!canManage} placeholder={t('settings:company.receiptFooterPlaceholder')} {...register('receiptFooter')} />
              <p className="form-help mt-1">{t('settings:company.receiptFooterHint')}</p>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('settings:company.addressTitle')}</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="address">{t('settings:company.physicalAddress')}</label>
              <input id="address" className="form-control" disabled={!canManage} {...register('address')} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="region">{t('settings:company.region')}</label>
                <input id="region" className="form-control" disabled={!canManage} {...register('region')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="district">{t('settings:company.district')}</label>
                <input id="district" className="form-control" disabled={!canManage} {...register('district')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="street">{t('settings:company.street')}</label>
              <input id="street" className="form-control" disabled={!canManage} {...register('street')} />
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header">
            <span className="card-title">{t('settings:company.contactTitle')}</span>
          </div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="phone">{t('common:labels.phone')}</label>
                <input id="phone" className="form-control" disabled={!canManage} {...register('phone')} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">{t('common:labels.email')}</label>
                <input
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? 'form-control-error' : ''}`}
                  disabled={!canManage}
                  {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: t('settings:company.invalidEmail') } })}
                />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="form-actions">
            <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
              {t('settings:company.saveChanges')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default CompanySettings;
