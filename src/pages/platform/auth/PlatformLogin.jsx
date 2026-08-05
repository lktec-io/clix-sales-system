import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';
import { PLATFORM_ROUTES } from '../../../constants/routes';

function PlatformLogin() {
  const { login } = usePlatformAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login(values);
      navigate(PLATFORM_ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="text-lg font-semibold">Platform Sign In</h1>
      <p className="text-secondary text-sm mt-1 mb-4">For Clix Digital Works platform administrators only.</p>

      {formError && (
        <div className="alert alert-danger mb-4" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`form-control ${errors.email ? 'form-control-error' : ''}`}
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="password">Password</label>
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

        <button type="submit" className={`btn btn-primary btn-block ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
          Sign In
        </button>
      </form>
    </div>
  );
}

export default PlatformLogin;
