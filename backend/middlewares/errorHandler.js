import { ApiError } from '../utils/apiError.js';
import { failure } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';

export function notFoundHandler(req, res) {
  return failure(res, { message: `Route not found: ${req.method} ${req.originalUrl}`, status: 404 });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // code/errno/sqlMessage/sqlState are the mysql2 driver's own diagnostic
  // fields — undefined and harmless to log for a plain ApiError, but for an
  // unexpected DB-level failure (FK violation, truncated ENUM value, lock
  // timeout, ...) these are what actually explains a bare 500, and they are
  // NOT included in err.message/err.stack alone on every driver version.
  logger.error(err.message, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    code: err.code,
    errno: err.errno,
    sqlMessage: err.sqlMessage,
    sqlState: err.sqlState,
  });

  if (err instanceof ApiError) {
    return failure(res, { message: err.message, errors: err.errors, status: err.status });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return failure(res, { message: 'A record with these details already exists', status: 409 });
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return failure(res, { message: 'This record cannot be deleted because other records still depend on it.', status: 409 });
  }

  // Never leak stack traces or raw SQL/driver errors to the client.
  return failure(res, { message: 'Internal server error', status: 500 });
}
