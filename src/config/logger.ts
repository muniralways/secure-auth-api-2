import pino, { type Logger } from 'pino';

import type { Env } from './env.js';

export function createLogger(env: Pick<Env, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'auth-platform', environment: env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'password',
        '*.password',
        'currentPassword',
        '*.currentPassword',
        'newPassword',
        '*.newPassword',
        'token',
        '*.token',
        'refreshToken',
        '*.refreshToken',
        'authorization',
        '*.authorization',
        'cookie',
        '*.cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'DATABASE_URL',
        '*.DATABASE_URL',
        'SMTP_PASSWORD',
        '*.SMTP_PASSWORD',
        'MFA_ENCRYPTION_KEY',
        '*.MFA_ENCRYPTION_KEY',
      ],
      censor: '[REDACTED]',
    },
  });
}
