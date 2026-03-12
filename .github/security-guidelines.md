# Security Guidelines (OWASP-based)

**Purpose:** Prevent security vulnerabilities in this codebase. Based on OWASP Top 10 best practices.

**Primary Directive:** All code must be secure by default. When in doubt, choose the more secure option and explain reasoning.

---

## OWASP Top 10 Guidelines

### A01: Broken Access Control & A10: SSRF

**Principle of Least Privilege:**
- Default to most restrictive permissions
- Explicitly check user rights against required permissions
- Follow "deny by default" pattern

**SSRF Prevention:**
- Treat all user-provided URLs as untrusted
- Use strict allow-list validation for host, port, path
- Never fetch arbitrary URLs without validation

**Path Traversal:**
- Sanitize file paths from user input
- Prevent directory traversal (`../../etc/passwd`)
- Use secure path-building APIs

### A02: Cryptographic Failures

**Strong Algorithms:**
- Use Argon2 or bcrypt for password hashing
- Never use MD5 or SHA-1 for security
- AES-256 for encryption at rest

**Data in Transit:**
- Always default to HTTPS
- Validate TLS certificates

**Secret Management:**
- Never hardcode secrets (API keys, passwords, connection strings)
- Read from environment variables or secrets manager
- Use `.env.example` for placeholders, never commit `.env`

### A03: Injection

**SQL Injection:**
- Always use parameterized queries (prepared statements)
- Never concatenate user input into SQL strings

**Command Injection:**
- Use built-in functions with proper escaping
- Avoid shell execution with user input

**XSS Prevention:**
- Use `.textContent` (treats data as text)
- Use `.innerHTML` only with sanitization (DOMPurify)
- Context-aware output encoding

### A05: Security Misconfiguration & A06: Vulnerable Components

**Secure Configuration:**
- Disable verbose errors in production
- Disable debug features in production
- Set security headers (CSP, HSTS, X-Content-Type-Options)

**Dependency Management:**
- Use latest stable versions
- Run `npm audit` (or equivalent) regularly
- Monitor for CVEs in dependencies

### A07: Identification & Authentication Failures

**Session Management:**
- Generate new session ID on login (prevent fixation)
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Strict`
- Implement sliding expiration with a reasonable TTL

**Brute Force Protection:**
- Rate limiting on auth endpoints
- Account lockout after failed attempts

### A08: Software and Data Integrity Failures

**Insecure Deserialization:**
- Never deserialize untrusted data without validation
- Prefer JSON over Pickle/serialized objects
- Implement strict type checking

**Supply Chain:**
- Verify integrity of third-party packages (checksums, signatures)
- Pin dependency versions in production
- Review transitive dependencies for known vulnerabilities

---

## General Security Guidelines

### Be Explicit About Security

When suggesting code that mitigates a security risk, state what you're protecting against.

### Security Checklist for New Code

Before merging, verify:
- [ ] No hardcoded secrets
- [ ] User input is validated/sanitized
- [ ] SQL uses prepared statements
- [ ] Auth checks are present for protected endpoints
- [ ] Error messages don't leak sensitive info
- [ ] Dependencies are up-to-date
- [ ] Security headers are set
