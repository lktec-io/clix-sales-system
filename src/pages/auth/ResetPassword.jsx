import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import * as authService from '../../services/authService';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function ResetPassword() {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { newPassword: '', confirmPassword: '' } });

  const newPassword = watch('newPassword');

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await authService.resetPassword({ token, newPassword: values.newPassword });
      navigate(ROUTES.LOGIN, { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setFormError(err.response?.data?.message || t('resetPassword.genericError'));
    }
  };

  if (!token) {
    return (
      <div>
        <h1 className="text-lg font-semibold">{t('resetPassword.invalidLinkTitle')}</h1>
        <p className="text-secondary text-sm mt-1">
          {t('resetPassword.invalidLinkMessage')}
        </p>
        <Link to={ROUTES.FORGOT_PASSWORD} className="btn btn-primary btn-block mt-4">
          {t('resetPassword.requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">{t('resetPassword.title')}</h1>
      <p className="text-secondary text-sm mt-1 mb-4">{t('resetPassword.subtitle')}</p>

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="newPassword">
            {t('resetPassword.newPasswordLabel')}
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            className={`form-control ${errors.newPassword ? 'form-control-error' : ''}`}
            {...register('newPassword', {
              required: t('resetPassword.newPasswordRequired'),
              pattern: { value: PASSWORD_REGEX, message: t('resetPassword.passwordPolicy') },
            })}
          />
          {errors.newPassword ? (
            <span className="form-error">{errors.newPassword.message}</span>
          ) : (
            <span className="form-help">{t('resetPassword.passwordPolicy')}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="confirmPassword">
            {t('resetPassword.confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={`form-control ${errors.confirmPassword ? 'form-control-error' : ''}`}
            {...register('confirmPassword', {
              required: t('resetPassword.confirmPasswordRequired'),
              validate: (value) => value === newPassword || t('resetPassword.passwordMismatch'),
            })}
          />
          {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
        </div>

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          {t('resetPassword.resetButton')}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;
