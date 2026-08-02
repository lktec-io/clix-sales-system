import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiUpload, FiEye, FiEyeOff } from 'react-icons/fi';
import PageSkeleton from '../../components/common/PageSkeleton';
import { useToast } from '../../hooks/useToast';
import * as userService from '../../services/userService';
import * as roleService from '../../services/roleService';
import * as branchService from '../../services/branchService';
import '../../styles/pages/CompanySettings.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// A single name field is friendlier for a cashier/store-keeper-facing admin
// form; the users table still stores first_name/last_name separately, so
// this splits on the first space right before submit and rejoins them back
// into one field when loading an existing user for edit.
function splitFullName(fullName) {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() };
}

// The backend's validateRequest middleware sends { message: 'Validation
// failed', errors: [{ field, message }] } for a 400 — the generic top-level
// message alone (what this used to show) told the user nothing. A 409
// conflict (duplicate username/email/phone) has no errors array and its
// specific message is already in the top-level `message`, so that path is
// unchanged.
function extractErrorMessage(err, fallback) {
  const responseData = err.response?.data;
  const fieldErrors = responseData?.errors;
  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    return fieldErrors.map((fieldError) => fieldError.message).join(' ');
  }
  return responseData?.message || fallback;
}

function UserForm() {
  const { t } = useTranslation(['settings', 'common']);
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const avatarInputRef = useRef(null);
  const passwordPolicyMessage = t('settings:users.form.passwordPolicy');

  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [avatarPath, setAvatarPath] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [formError, setFormError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      fullName: '', phone: '', email: '', username: '',
      password: '', confirmPassword: '', roleId: '', branchId: '', status: 'active',
    },
  });

  useEffect(() => {
    Promise.all([roleService.listRoles(), branchService.listActiveBranches()]).then(([roleRows, branchRows]) => {
      setRoles(roleRows);
      setBranches(branchRows);
    });
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    userService.getUser(id).then((user) => {
      if (cancelled) return;
      reset({
        fullName: `${user.first_name} ${user.last_name}`.trim(),
        phone: user.phone,
        email: user.email,
        username: user.username,
        password: '',
        confirmPassword: '',
        roleId: String(user.role_id),
        branchId: user.branch_id ? String(user.branch_id) : '',
        status: user.status,
      });
      setAvatarPath(user.avatar_path || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id, isEdit, reset]);

  const onSubmit = async (values) => {
    setFormError('');

    const { firstName, lastName } = splitFullName(values.fullName);
    const payload = {
      firstName,
      lastName,
      phone: values.phone,
      email: values.email,
      username: values.username,
      roleId: Number(values.roleId),
      branchId: values.branchId ? Number(values.branchId) : null,
    };

    try {
      if (isEdit) {
        await userService.updateUser(id, payload);
        toast.success(t('settings:users.form.updateSuccess'));
      } else {
        const created = await userService.createUser({ ...payload, password: values.password, status: values.status });
        toast.success(t('settings:users.form.createSuccess'));
        navigate(`/settings/users/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      setFormError(extractErrorMessage(err, t('settings:users.form.saveError')));
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const user = await userService.uploadUserAvatar(id, file);
      setAvatarPath(user.avatar_path);
      toast.success(t('settings:users.form.avatarUpdateSuccess'));
    } catch (err) {
      setFormError(err.response?.data?.message || t('settings:users.form.avatarUpdateError'));
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleResetPassword = async () => {
    setResetPasswordError('');
    if (!PASSWORD_REGEX.test(resetPasswordValue)) {
      setResetPasswordError(passwordPolicyMessage);
      return;
    }

    setResetPasswordSubmitting(true);
    try {
      await userService.resetUserPassword(id, resetPasswordValue);
      toast.success(t('settings:users.form.resetSuccess'));
      setResetPasswordValue('');
    } catch (err) {
      setResetPasswordError(err.response?.data?.message || t('settings:users.form.resetError'));
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? t('settings:users.form.editTitle') : t('settings:users.form.newTitle')}</h1>
          <p className="page-subtitle">{isEdit ? t('settings:users.form.editSubtitle') : t('settings:users.form.newSubtitle')}</p>
        </div>
      </div>

      {formError && <div className="alert alert-danger mb-4" role="alert">{formError}</div>}

      {isEdit && (
        <div className="card mb-5">
          <div className="card-body flex items-center gap-4">
            <div className="avatar-preview">
              {avatarPath ? <img src={avatarPath} alt={t('settings:users.form.avatarAlt')} loading="lazy" /> : <span className="company-logo-placeholder">{t('settings:users.form.noPhoto')}</span>}
            </div>
            <div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="visually-hidden"
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                className={`btn btn-secondary ${uploadingAvatar ? 'btn-loading' : ''}`}
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                <FiUpload aria-hidden="true" /> {t('settings:users.form.uploadPhoto')}
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('settings:users.form.personalInfo')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="fullName">{t('settings:users.form.fullName')}</label>
                <input id="fullName" className={`form-control ${errors.fullName ? 'form-control-error' : ''}`} {...register('fullName', { required: t('settings:users.form.fullNameRequired') })} />
                {errors.fullName && <span className="form-error">{errors.fullName.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="phone">{t('common:labels.phone')}</label>
                <input id="phone" className={`form-control ${errors.phone ? 'form-control-error' : ''}`} {...register('phone', { required: t('settings:users.form.phoneRequired') })} />
                {errors.phone && <span className="form-error">{errors.phone.message}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('settings:users.form.account')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="email">{t('common:labels.email')}</label>
                <input
                  id="email"
                  type="email"
                  className={`form-control ${errors.email ? 'form-control-error' : ''}`}
                  {...register('email', { required: t('settings:users.form.emailRequired'), pattern: { value: /^\S+@\S+\.\S+$/, message: t('settings:users.form.invalidEmail') } })}
                />
                {errors.email && <span className="form-error">{errors.email.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="username">{t('common:labels.username')}</label>
                <input id="username" className={`form-control ${errors.username ? 'form-control-error' : ''}`} {...register('username', { required: t('settings:users.form.usernameRequired') })} />
                {errors.username && <span className="form-error">{errors.username.message}</span>}
              </div>
            </div>

            {!isEdit && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="password">{t('common:labels.password')}</label>
                  <div className="form-password-field">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`form-control ${errors.password ? 'form-control-error' : ''}`}
                      {...register('password', { required: t('settings:users.form.passwordRequired'), pattern: { value: PASSWORD_REGEX, message: passwordPolicyMessage } })}
                    />
                    <button
                      type="button"
                      className="form-password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t('settings:users.form.hidePassword') : t('settings:users.form.showPassword')}
                    >
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {errors.password ? <span className="form-error">{errors.password.message}</span> : <span className="form-help">{passwordPolicyMessage}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="confirmPassword">{t('settings:users.form.confirmPassword')}</label>
                  <div className="form-password-field">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`form-control ${errors.confirmPassword ? 'form-control-error' : ''}`}
                      {...register('confirmPassword', {
                        required: t('settings:users.form.confirmPasswordRequired'),
                        validate: (value) => value === watch('password') || t('settings:users.form.passwordMismatch'),
                      })}
                    />
                    <button
                      type="button"
                      className="form-password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? t('settings:users.form.hidePassword') : t('settings:users.form.showPassword')}
                    >
                      {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('settings:users.form.roleAndBranch')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="roleId">{t('settings:users.columns.role')}</label>
                <select id="roleId" className={`form-control ${errors.roleId ? 'form-control-error' : ''}`} {...register('roleId', { required: t('settings:users.form.roleRequired') })}>
                  <option value="">{t('settings:users.form.selectRole')}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {errors.roleId && <span className="form-error">{errors.roleId.message}</span>}
                <span className="form-help">{t('settings:users.form.roleHelp')}</span>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="branchId">{t('common:labels.branch')}</label>
                <select id="branchId" className="form-control" {...register('branchId')}>
                  <option value="">{t('settings:users.form.noneUnassigned')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {!isEdit && (
              <div className="form-group">
                <label className="form-label" htmlFor="status">{t('common:labels.status')}</label>
                <select id="status" className="form-control" {...register('status')}>
                  <option value="active">{t('settings:users.statusLabels.active')}</option>
                  <option value="suspended">{t('settings:users.statusLabels.suspended')}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/settings/users')}>{t('common:actions.cancel')}</button>
          <button type="submit" className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''}`} disabled={isSubmitting}>
            {isEdit ? t('common:actions.saveChanges') : t('settings:users.form.createUser')}
          </button>
        </div>
      </form>

      {isEdit && (
        <div className="card mt-5">
          <div className="card-header"><span className="card-title">{t('settings:users.form.resetPassword')}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label" htmlFor="resetPassword">{t('settings:users.form.newPassword')}</label>
              <div className="form-password-field">
                <input
                  id="resetPassword"
                  type={showResetPassword ? 'text' : 'password'}
                  className={`form-control ${resetPasswordError ? 'form-control-error' : ''}`}
                  value={resetPasswordValue}
                  onChange={(event) => setResetPasswordValue(event.target.value)}
                />
                <button
                  type="button"
                  className="form-password-toggle"
                  onClick={() => setShowResetPassword((prev) => !prev)}
                  aria-label={showResetPassword ? t('settings:users.form.hidePassword') : t('settings:users.form.showPassword')}
                >
                  {showResetPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {resetPasswordError ? <span className="form-error">{resetPasswordError}</span> : <span className="form-help">{passwordPolicyMessage}</span>}
            </div>
            <button
              type="button"
              className={`btn btn-secondary ${resetPasswordSubmitting ? 'btn-loading' : ''}`}
              disabled={resetPasswordSubmitting}
              onClick={handleResetPassword}
            >
              {t('settings:users.form.resetPassword')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserForm;
