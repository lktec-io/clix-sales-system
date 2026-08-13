import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FiEye, FiEyeOff, FiCheck, FiShoppingBag, FiGrid, FiPackage,
  FiCpu, FiDroplet, FiCoffee, FiDollarSign,
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import * as tenantService from '../../services/tenantService';
import { ROUTES } from '../../constants/routes';
import '../../styles/pages/Register.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// Purely presentational — business_templates carries no icon column (only
// modules do), so this is a small, gracefully-degrading enhancement, not a
// gate: any template slug not listed here still renders fine via the
// FiGrid fallback. Only the platform's final six templates are listed —
// General Business/Wholesale/Hardware/Clothing/School/SACCOS were archived
// (034_finalize_template_scope_and_electronics_repairs.sql) and will never
// be returned by GET /tenants/templates, but the fallback means this map
// never needs to be perfectly in sync with the database to stay safe.
const TEMPLATE_ICONS = {
  'retail-store': FiShoppingBag,
  'electronics-shop': FiCpu,
  'cosmetics-shop': FiDroplet,
  pharmacy: FiPackage,
  restaurant: FiCoffee,
  microfinance: FiDollarSign,
};
function resolveTemplateIcon(slug) {
  return TEMPLATE_ICONS[slug] || FiGrid;
}

function Register() {
  const { t } = useTranslation('register');
  const { register: registerTenant } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedSlug = searchParams.get('template');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      companyName: '', ownerFirstName: '', ownerLastName: '', businessEmail: '', phone: '',
      password: '', confirmPassword: '', businessType: '', country: '', acceptTerms: false,
      businessTemplateId: '',
      website: '', // honeypot — see the hidden field below
    },
  });

  const password = watch('password');
  const selectedTemplateId = watch('businessTemplateId');

  useEffect(() => {
    let cancelled = false;

    tenantService.listTemplates()
      .then((data) => {
        if (cancelled) return;
        setTemplates(data);
        // Carries the landing page's business-selector pill choice
        // through (?template=electronics-shop) so a visitor who already
        // said "I run a repair shop" doesn't have to pick it again here.
        // Falls back to Retail Store (the platform default) when there's
        // no query param or it doesn't match a real, active template —
        // never trusted blindly, just used as a pre-selection hint.
        const requestedTemplate = requestedSlug && data.find((template) => template.slug === requestedSlug);
        const defaultTemplate = requestedTemplate || data.find((template) => template.slug === 'retail-store') || data[0];
        if (defaultTemplate) setValue('businessTemplateId', defaultTemplate.id);
      })
      .catch(() => {
        // The picker degrades to "not shown" — registration still works
        // via the backend's own Retail Store fallback when no id is sent.
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setValue, requestedSlug]);

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await registerTenant(values);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('genericError'));
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p className="text-secondary text-sm mt-1 mb-4">{t('subtitle')}</p>

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="companyName">
            {t('companyNameLabel')}
          </label>
          <input
            id="companyName"
            type="text"
            autoComplete="organization"
            className={`form-control ${errors.companyName ? 'form-control-error' : ''}`}
            {...register('companyName', { required: t('companyNameRequired') })}
          />
          {errors.companyName && <span className="form-error">{errors.companyName.message}</span>}
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label form-label-required" htmlFor="ownerFirstName">
              {t('ownerFirstNameLabel')}
            </label>
            <input
              id="ownerFirstName"
              type="text"
              autoComplete="given-name"
              className={`form-control ${errors.ownerFirstName ? 'form-control-error' : ''}`}
              {...register('ownerFirstName', { required: t('ownerFirstNameRequired') })}
            />
            {errors.ownerFirstName && <span className="form-error">{errors.ownerFirstName.message}</span>}
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label form-label-required" htmlFor="ownerLastName">
              {t('ownerLastNameLabel')}
            </label>
            <input
              id="ownerLastName"
              type="text"
              autoComplete="family-name"
              className={`form-control ${errors.ownerLastName ? 'form-control-error' : ''}`}
              {...register('ownerLastName', { required: t('ownerLastNameRequired') })}
            />
            {errors.ownerLastName && <span className="form-error">{errors.ownerLastName.message}</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="businessEmail">
            {t('businessEmailLabel')}
          </label>
          <input
            id="businessEmail"
            type="email"
            autoComplete="email"
            className={`form-control ${errors.businessEmail ? 'form-control-error' : ''}`}
            {...register('businessEmail', {
              required: t('businessEmailRequired'),
              pattern: { value: /^\S+@\S+\.\S+$/, message: t('businessEmailInvalid') },
            })}
          />
          {errors.businessEmail && <span className="form-error">{errors.businessEmail.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="phone">
            {t('phoneLabel')}
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            className={`form-control ${errors.phone ? 'form-control-error' : ''}`}
            {...register('phone', { required: t('phoneRequired') })}
          />
          {errors.phone && <span className="form-error">{errors.phone.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="password">
            {t('passwordLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`form-control ${errors.password ? 'form-control-error' : ''}`}
              {...register('password', {
                required: t('passwordRequired'),
                pattern: { value: PASSWORD_REGEX, message: t('passwordPolicy') },
              })}
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password ? (
            <span className="form-error">{errors.password.message}</span>
          ) : (
            <span className="form-help">{t('passwordPolicy')}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="confirmPassword">
            {t('confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className={`form-control ${errors.confirmPassword ? 'form-control-error' : ''}`}
            {...register('confirmPassword', {
              required: t('confirmPasswordRequired'),
              validate: (value) => value === password || t('passwordMismatch'),
            })}
          />
          {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="businessType">
              {t('businessTypeLabel')} <span className="text-secondary text-sm">({t('businessTypeOptional')})</span>
            </label>
            <input id="businessType" type="text" className="form-control" {...register('businessType')} />
          </div>

          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="country">
              {t('countryLabel')} <span className="text-secondary text-sm">({t('countryOptional')})</span>
            </label>
            <input id="country" type="text" className="form-control" {...register('country')} />
          </div>
        </div>

        {!templatesLoading && templates.length > 0 && (
          <div className="form-group">
            <label className="form-label">{t('businessTemplateLabel')}</label>
            <span className="form-help" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>{t('businessTemplateHint')}</span>
            <input type="hidden" {...register('businessTemplateId')} />
            <div className="template-picker-grid">
              {templates.map((template) => {
                const Icon = resolveTemplateIcon(template.slug);
                const isSelected = String(selectedTemplateId) === String(template.id);
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`template-picker-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setValue('businessTemplateId', template.id)}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <span className="template-picker-check"><FiCheck aria-hidden="true" /></span>}
                    <span className="template-picker-icon" aria-hidden="true"><Icon /></span>
                    <span className="template-picker-name">{template.name}</span>
                    {template.description && <span className="template-picker-description">{template.description}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Honeypot — hidden from real users and assistive tech, never
            styled or labelled like a real field. A bot's generic form-filler
            that blanket-fills every input trips this; a human never sees it. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
            overflow: 'hidden', clip: 'rect(0,0,0,0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0,
          }}
        >
          <label htmlFor="website">Website</label>
          <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <div className="form-group mb-4">
          <label className="form-checkbox">
            <input
              type="checkbox"
              {...register('acceptTerms', { required: t('acceptTermsRequired') })}
            />
            <span>
              {t('acceptTermsPrefix')} <strong>{t('termsOfService')}</strong> {t('acceptTermsAnd')} <strong>{t('privacyPolicy')}</strong>
            </span>
          </label>
          {errors.acceptTerms && <span className="form-error">{errors.acceptTerms.message}</span>}
        </div>

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          {t('submitButton')}
        </button>

        <p className="text-secondary text-sm text-center mt-4">
          {t('alreadyHaveAccount')} <Link to={ROUTES.LOGIN}>{t('signIn')}</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
