import * as platformAuditLogRepository from '../repositories/platformAuditLog.repository.js';

export async function listAuditLogs(query) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);

  const { rows, total } = await platformAuditLogRepository.findAll({
    page,
    limit,
    tenantId: query.tenantId ? Number(query.tenantId) : undefined,
    adminId: query.adminId ? Number(query.adminId) : undefined,
    action: query.action,
  });

  return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
