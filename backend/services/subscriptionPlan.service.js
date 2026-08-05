import { ApiError } from '../utils/apiError.js';
import * as subscriptionPlanRepository from '../repositories/subscriptionPlan.repository.js';
import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';

async function findOwnedPlan(id) {
  const plan = await subscriptionPlanRepository.findById(id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  return plan;
}

async function logAction(platformAdminId, action, description, ipAddress) {
  await platformAuditLogRepository.create({ platformAdminId, action, description, tenantId: null, ipAddress });
}

// Reshaped, active-only catalog for tenant-facing reads (billing.routes.js's
// GET /plans) — never exposes is_active/sort_order/timestamps, tenants only
// need what they'd see comparing plans.
export async function listPublicPlans() {
  const plans = await subscriptionPlanRepository.findAllActive();
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceMonthly: Number(plan.price_monthly),
    priceQuarterly: Number(plan.price_quarterly),
    priceYearly: Number(plan.price_yearly),
    currency: plan.currency,
    features: plan.features,
    isRecommended: Boolean(plan.is_recommended),
  }));
}

export async function listForAdmin() {
  return subscriptionPlanRepository.findAllForAdmin();
}

export async function getById(id) {
  return findOwnedPlan(id);
}

export async function createPlan(data, admin, ipAddress) {
  const existing = await subscriptionPlanRepository.findBySlug(data.slug);
  if (existing) throw new ApiError(409, 'A plan with this slug already exists');

  const plan = await subscriptionPlanRepository.create(data);
  await logAction(admin.id, 'plan.create', `Created plan "${plan.name}"`, ipAddress);
  return plan;
}

export async function updatePlan(id, data, admin, ipAddress) {
  await findOwnedPlan(id);
  const plan = await subscriptionPlanRepository.update(id, data);
  await logAction(admin.id, 'plan.update', `Updated plan "${plan.name}"`, ipAddress);
  return plan;
}

export async function activatePlan(id, admin, ipAddress) {
  const plan = await findOwnedPlan(id);
  const updated = await subscriptionPlanRepository.setActive(id, true);
  await logAction(admin.id, 'plan.activate', `Activated plan "${plan.name}"`, ipAddress);
  return updated;
}

export async function deactivatePlan(id, admin, ipAddress) {
  const plan = await findOwnedPlan(id);
  const updated = await subscriptionPlanRepository.setActive(id, false);
  await logAction(admin.id, 'plan.deactivate', `Deactivated plan "${plan.name}"`, ipAddress);
  return updated;
}

export async function markRecommended(id, admin, ipAddress) {
  const plan = await findOwnedPlan(id);
  const updated = await subscriptionPlanRepository.setRecommended(id);
  await logAction(admin.id, 'plan.mark_recommended', `Marked "${plan.name}" as the recommended plan`, ipAddress);
  return updated;
}

export async function reorderPlans(orderedIds, admin, ipAddress) {
  const updated = await subscriptionPlanRepository.reorder(orderedIds);
  await logAction(admin.id, 'plan.reorder', 'Reordered subscription plans', ipAddress);
  return updated;
}
