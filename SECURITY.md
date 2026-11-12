# Security Policy

This project is an authentication service, so security reports are handled
with priority.

## Supported versions

Only the latest commit on `main` receives security fixes. This project has not
reached a tagged, stable release yet.

## Reporting a vulnerability

**Do not open a public issue for a vulnerability.**

- Preferred: open a private report through GitHub Security Advisories:
  <https://github.com/muniralways/secure-auth-api/security/advisories/new>
- If that is unavailable, contact the maintainer directly through their GitHub
  profile: <https://github.com/muniralways>

Please include:

- a description of the issue and its impact,
- the affected endpoint, file, or commit,
- reproduction steps or a proof of concept,
- any suggested mitigation.

## What to expect

- Acknowledgement of the report within 72 hours.
- An initial assessment and severity classification within 7 days.
- A coordinated disclosure timeline agreed with you before any public write-up.

Please give the maintainer a reasonable window to release a fix before
disclosing the issue publicly.

## Scope

In scope:

- authentication and session handling (JWT, refresh rotation, cookies, CSRF),
- password hashing and MFA (Argon2id, TOTP, recovery codes, WebAuthn),
- OAuth and magic-link flows,
- authorization / RBAC,
- SQL queries and migrations,
- secret handling, logging, and personal data exposure.

Out of scope:

- findings that require a compromised host, database, or mail server,
- denial of service from unrealistic traffic volumes,
- missing security headers on the marketing/docs site,
- automated scanner output without a demonstrated impact.

## Secrets

Never commit real credentials. `.env` is ignored; commit only `.env.example`
with placeholder values. If a secret is ever committed, treat it as leaked:
rotate it first, then remove it from history.
