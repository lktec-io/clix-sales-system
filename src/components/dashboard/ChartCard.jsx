import { FiBarChart2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';

function ChartCard({ title, loading, empty, emptyMessage, children }) {
  const { t } = useTranslation('dashboard');
  const resolvedEmptyMessage = emptyMessage ?? t('charts.noDataYet');
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="card-body">
        {loading ? (
          <Skeleton height={260} />
        ) : empty ? (
          <div className="flex items-center justify-center" style={{ height: 260 }}>
            <EmptyState icon={FiBarChart2} title={resolvedEmptyMessage} />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export default ChartCard;
