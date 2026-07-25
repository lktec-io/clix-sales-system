import { env } from './env.js';

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Parse comma-separated FRONTEND_URL values
const configuredOrigins = (env.frontendUrl || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

// Production: only configured origins
// Development: configured origins + localhost
const allowedOrigins = env.isProduction
  ? configuredOrigins
  : [...new Set([...configuredOrigins, ...DEV_ORIGINS])];

export const corsOptions = {
  origin(origin, callback) {
    // Allow requests without Origin header
    // (Postman, curl, server-to-server, health checks)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, '');

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.error(
      `[CORS] Blocked Origin: ${normalizedOrigin}\nAllowed Origins: ${allowedOrigins.join(', ')}`
    );

    return callback(new Error('Not allowed by CORS'));
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
  ],

  optionsSuccessStatus: 204,
};