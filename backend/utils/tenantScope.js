// Centralized query-scope builder for tenant-owned tables — replaces the
// branchFilter(branchIds) helper that used to be copy-pasted verbatim
// across 8 repository files (sale, purchase, expense, inventory, return,
// transfer, dashboard, report). Combining tenant + branch scoping into one
// function (rather than two independent helpers) is deliberate: tenant
// scope is NEVER optional — unlike branch scope, there is no "Super Admin
// sees all tenants" analogue, so it would be a real cross-tenant leak for a
// repository to apply a branch filter while forgetting the tenant one. By
// bundling them, that mistake is no longer possible to make by omission.
//
// branchIds keeps the exact nullable-allowlist shape
// backend/utils/branchScope.js's getAccessibleBranchIds() already returns:
//   - undefined  → no branch dimension on this query at all (tenant-only)
//   - null       → unrestricted *within* the tenant (Super Admin)
//   - []         → no accessible branches (deliberately matches nothing)
//   - [...ids]   → IN (?) allowlist
export function buildScope({ tenantId, tenantColumn = 'tenant_id', branchIds, branchColumn = 'branch_id' } = {}) {
  if (!tenantId) {
    throw new Error('buildScope() requires a tenantId — every tenant-owned query must be scoped');
  }

  const clauses = [`AND ${tenantColumn} = ?`];
  const params = [tenantId];

  if (branchIds !== undefined) {
    if (branchIds === null) {
      // unrestricted within the tenant — no additional clause
    } else if (branchIds.length === 0) {
      clauses.push('AND 1 = 0');
    } else {
      clauses.push(`AND ${branchColumn} IN (?)`);
      params.push(branchIds);
    }
  }

  return { clause: clauses.join(' '), params };
}
