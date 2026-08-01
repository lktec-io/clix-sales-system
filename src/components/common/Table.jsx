import { FiInbox } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

const SKELETON_ROWS = 5;

// Styled by the core design system's styles/tables.css (imported globally via theme.css).
// columns: [{ key, label, render?(row), sortable? }]
function Table({ columns, rows, loading, emptyMessage, sort, onSortChange, rowKey = 'id' }) {
  const { t } = useTranslation('common');
  const resolvedEmptyMessage = emptyMessage ?? t('table.noRecordsFound');
  const handleSort = (column) => {
    if (!column.sortable || !onSortChange) return;
    const isSameColumn = sort?.key === column.key;
    const nextDirection = isSameColumn && sort.direction === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: column.key, direction: nextDirection });
  };

  return (
    <div className="table-wrapper">
      <table className="table table-sortable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} onClick={() => handleSort(column)}>
                {column.label}
                {sort?.key === column.key && (sort.direction === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => `skeleton-row-${rowIndex}`).map((rowKeyValue) => (
              <tr key={rowKeyValue}>
                {columns.map((column) => (
                  <td key={column.key}>
                    <Skeleton height="1em" width={column.key === columns[0].key ? '70%' : '50%'} />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                <EmptyState icon={FiInbox} title={resolvedEmptyMessage} />
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row[rowKey]}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
