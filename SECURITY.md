# Security Policy

## Reporting a Vulnerability

Post Shit Now handles social media API keys, OAuth tokens, and database credentials. Security matters.

**Do NOT open a public issue for security vulnerabilities.**

Instead, email **enriquefft2001@gmail.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You'll receive an acknowledgment within 48 hours and a detailed response within 7 days.

## Scope

The following are in scope:

- Credential leakage (API keys, tokens, connection strings)
- Authentication/authorization bypass in RLS policies
- Command injection via slash commands or Trigger.dev tasks
- Insecure storage of secrets in git-tracked files
- Cross-hub data access (RLS bypass)

## Best Practices for Users

- Never commit `.env`, `config/keys.env`, or `config/connections/` files
- Rotate platform API keys if you suspect exposure
- Use invite codes for team onboarding — never share raw credentials
- Review the `.gitignore` before your first commit
