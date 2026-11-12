
import { z } from 'zod';


const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const optionalString = z.preprocess(
    (value) => (typeof value === 'string' ? value : undefined),
    z.string().min(1).optional()
);



const originsSchema = z.string()
    .transform((value, context) => {


        const origins = value.split(',').map
            ((origin) => origin.trim()).filter(Boolean)

        if (origins.length === 0) {
            context.addIssue({ code: 'custom', message: 'FRONTEND_URL must contain at least one origin' });
            return z.NEVER;
        }


        for (const origin of origins) {


            try {

                const url = new URL(origin);
                if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) {

                    throw new Error(`Invalid origin : ${origin}`);

                }

            } catch {

                context.addIssue(
                    {
                        code: 'custom',
                        message: `FRONTEND_URL contains an invalid origin: ${origin}`,
                    }
                )

            }


        }

        return origins;

    })


const baseSchema = z.object({
    APP_NAME: z.string().min(1).default('my-app'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    ENABLE_SWAGGER: booleanFromString.default(false),


    TRUST_PROXY: z.string().
        default('false').
        transform((value, context) => {
            if (value === 'true') return true;
            if (value === 'false') return false;

            const hops = Number(value);

            if (!Number.isInteger(hops) || hops < 0) {
                context.addIssue({
                    code: 'custom',
                    message: 'TRUST_PROXY must be "true", "false", or a non-negative integer',
                })

                return z.NEVER;
            }

            return hops;

        }),

    DATABASE_URL: z.string().startsWith('postgres://'),
    DATABASE_SSL: booleanFromString.default(false),
    DB_POOL_MAX: z.coerce.number().int().positive().min(1).max(100).default(10),

    DB_CONNECTION_TIMEOUT: z.coerce.number().int().positive().min(1_000).max(60_000).default(5_000),

    DB_IDLE_TIMEOUT: z.coerce.number().int().positive().min(1_000).max(120_000).default(10_000),

    APP_PUBLIC_URL: z.url(),
    API_PUBLIC_URL: optionalString.pipe(z.url().optional()),

    FRONTEND_URL: originsSchema,

    JWT_ACCESS_TOKEN_SECRET: z.string().min(30).max(100).regex(/^[A-Za-z0-9_-]+$/),

    JWT_ISSUER: z.string().min(1).default('auth-platform'),

    JWT_ACCESS_TOKEN_EXPIRATION: z.coerce.number().int().positive().min(1).max(86_400).default(3_600),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),

    JWT_AUDIENCE: z.string().min(1).default('auth-platform'),



})
