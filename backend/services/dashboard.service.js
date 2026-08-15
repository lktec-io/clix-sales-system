import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getAccessibleBranchIds } from '../utils/branchScope.js';
import * as dashboardRepository from '../repositories/dashboard.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { getPortfolioKpis } from './loan.service.js';
import { getDashboardSummary as getMedicineDashboardSummary } from './medicine.service.js';
import { getSalesSummary as getPharmacySalesSummary } from './pharmacySale.service.js';
import { getSalesSummary as getRestaurantSalesSummary, getPendingKitchenCount } from './restaurantOrder.service.js';
import { getOccupancySummary } from './restaurantTable.service.js';
import { getDashboardSummary as getRepairDashboardSummary } from './repair.service.js';

const EMPTY_KPIS = {
  todaySales: 0, monthlySales: 0, todayProfit: 0, monthlyProfit: 0,
  totalCustomers: 0, totalSuppliers: 0, totalProducts: 0, inventoryValue: 0,
  lowStockCount: 0, todayExpenses: 0, monthlyExpenses: 0,
  todayOrders: 0, pendingTransfers: 0, pendingPurchases: 0,
  totalBorrowers: 0, activeLoans: 0, totalDisbursed: 0, outstandingBalance: 0,
  overdueLoans: 0, portfolioAtRisk: 0, todayCollections: 0, totalCollected: 0, totalSavingsBalance: 0,
};

const EMPTY_INVENTORY_SUMMARY = { outOfStock: 0, lowStock: 0, inStock: 0 };

// The dashboard aggregates a dozen independent queries across sales,
// inventory, and expense data — a single malformed query (a
// missing table, a renamed column after a schema change that hasn't been
// fully rolled out yet, a lock timeout) should degrade that one widget to
// an empty/zero state, not crash the whole dashboard with a 500. The real
// error is still logged server-side so it isn't silently lost.
async function safely(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    logger.error(`Dashboard query failed: ${label}`, { message: err.message, stack: err.stack });
    return fallback;
  }
}

const CHART_HANDLERS = {
  'sales-trend': (tenantId, branchIds, query) => safely('sales-trend', () => dashboardRepository.getSalesTrend(tenantId, branchIds, query.range), []),
  'revenue-trend': (tenantId, branchIds) => safely('revenue-trend', () => dashboardRepository.getRevenueTrend(tenantId, branchIds), []),
  'expense-trend': (tenantId, branchIds) => safely('expense-trend', () => dashboardRepository.getExpenseTrend(tenantId, branchIds), []),
  'profit-trend': (tenantId, branchIds) => safely('profit-trend', () => dashboardRepository.getProfitTrend(tenantId, branchIds), []),
  'top-products': (tenantId, branchIds) => safely('top-products', () => dashboardRepository.getTopProducts(tenantId, branchIds), []),
  'branch-performance': (tenantId, branchIds) => safely('branch-performance', () => dashboardRepository.getBranchPerformance(tenantId, branchIds), []),
  'inventory-summary': (tenantId, branchIds) => safely('inventory-summary', () => dashboardRepository.getInventorySummary(tenantId, branchIds), EMPTY_INVENTORY_SUMMARY),
  'payment-status': (tenantId, branchIds) => safely('payment-status', () => dashboardRepository.getPaymentStatus(tenantId, branchIds), []),
  'revenue-vs-expenses': (tenantId, branchIds) => safely('revenue-vs-expenses', () => dashboardRepository.getRevenueVsExpenses(tenantId, branchIds), []),
};

const EMPTY_MICROFINANCE_KPIS = {
  totalBorrowers: 0, activeLoans: 0, totalDisbursed: 0, outstandingBalance: 0,
  overdueLoans: 0, portfolioAtRisk: 0, todayCollections: 0, totalCollected: 0, totalSavingsBalance: 0,
  pendingApplications: 0,
};

const EMPTY_PHARMACY_KPIS = {
  totalMedicines: 0, lowStockCount: 0, outOfStockCount: 0, expiredCount: 0, expiringSoonCount: 0,
  todaySalesCount: 0, todayRevenue: 0, medicinesSoldCount: 0, todayProfit: 0,
};

// todayOrders/todaySales are the exact same keys (and meaning) as retail's
// own EMPTY_KPIS — a genuinely shared concept, safe to reuse directly since
// Restaurant and Retail are mutually exclusive templates and never merge
// together for one tenant. Only the Restaurant-unique concepts get new keys.
const EMPTY_RESTAURANT_KPIS = {
  todayOrders: 0, todaySales: 0, completedOrdersToday: 0, pendingKitchenOrders: 0,
  occupiedTables: 0, availableTables: 0,
};

const EMPTY_REPAIR_KPIS = {
  todayRepairs: 0, pendingDiagnosis: 0, waitingApproval: 0, inRepairCount: 0,
  readyForCollection: 0, completedRepairsToday: 0, outstandingRepairPayments: 0,
};

export async function getKpis(user) {
  const branchIds = await getAccessibleBranchIds(user);
  const [retailKpis, microfinanceKpis, pharmacyStockKpis, pharmacySalesKpis, restaurantOrderKpis, restaurantTableKpis, repairKpis] = await Promise.all([
    safely('kpis', () => dashboardRepository.getKpis(user.tenantId, branchIds), EMPTY_KPIS),
    // Real aggregates from loan.service.js's own portfolio queries — reused,
    // not duplicated. Cheap (indexed COUNT/SUM against tenant_id) and
    // harmless for a tenant whose template doesn't include Loans: the
    // underlying tables are simply empty for them, and hasWidget() on the
    // frontend hides these keys from any dashboard that isn't Microfinance.
    safely('microfinance-kpis', () => getPortfolioKpis(user), EMPTY_MICROFINANCE_KPIS),
    // Same reuse principle for Pharmacy — medicine.service.js/
    // pharmacySale.service.js's own summary queries, harmless no-op cost
    // for any tenant whose template doesn't include Medicines.
    safely('pharmacy-stock-kpis', () => getMedicineDashboardSummary(user), EMPTY_PHARMACY_KPIS),
    safely('pharmacy-sales-kpis', () => getPharmacySalesSummary(user), EMPTY_PHARMACY_KPIS),
    // Same reuse principle for Restaurant.
    safely('restaurant-order-kpis', async () => ({
      ...(await getRestaurantSalesSummary(user)),
      ...(await getPendingKitchenCount(user)),
    }), EMPTY_RESTAURANT_KPIS),
    safely('restaurant-table-kpis', () => getOccupancySummary(user), EMPTY_RESTAURANT_KPIS),
    // Same reuse principle for Electronics/Repairs.
    safely('repair-kpis', () => getRepairDashboardSummary(user), EMPTY_REPAIR_KPIS),
  ]);
  return {
    ...retailKpis, ...microfinanceKpis, ...pharmacyStockKpis, ...pharmacySalesKpis,
    ...restaurantOrderKpis, ...restaurantTableKpis, ...repairKpis,
  };
}

export async function getChart(user, type, query = {}) {
  const handler = CHART_HANDLERS[type];
  if (!handler) {
    throw new ApiError(400, `Unknown chart type "${type}"`);
  }
  const branchIds = await getAccessibleBranchIds(user);
  return handler(user.tenantId, branchIds, query);
}

export async function getSystemStatus(tenantId) {
  const cloudinaryConnected = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
  const result = await safely('system-status', () => dashboardRepository.getSystemStatus(tenantId), null);
  if (!result) {
    // The queries themselves failed — that's a real signal, not a reason to
    // pretend everything is fine, so databaseConnected reflects it honestly.
    return { databaseConnected: false, cloudinaryConnected, serverOnline: true, lastBackupAt: null, lastBackupStatus: null, onlineUsers: 0 };
  }
  return {
    databaseConnected: true, // the queries above just succeeded against MySQL
    cloudinaryConnected,
    serverOnline: true, // trivially true — this response is coming from the server
    lastBackupAt: result.lastBackupAt,
    lastBackupStatus: result.lastBackupStatus,
    onlineUsers: result.onlineUsers,
  };
}

export async function getActivity(tenantId, limit = 20) {
  return safely('activity', () => activityLogRepository.findRecent(tenantId, limit), []);
}
