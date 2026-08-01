import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/routes';
import * as authService from '../../services/authService';

function ForgotPassword() {
  const { t } = useTranslation('auth');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '' } });

  const onSubmit = async ({ email }) => {
    setFormError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setFormError(err.response?.data?.message || t('forgotPassword.genericError'));
    }
  };

  if (sent) {
    return (
      <div>
        <h1 className="text-lg font-semibold">{t('forgotPassword.checkEmailTitle')}</h1>
        <p className="text-secondary text-sm mt-1">
          {t('forgotPassword.checkEmailMessage')}
        </p>
        <Link to={ROUTES.LOGIN} className="btn btn-secondary btn-block mt-4">
          {t('forgotPassword.backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold">{t('forgotPassword.title')}</h1>
      <p className="text-secondary text-sm mt-1 mb-4">
        {t('forgotPassword.subtitle')}
      </p>

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="email">
            {t('forgotPassword.emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`form-control ${errors.email ? 'form-control-error' : ''}`}
            {...register('email', {
              required: t('forgotPassword.emailRequired'),
              pattern: { value: /^\S+@\S+\.\S+$/, message: t('forgotPassword.emailInvalid') },
            })}
          />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </div>

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          {t('forgotPassword.sendResetLink')}
        </button>

        <Link to={ROUTES.LOGIN} className="btn btn-ghost btn-block mt-2">
          {t('forgotPassword.backToSignIn')}
        </Link>
      </form>
    </div>
  );
}

export default ForgotPassword;
