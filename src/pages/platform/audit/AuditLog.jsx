import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Table from '../../../components/common/Table';
import Pagination from '../../../components/common/Pagination';
import { useTable } from '../../../hooks/useTable';
import * as platformAuditLogService from '../../../services/platformAuditLogService';
import { PLATFORM_ROUTES } from '../../../constants/routes';

function AuditLog() {
  const fetchLogs = useCallback((params) => platformAuditLogService.listAuditLogs(params), []);
  const { items, meta, loading, page, setPage } = useTable(fetchLogs);

  const columns = [
    { key: 'created_at', label: 'Timestamp', render: (row) => new Date(row.created_at).toLocaleString() },
    { key: 'admin', label: 'Administrator', render: (row) => (row.admin_first_name ? `${row.admin_first_name} ${row.admin_last_name}` : 'System') },
    { key: 'action', label: 'Action' },
    { key: 'description', label: 'Description' },
    { key: 'tenant_name', label: 'Tenant', render: (row) => (
      row.tenant_id ? <Link to={`${PLATFORM_ROUTES.TENANTS}/${row.tenant_id}`}>{row.tenant_name}</Link> : '—'
    ) },
    { key: 'ip_address', label: 'IP Address' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Every platform administrator action, in order.</p>
        </div>
      </div>

      <div className="card">
        <Table columns={columns} rows={items} loading={loading} emptyMessage="No audit log entries yet." />
        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
      </div>
    </div>
  );
}

export default AuditLog;
