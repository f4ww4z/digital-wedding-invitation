# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) on this repository, or email the
maintainer listed on the GitHub profile. Include steps to reproduce, the affected version or
commit, and the impact you observed. You should get a reply within a week.

## Scope

In scope: the API, the web app, the admin dashboard, the Dockerfile and `compose.yml`.
Out of scope: your reverse proxy / TLS setup, and denial of service by sheer traffic volume.

## Operator checklist

- Serve the site over HTTPS and keep `COOKIE_SECURE=true`.
- Set a unique `SESSION_SECRET` and admin password (the examples are refused in production).
- Set `TRUST_PROXY` to the real number of proxies in front of the stack.
- Keep `.env` and backups private: the database contains guest names, phone numbers and messages.
- Update regularly: `git pull && docker compose up -d --build`.
