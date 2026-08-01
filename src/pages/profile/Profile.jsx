import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiUpload, FiCheck } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useLanguage } from '../../hooks/useLanguage';
import * as authService from '../../services/authService';
import '../../styles/pages/CompanySettings.css';

function Profile() {
  const { t } = useTranslation(['profile', 'common']);
  const { user, updateUser, logout } = useAuth();
  const { language, setLanguage, languages } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [avatarPath, setAvatarPath] = useState(user?.avatar_path || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const profileForm = useForm({
    defaultValues: {
      firstName: user?.first_name || '',
      lastName: user?.last_name || '',
      gender: user?.gender || '',
      phone: user?.phone || '',
    },
  });

  const passwordForm = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const newPassword = passwordForm.watch('newPassword');

  const onSubmitProfile = async (values) => {
    setProfileError('');
    try {
      const updated = await authService.updateProfile(values);
      updateUser(updated);
      toast.success(t('profile:personalInfo.updateSuccess'));
    } catch (err) {
      setProfileError(err.response?.data?.message || t('profile:personalInfo.updateError'));
    }
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError('');
    try {
      const updated = await authService.uploadProfileAvatar(file);
      setAvatarPath(updated.avatar_path);
      updateUser(updated);
      toast.success(t('profile:avatar.uploadSuccess'));
    } catch (err) {
      setProfileError(err.response?.data?.message || t('profile:avatar.uploadError'));
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const onSubmitPassword = async (values) => {
    setPasswordError('');
    try {
      await authService.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      toast.success(t('profile:password.changeSuccess'));
      passwordForm.reset();
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || t('profile:password.changeError'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('profile:page.title')}</h1>
          <p className="page-subtitle">{t('profile:page.subtitle')}</p>
        </div>
      </div>

      {profileError && <div className="alert alert-danger mb-4" role="alert">{profileError}</div>}

      <div className="card mb-5">
        <div className="card-body flex items-center gap-4">
          <div className="avatar-preview">
            {avatarPath ? <img src={avatarPath} alt={t('common:misc.avatar')} loading="lazy" /> : <span className="company-logo-placeholder">{user?.first_name?.charAt(0).toUpperCase()}</span>}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="visually-hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              className={`btn btn-secondary ${uploadingAvatar ? 'btn-loading' : ''}`}
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUpload aria-hidden="true" /> {t('profile:avatar.upload')}
            </button>
            <p className="form-help mt-2">{t('profile:avatar.hint')}</p>
          </div>
        </div>
      </div>

      <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} noValidate>
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('profile:personalInfo.title')}</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="firstName">{t('common:labels.firstName')}</label>
                <input
                  id="firstName"
                  className={`form-control ${profileForm.formState.errors.firstName ? 'form-control-error' : ''}`}
                  {...profileForm.register('firstName', { required: t('profile:validation.firstNameRequired') })}
                />
                {profileForm.formState.errors.firstName && <span className="form-error">{profileForm.formState.errors.firstName.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="lastName">{t('common:labels.lastName')}</label>
                <input
                  id="lastName"
                  className={`form-control ${profileForm.formState.errors.lastName ? 'form-control-error' : ''}`}
                  {...profileForm.register('lastName', { required: t('profile:validation.lastNameRequired') })}
                />
                {profileForm.formState.errors.lastName && <span className="form-error">{profileForm.formState.errors.lastName.message}</span>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="phone">{t('common:labels.phone')}</label>
                <input
                  id="phone"
                  className={`form-control ${profileForm.formState.errors.phone ? 'form-control-error' : ''}`}
                  {...profileForm.register('phone', { required: t('profile:validation.phoneRequired') })}
                />
                {profileForm.formState.errors.phone && <span className="form-error">{profileForm.formState.errors.phone.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="gender">{t('common:labels.gender')}</label>
                <select id="gender" className="form-control" {...profileForm.register('gender')}>
                  <option value="">{t('common:labels.preferNotToSay')}</option>
                  <option value="male">{t('common:labels.male')}</option>
                  <option value="female">{t('common:labels.female')}</option>
                  <option value="other">{t('common:labels.other')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className={`btn btn-primary ${profileForm.formState.isSubmitting ? 'btn-loading' : ''}`} disabled={profileForm.formState.isSubmitting}>
            {t('profile:personalInfo.saveButton')}
          </button>
        </div>
      </form>

      <div className="card mb-5 mt-5">
        <div className="card-header">
          <span className="card-title">{t('profile:language.title')}</span>
        </div>
        <div className="card-body">
          <p className="text-secondary text-sm mb-4">{t('profile:language.subtitle')}</p>
          <div className="flex flex-wrap gap-3">
            {languages.map((option) => {
              const isActive = language === option.code;
              return (
                <button
                  key={option.code}
                  type="button"
                  className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  aria-pressed={isActive}
                  onClick={() => setLanguage(option.code)}
                >
                  <span aria-hidden="true">{option.flag}</span> {option.label}
                  {isActive && <FiCheck aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {passwordError && <div className="alert alert-danger mb-4 mt-5" role="alert">{passwordError}</div>}

      <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} noValidate className="mt-5">
        <div className="card mb-5">
          <div className="card-header"><span className="card-title">{t('profile:password.title')}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="currentPassword">{t('profile:password.current')}</label>
              <input
                id="currentPassword"
                type="password"
                className={`form-control ${passwordForm.formState.errors.currentPassword ? 'form-control-error' : ''}`}
                {...passwordForm.register('currentPassword', { required: t('profile:password.currentRequired') })}
              />
              {passwordForm.formState.errors.currentPassword && <span className="form-error">{passwordForm.formState.errors.currentPassword.message}</span>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="newPassword">{t('profile:password.new')}</label>
                <input
                  id="newPassword"
                  type="password"
                  className={`form-control ${passwordForm.formState.errors.newPassword ? 'form-control-error' : ''}`}
                  {...passwordForm.register('newPassword', {
                    required: t('profile:password.newRequired'),
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
                      message: t('profile:password.policyMessage'),
                    },
                  })}
                />
                {passwordForm.formState.errors.newPassword && <span className="form-error">{passwordForm.formState.errors.newPassword.message}</span>}
              </div>
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="confirmPassword">{t('profile:password.confirm')}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={`form-control ${passwordForm.formState.errors.confirmPassword ? 'form-control-error' : ''}`}
                  {...passwordForm.register('confirmPassword', {
                    required: t('profile:password.confirmRequired'),
                    validate: (value) => value === newPassword || t('profile:password.mismatch'),
                  })}
                />
                {passwordForm.formState.errors.confirmPassword && <span className="form-error">{passwordForm.formState.errors.confirmPassword.message}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className={`btn btn-primary ${passwordForm.formState.isSubmitting ? 'btn-loading' : ''}`} disabled={passwordForm.formState.isSubmitting}>
            {t('profile:password.changeButton')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Profile;
