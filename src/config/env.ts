import 'dotenv/config';

import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const originsSchema = z.string().transform((value, context) => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    context.addIssue({ code: 'custom', message: 'At least one frontend origin is required' });
    return z.NEVER;
  }

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Origin must not contain a path');
      }
    } catch {
      context.addIssue({ code: 'custom', message: `Invalid frontend origin: ${origin}` });
      return z.NEVER;
    }
  }

  return origins;
});

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value, context) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      const hops = Number(value);
      if (!Number.isInteger(hops) || hops < 0) {
        context.addIssue({
          code: 'custom',
          message: 'TRUST_PROXY must be true, false, or hop count',
        });
        return z.NEVER;
      }
      return hops;
    }),
  DATABASE_URL: z.url().startsWith('postgresql://'),
  DATABASE_SSL: booleanFromString.default(false),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5_000),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  APP_PUBLIC_URL: z.url(),
  API_PUBLIC_URL: optionalString.pipe(z.url().optional()),
  FRONTEND_ORIGINS: originsSchema,
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('auth-platform'),
  JWT_AUDIENCE: z.string().min(1).default('auth-platform-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  MFA_ENCRYPTION_KEY: z.string().refine(
    (value) => {
      try {
        return Buffer.from(value, 'base64').length === 32;
      } catch {
        return false;
      }
    },
    { message: 'MFA_ENCRYPTION_KEY must be exactly 32 bytes encoded as base64' },
  ),
  COOKIE_SECURE: booleanFromString.default(false),
  COOKIE_DOMAIN: optionalString,
  EMAIL_PROVIDER: z.enum(['none', 'smtp']).default('none'),
  EMAIL_FROM: z.string().min(3).default('Auth Platform <no-reply@example.test>'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
  SMTP_SECURE: booleanFromString.default(false),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19_456).max(262_144).default(19_456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).max(10).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(4).default(1),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  WEBAUTHN_RP_ID: optionalString,
  WEBAUTHN_RP_NAME: z.string().min(1).default('Auth Platform'),
  WEBAUTHN_RP_ORIGIN: optionalString,
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
});

const envSchema = baseSchema.superRefine((env, context) => {
  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'Must be true in production',
      });
    }
    if (!env.APP_PUBLIC_URL.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        path: ['APP_PUBLIC_URL'],
        message: 'Must use HTTPS in production',
      });
    }
    if (env.API_PUBLIC_URL && !env.API_PUBLIC_URL.startsWith('https://')) {
      context.addIssue({
        code: 'custom',
        path: ['API_PUBLIC_URL'],
        message: 'Must use HTTPS in production',
      });
    }
  }

  if (env.EMAIL_PROVIDER === 'smtp' && !env.SMTP_HOST) {
    context.addIssue({
      code: 'custom',
      path: ['SMTP_HOST'],
      message: 'Required for SMTP delivery',
    });
  }
  if (env.EMAIL_PROVIDER === 'smtp' && Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) {
    context.addIssue({
      code: 'custom',
      path: ['SMTP_PASSWORD'],
      message: 'SMTP_USER and SMTP_PASSWORD must be provided together',
    });
  }
  if (env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['GOOGLE_CLIENT_SECRET'],
      message: 'Required when GOOGLE_CLIENT_ID is set',
    });
  }
  if ((env.GOOGLE_CLIENT_ID || env.GITHUB_CLIENT_ID) && !env.API_PUBLIC_URL) {
    context.addIssue({
      code: 'custom',
      path: ['API_PUBLIC_URL'],
      message: 'Required when an OAuth provider is configured',
    });
  }
  if (!env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['GOOGLE_CLIENT_ID'],
      message: 'Required when GOOGLE_CLIENT_SECRET is set',
    });
  }
  if (env.GITHUB_CLIENT_ID && !env.GITHUB_CLIENT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['GITHUB_CLIENT_SECRET'],
      message: 'Required when GITHUB_CLIENT_ID is set',
    });
  }
  if (!env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['GITHUB_CLIENT_ID'],
      message: 'Required when GITHUB_CLIENT_SECRET is set',
    });
  }
  if (env.WEBAUTHN_RP_ORIGIN && !env.WEBAUTHN_RP_ID) {
    context.addIssue({
      code: 'custom',
      path: ['WEBAUTHN_RP_ID'],
      message: 'Required when WEBAUTHN_RP_ORIGIN is set',
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return result.data;
}
