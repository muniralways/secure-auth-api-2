# Auth Platform

> **Status: work in progress.** This repository is under active construction.
> The feature list below describes the target design; it is not all implemented
> yet and the service is not production-ready.

A production-oriented authentication platform built with strict TypeScript, Express, PostgreSQL, and React. It supports rotating opaque sessions, Argon2id passwords, TOTP, passkeys, social OAuth, magic links, device management, security analytics, RBAC, and an auditable SQL data model.

## What is implemented

- Registration with enumeration-resistant responses and email verification
- Login, current user, logout, logout-all, and per-session revocation
- HS256 access JWTs with strict issuer, audience, algorithm, purpose, and expiry checks
- HttpOnly refresh cookies, rotating refresh tokens, CSRF tokens, and reuse-family revocation
- Password change, generic forgot-password flow, single-use reset tokens, and session invalidation
- `user` / `admin` RBAC and administrative user status/role management
- TOTP enrollment, activation, login challenge, replay prevention, disablement, and 10 single-use recovery codes
- Profile editing, email-change verification, verification resend, and GDPR-style account deletion
- Google/GitHub OAuth, single-use magic-link login, and WebAuthn/passkey authentication
- Named-device session management, login history, risk summaries, and admin audit-log browsing
- SMTP email abstraction with an explicit no-delivery mode
- Audit events, request IDs, redacted Pino logs, rate limits, safe CORS, Helmet, and body limits
- PostgreSQL SQL migrations with checksums, locking, and transaction-safe application
- Unit tests and integration tests against a real, project-local PostgreSQL 18 process
- OpenAPI 3.1 specification in [`docs/openapi.yaml`](docs/openapi.yaml)

## Requirements

- Node.js 22 or 24 LTS (the project is also tested by the current environment on Node 26)
- npm 11+
- PostgreSQL 15+ for development/production
- No global PostgreSQL installation is needed for integration tests; a development-only embedded PostgreSQL binary is used

## Quick start

```bash
npm ci
copy .env.example .env
```

Replace every placeholder in `.env`, especially `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `MFA_ENCRYPTION_KEY`.

Create a development database using a PostgreSQL administrative account:

```sql
CREATE ROLE auth_migrator LOGIN PASSWORD 'replace-this-migration-password';
CREATE DATABASE auth_platform OWNER auth_migrator;
```

Then run:

```bash
npm run db:migrate
npm run db:status
npm run dev
```

The API listens on `http://localhost:3000` by default. Health probes:

- `GET /health/live`
- `GET /health/ready`

Migrations are intentionally **not** run automatically at server startup.

## Environment variables

See [`.env.example`](.env.example). Important variables:

| Variable             | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`       | PostgreSQL URL used by the current process                 |
| `DATABASE_SSL`       | Enables certificate-verified PostgreSQL TLS                |
| `JWT_ACCESS_SECRET`  | At least 32 characters; sign access and MFA challenge JWTs |
| `MFA_ENCRYPTION_KEY` | Exactly 32 random bytes encoded as base64                  |
| `FRONTEND_ORIGINS`   | Comma-separated exact browser origins; never `*`           |
| `APP_PUBLIC_URL`     | Trusted base URL used in email links                       |
| `API_PUBLIC_URL`     | Public API URL used for OAuth callback URLs                |
| `COOKIE_SECURE`      | Must be `true` in production                               |
| `TRUST_PROXY`        | `false`, `true`, or the exact trusted proxy hop count      |
| `EMAIL_PROVIDER`     | `none` or `smtp`; `none` never claims delivery             |
| `GOOGLE_CLIENT_ID`   | Optional Google OAuth client ID                            |
| `GITHUB_CLIENT_ID`   | Optional GitHub OAuth client ID                            |
| `WEBAUTHN_RP_ID`     | WebAuthn relying-party domain                              |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Do not commit `.env`. Production secrets belong in a secret manager.

## Email testing

With `EMAIL_PROVIDER=none`, verification/reset records are created but no message is delivered and no token is logged. For local end-to-end testing, configure a disposable SMTP inbox such as Mailpit:

```dotenv
EMAIL_PROVIDER=smtp
EMAIL_FROM=Auth Platform <no-reply@example.test>
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
```

If SMTP credentials are required, set `SMTP_USER` and `SMTP_PASSWORD`. Production non-SMTPS connections require STARTTLS.

## Authentication flow

1. Login verifies the Argon2id password and account state.
2. If MFA is active, the API returns a five-minute, purpose-bound challenge token. No session exists yet.
3. After authentication, the API returns a short-lived access token in JSON.
4. A high-entropy refresh token is stored in an HttpOnly `SameSite=Strict` cookie. Only its SHA-256 hash is stored in PostgreSQL.
5. Refresh requires an allowed `Origin`, the refresh cookie, and matching cookie/header CSRF values.
6. Every refresh rotates both tokens. Reuse of a replaced token revokes the complete token family.
7. Every protected request verifies the JWT and confirms the referenced database session and current user status/role.

The frontend must keep the access token in memory, send it as `Authorization: Bearer ...`, include credentials for refresh, read the CSRF cookie, and copy it to `X-CSRF-Token`.

## Main endpoints

| Method       | Path                           | Purpose                                   |
| ------------ | ------------------------------ | ----------------------------------------- |
| `POST`       | `/api/v1/auth/register`        | Register (always generic `202`)           |
| `POST`       | `/api/v1/auth/verify-email`    | Consume verification token                |
| `POST`       | `/api/v1/auth/login`           | Password login / create MFA challenge     |
| `POST`       | `/api/v1/auth/mfa/complete`    | Finish MFA login                          |
| `POST`       | `/api/v1/auth/refresh`         | Rotate refresh session                    |
| `GET`        | `/api/v1/auth/me`              | Current user                              |
| `POST`       | `/api/v1/auth/logout`          | Revoke current session                    |
| `POST`       | `/api/v1/auth/logout-all`      | Revoke all user sessions                  |
| `POST`       | `/api/v1/auth/change-password` | Change password and revoke sessions       |
| `POST`       | `/api/v1/auth/forgot-password` | Generic reset request                     |
| `POST`       | `/api/v1/auth/reset-password`  | Consume reset token                       |
| `PATCH`      | `/api/v1/auth/profile`         | Update display name                       |
| `PUT`        | `/api/v1/auth/email`           | Start verified email change               |
| `DELETE`     | `/api/v1/auth/account`         | Permanently delete an account             |
| `POST`       | `/api/v1/auth/magic-link/*`    | Request/consume passwordless link         |
| `GET/DELETE` | `/api/v1/sessions`             | List/revoke owned sessions                |
| `GET`        | `/api/v1/sessions/analytics`   | Login history risk summary                |
| `POST`       | `/api/v1/mfa/enroll`           | Start TOTP enrollment                     |
| `POST`       | `/api/v1/mfa/verify`           | Activate TOTP and receive recovery codes  |
| `GET/POST`   | `/api/v1/mfa/status`           | MFA status/recovery-code management       |
| `DELETE`     | `/api/v1/mfa/disable`          | Disable MFA with password + second factor |
| `GET`        | `/api/v1/oauth/{provider}/*`   | Google/GitHub OAuth flow                  |
| `GET/POST`   | `/api/v1/webauthn/*`           | Passkey enrollment/login/management       |
| `GET/PATCH`  | `/api/v1/admin/users`          | Admin user management                     |
| `GET`        | `/api/v1/admin/audit-logs`     | Paginated security audit log              |

See the OpenAPI file for full request/response contracts.

## Commands

```bash
npm run dev                 # watch-mode API
npm run build               # compile to dist/
npm start                   # run compiled API
npm run typecheck
npm run lint
npm run format:check
npm test                    # unit tests
npm run test:integration    # isolated real-PostgreSQL API tests
npm run test:coverage
npm run db:migrate
npm run db:status
npm run db:seed-admin
npm run audit:dependencies
```

Integration tests create and remove only `tmp/integration-postgres` inside this project. They never read `DATABASE_URL` and cannot target a production database.

## Create the first administrator

Run migrations first. The seed refuses to run unless explicitly confirmed and never promotes an existing user:

```powershell
$env:CONFIRM_ADMIN_SEED='true'
$env:ADMIN_EMAIL='admin@example.com'
$env:ADMIN_PASSWORD='replace-with-a-unique-strong-password'
$env:ADMIN_DISPLAY_NAME='Administrator'
npm run db:seed-admin
```

Remove these shell variables afterward. The password is never printed.

## Production database privilege split

Run migrations with an owner/migrator URL. Run the API with a separate `auth_app` role. A starting grant plan is documented in [`docs/DATABASE.md`](docs/DATABASE.md). Confirm grants in staging because the application needs table-specific read/write permissions while `audit_logs` should remain append-only.

## Documentation

- [সম্পূর্ণ বাংলা setup sequence](docs/BANGLA_SETUP_GUIDE.md)
- [শূন্য থেকে নিজের হাতে rebuild করার বাংলা guide](docs/PRACTICE_REBUILD_GUIDE_BN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Database and migrations](docs/DATABASE.md)
- [Production checklist](docs/PRODUCTION_CHECKLIST.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [বাংলা শেখার রোডম্যাপ](docs/LEARNING_ROADMAP.md)

## Troubleshooting

- **Environment validation fails:** compare `.env` with `.env.example`; blank placeholders are not valid secrets.
- **Database startup fails:** verify the host/port, role password, TLS mode, and `CONNECT` permission.
- **Migration checksum error:** never edit an applied migration. Add a new numbered migration.
- **Refresh returns 403:** send the exact configured `Origin`, both cookies, and `X-CSRF-Token` equal to the CSRF cookie.
- **Email does not arrive:** `EMAIL_PROVIDER=none` intentionally sends nothing. Check SMTP and provider logs without exposing tokens.
- **Secure cookie is absent locally:** use `COOKIE_SECURE=false` only for local HTTP; production validation requires HTTPS and secure cookies.
- **Behind a proxy:** set `TRUST_PROXY` to the exact topology so IP-based controls cannot be spoofed.
