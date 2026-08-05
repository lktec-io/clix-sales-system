import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/apiResponse.js';
import * as platformAuditLogService from '../services/platformAuditLog.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await platformAuditLogService.listAuditLogs(req.query);
  return success(res, { data: { items, meta } });
});
