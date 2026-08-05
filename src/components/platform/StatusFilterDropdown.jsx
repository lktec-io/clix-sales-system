import { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiCheck } from 'react-icons/fi';
import '../../styles/components/StatusFilterDropdown.css';

// No status/filter-dropdown component exists anywhere else in the
// codebase (every existing list page only filters via free-text search) —
// built fresh, generic enough to reuse for any { value, label } option set.
function StatusFilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeLabel = options.find((option) => option.value === value)?.label || label;

  return (
    <div className="status-filter-dropdown" ref={ref}>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen((prev) => !prev)}>
        {activeLabel} <FiChevronDown aria-hidden="true" />
      </button>
      {open && (
        <div className="status-filter-dropdown-menu">
          <button
            type="button"
            className={`status-filter-dropdown-item ${!value ? 'is-active' : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            {!value && <FiCheck aria-hidden="true" />} All
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`status-filter-dropdown-item ${value === option.value ? 'is-active' : ''}`}
              onClick={() => { onChange(option.value); setOpen(false); }}
            >
              {value === option.value && <FiCheck aria-hidden="true" />} {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default StatusFilterDropdown;
