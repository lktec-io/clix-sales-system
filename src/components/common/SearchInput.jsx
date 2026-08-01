import { forwardRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import '../../styles/components/SearchInput.css';

// forwardRef so callers that need to programmatically refocus the field
// (POS returning focus to search after adding a product) can — every
// existing caller that doesn't pass a ref is unaffected.
const SearchInput = forwardRef(({ value, onChange, placeholder, onKeyDown }, ref) => {
  const { t } = useTranslation('common');
  const resolvedPlaceholder = placeholder ?? `${t('actions.search')}...`;
  return (
    <div className="search-input">
      <FiSearch className="search-input-icon" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className="search-input-field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
      />
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
