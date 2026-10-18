import rateLimit from 'express-rate-limit';

// NFR-SEC-06: 5 FAILED attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,                      // express-rate-limit v7. On v6 this option is called `max`.
  skipSuccessfulRequests: true,  // only failed logins (non-2xx) count toward the limit
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

