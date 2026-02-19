# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ClawCamp, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email **security@openclaw.ai** with details
3. Include steps to reproduce if possible

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `main` | Yes |
| Older commits | No |

## Scope

The following are in scope:
- API endpoint vulnerabilities (injection, auth bypass)
- Cross-site scripting (XSS) in the web UI
- Server-side request forgery (SSRF)
- Exposed secrets or credentials

The following are out of scope:
- Rate limiting bypass (we use basic in-memory limiting)
- Self-XSS requiring user to paste code into their own console
- Denial of service via high traffic volume
