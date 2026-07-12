@AGENTS.md

---

# Security Rules — Mandatory

Security is a non-negotiable requirement for every change in this codebase.

Before creating, editing, refactoring, or deleting any code, Claude must consider the security impact of the change.

Claude must follow the complete security rules documented in:

- `docs/CLAUDE_SECURITY_RULES.md`

If that file does not exist, Claude must ask to create it before making security-sensitive changes.

## Minimum security behavior required in every task

For every change, Claude must check:

- authentication;
- authorization;
- ownership and tenant isolation;
- input validation;
- output escaping;
- injection risks;
- mass assignment;
- sensitive data exposure;
- secrets leakage;
- unsafe logs;
- file upload risks;
- SSRF risks;
- rate limiting for sensitive or expensive operations;
- dependency and supply-chain risks;
- secure error handling;
- tests for positive and negative security cases.

## High-risk areas

Treat the following as high-risk by default:

- authentication;
- authorization;
- session handling;
- JWT, cookies, tokens and refresh tokens;
- admin panels;
- user roles and permissions;
- payments;
- webhooks;
- uploads;
- public APIs;
- multi-tenant data;
- database queries;
- external HTTP requests;
- environment variables and secrets;
- production configuration.

## Required behavior when touching existing code

When modifying an existing module, Claude must also inspect nearby code for related security issues.

If Claude finds a vulnerability, it must:

1. explain the issue;
2. classify it as Grave, Médio or Moderado;
3. fix it when the correction is local and safe;
4. add or update regression tests;
5. document remaining risks when the fix requires a larger architectural decision.

## Security acceptance criteria

A task is not complete until Claude confirms:

- backend authorization exists where needed;
- user-controlled IDs are scoped by the authenticated user, tenant or role;
- inputs are validated with explicit schemas;
- sensitive fields are not exposed unnecessarily;
- secrets are not added to code, logs or frontend bundles;
- errors do not leak stack traces or internal details;
- new dependencies are justified;
- tests cover unauthorized access and invalid payloads where applicable.