import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

function Pagination({ page, totalPages, total, limit, onPageChange }) {
  const { t } = useTranslation('common');
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="table-pagination">
      <span>
        {t('pagination.showing', { start, end, total })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('pagination.previousPage')}
        >
          <FiChevronLeft />
        </button>
        <span className="pagination-indicator">
          {t('pagination.pageOf', { page, totalPages: Math.max(totalPages, 1) })}
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm btn-icon"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('pagination.nextPage')}
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
