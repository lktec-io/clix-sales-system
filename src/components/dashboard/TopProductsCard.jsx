import { motion } from 'framer-motion';
import { FiPackage } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import EmptyState from '../common/EmptyState';
import Skeleton from '../common/Skeleton';
import { formatCurrency, formatNumber } from '../../utils/formatCurrency';

function TopProductsCard({ products, loading }) {
  const { t } = useTranslation('dashboard');
  const totalRevenue = products.reduce((sum, p) => sum + Number(p.revenue || 0), 0);

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{t('topProducts.title')}</span></div>
      <div className="card-body">
        {loading ? (
          <Skeleton height={220} />
        ) : products.length === 0 ? (
          <EmptyState icon={FiPackage} title={t('topProducts.noSales')} />
        ) : (
          <ul className="top-products-list">
            {products.map((product, index) => {
              const percent = totalRevenue > 0 ? (Number(product.revenue) / totalRevenue) * 100 : 0;
              return (
                <li key={product.id} className="top-products-item">
                  <div className="top-products-thumb">
                    {product.image_path ? <img src={product.image_path} alt={product.name} /> : <FiPackage aria-hidden="true" />}
                  </div>
                  <div className="top-products-main">
                    <div className="top-products-row">
                      <span className="top-products-name">{product.name}</span>
                      <span className="top-products-revenue">{formatCurrency(product.revenue)}</span>
                    </div>
                    <div className="top-products-track">
                      <motion.div
                        className="top-products-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.7, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                    <div className="top-products-meta">
                      <span>{t('topProducts.sold', { count: formatNumber(product.quantity) })}</span>
                      <span>{percent.toFixed(1)}%</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default TopProductsCard;
