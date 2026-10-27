import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

// Per-IP throttles for the public (pre-authentication) endpoints — the
// only thing between an anonymous client and unlimited password/code
// guessing or signup spam. Routed through ApiError so the response shape
// matches every other error the API returns.
function limiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(ApiError.tooManyRequests(message)),
  });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const loginLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  max: env.rateLimit.login,
  message: 'Too many sign-in attempts. Please try again in a few minutes.',
});

export const recoveryLimiter = limiter({
  windowMs: FIFTEEN_MINUTES,
  max: env.rateLimit.recovery,
  message: 'Too many password recovery attempts. Please try again later.',
});

export const signupLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  max: env.rateLimit.signup,
  message: 'Too many sign-up attempts from this network. Please try again later.',
});
