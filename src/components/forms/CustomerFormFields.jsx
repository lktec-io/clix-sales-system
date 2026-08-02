import { useTranslation } from 'react-i18next';

// Same fields, same order, same markup for both Create and Edit — the
// caller (CustomerList.jsx) only differs in what values it resets the form
// to before opening the modal, never in which fields render.
function CustomerFormFields({ register, errors }) {
  const { t } = useTranslation(['customers', 'common']);

  return (
    <>
      <div className="form-group">
        <label className="form-label form-label-required" htmlFor="fullName">{t('customers:form.fullName')}</label>
        <input
          id="fullName"
          className={`form-control ${errors.fullName ? 'form-control-error' : ''}`}
          autoFocus
          {...register('fullName', { required: t('customers:validation.fullNameRequired') })}
        />
        {errors.fullName && <span className="form-error">{errors.fullName.message}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="phone">{t('customers:form.phone')}</label>
          <input
            id="phone"
            className={`form-control ${errors.phone ? 'form-control-error' : ''}`}
            {...register('phone', { required: t('customers:validation.phoneRequired') })}
          />
          {errors.phone && <span className="form-error">{errors.phone.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">{t('customers:form.email')}</label>
          <input
            id="email"
            type="email"
            className={`form-control ${errors.email ? 'form-control-error' : ''}`}
            {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: t('customers:validation.invalidEmail') } })}
          />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="address">{t('customers:form.address')}</label>
        <input id="address" className="form-control" {...register('address')} />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="notes">{t('customers:form.notes')}</label>
        <textarea id="notes" className="form-control" rows={3} {...register('notes')} />
      </div>
    </>
  );
}

export default CustomerFormFields;
