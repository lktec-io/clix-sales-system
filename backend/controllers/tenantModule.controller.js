import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import { resolveEnabledModulesForTenant } from '../services/moduleResolution.service.js';

// Read-only, authenticate-only — every authenticated user can see their
// own tenant's resolved nav shape. Permission filtering still narrows it
// further client-side, exactly as today's static Sidebar.jsx already does.
export const getMine = asyncHandler(async (req, res) => {
  const modules = await resolveEnabledModulesForTenant(req.user.tenantId);
  const data = modules.map((module) => ({
    key: module.key,
    name: module.name,
    icon: module.icon,
    route: module.route,
    requiredPermission: module.required_permission,
    navigationOrder: module.navigation_order,
    dashboardWidgets: module.dashboard_widgets,
  }));
  return success(res, { data });
});
