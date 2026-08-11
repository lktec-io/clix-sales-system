import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { corsOptions } from './config/cors.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';
import platformRoutes from './routes/platform/index.js';
import paymentWebhookRoutes from './routes/paymentWebhook.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Trust exactly one hop upstream (Nginx) so req.ip and express-rate-limit
// correctly read the real client IP from X-Forwarded-For instead of
// throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. `1` (not `true`) — trust
// only the immediate reverse proxy, not an arbitrary chain of them.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors(corsOptions));
// The `verify` hook stashes the exact raw request bytes on every request
// (harmless, unused by any existing route) — purely so
// verifyWebhookSignature.js can check a real payment provider's
// HMAC-over-raw-body signature later without this global parser getting in
// the way. Parsing behavior/limits/errors for every other route are
// completely unchanged.
app.use(express.json({ limit: '2mb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/v1', apiLimiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Mounted separately from the tenant router tree (routes/index.js), which
// this phase never opens — the platform portal is a fully independent
// route surface, distinguished at the Express layer, not just by JWT.
app.use('/api/v1/platform', platformRoutes);
// A payment provider's webhook — no tenant/platform-admin JWT exists to
// send, so this lives outside both router trees, trusted only by
// verifyWebhookSignature.js (see routes/paymentWebhook.routes.js).
app.use('/api/v1/webhooks/payments', paymentWebhookRoutes);
app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
