import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

function Login() {
  const { t } = useTranslation('auth');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const resetSuccess = Boolean(location.state?.resetSuccess);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { identifier: '', password: '', rememberMe: false } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      const redirectTo = location.state?.from?.pathname || ROUTES.DASHBOARD;
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || t('login.genericError'));
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">{t('login.welcomeBack')}</h1>
      <p className="text-secondary text-sm mt-1 mb-4">
        {t('login.signInSubtitle')}
      </p>

      {resetSuccess && !formError && (
        <div className="alert alert-success mb-4" role="status">
          {t('login.resetSuccess')}
        </div>
      )}

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="identifier">
            {t('login.identifierLabel')}
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            className={`form-control ${errors.identifier ? 'form-control-error' : ''}`}
            {...register('identifier', { required: t('login.identifierRequired') })}
          />
          {errors.identifier && <span className="form-error">{errors.identifier.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="password">
            {t('login.passwordLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`form-control ${errors.password ? 'form-control-error' : ''}`}
              {...register('password', { required: t('login.passwordRequired') })}
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </div>

        <div className="flex items-center justify-between mb-4">
          <label className="form-checkbox">
            <input type="checkbox" {...register('rememberMe')} />
            {t('login.rememberMe')}
          </label>
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm">
            {t('login.forgotPassword')}
          </Link>
        </div>

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          {t('login.signIn')}
        </button>
      </form>
    </div>
  );
}

export default Login;
