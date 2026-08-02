import { useTranslation } from 'react-i18next';

// Same fields, same order, same markup for both Create and Edit — the
// caller (SupplierList.jsx) only differs in what values it resets the form
// to before opening the modal, never in which fields render.
function SupplierFormFields({ register, errors }) {
  const { t } = useTranslation(['suppliers', 'common']);

  return (
    <>
      <div className="form-group">
        <label className="form-label form-label-required" htmlFor="name">{t('suppliers:form.nameLabel')}</label>
        <input
          id="name"
          className={`form-control ${errors.name ? 'form-control-error' : ''}`}
          autoFocus
          {...register('name', { required: t('suppliers:form.nameRequired') })}
        />
        {errors.name && <span className="form-error">{errors.name.message}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label form-label-required" htmlFor="phone">{t('suppliers:form.phoneLabel')}</label>
          <input
            id="phone"
            className={`form-control ${errors.phone ? 'form-control-error' : ''}`}
            {...register('phone', { required: t('suppliers:form.phoneRequired') })}
          />
          {errors.phone && <span className="form-error">{errors.phone.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">{t('suppliers:form.emailLabel')}</label>
          <input
            id="email"
            type="email"
            className={`form-control ${errors.email ? 'form-control-error' : ''}`}
            {...register('email', { pattern: { value: /^\S+@\S+\.\S+$/, message: t('suppliers:form.emailInvalid') } })}
          />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="address">{t('suppliers:form.addressLabel')}</label>
        <input id="address" className="form-control" {...register('address')} />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="notes">{t('suppliers:form.notesLabel')}</label>
        <textarea id="notes" className="form-control" rows={3} {...register('notes')} />
      </div>
    </>
  );
}

export default SupplierFormFields;
