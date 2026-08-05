import rateLimit from 'express-rate-limit';
import { failure } from '../utils/apiResponse.js';

function limiterHandler(req, res) {
  return failure(res, { message: 'Too many requests, please try again later', status: 429 });
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler,
});

// A spammed *tenant* is more consequential than a mistyped login — tighter
// than authLimiter (5/hour vs. 10/15min).
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler,
});

// Platform admin login — small, known population, so this is purely
// brute-force protection (same shape as authLimiter), layered on top of
// platform_admins' own per-account failed-attempt lockout.
export const platformAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limiterHandler,
});
