import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';

function Login() {
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
      setFormError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Welcome back</h1>
      <p className="text-secondary text-sm mt-1 mb-4">
        Sign in to continue to the Clix Sales System.
      </p>

      {resetSuccess && !formError && (
        <div className="alert alert-success mb-4" role="status">
          Your password was reset successfully. Please sign in.
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
            Email or Username
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            className={`form-control ${errors.identifier ? 'form-control-error' : ''}`}
            {...register('identifier', { required: 'Email or username is required' })}
          />
          {errors.identifier && <span className="form-error">{errors.identifier.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="password">
            Password
          </label>
          <div className="flex items-center gap-2">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`form-control ${errors.password ? 'form-control-error' : ''}`}
              {...register('password', { required: 'Password is required' })}
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </div>

        <div className="flex items-center justify-between mb-4">
          <label className="form-checkbox">
            <input type="checkbox" {...register('rememberMe')} />
            Remember me
          </label>
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          Sign In
        </button>
      </form>
    </div>
  );
}

export default Login;
