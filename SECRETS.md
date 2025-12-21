# Secrets Management Guide

Complete guide for managing secrets in the octopus-workflows system.

## Architecture Overview

### Two-Tier Secret System

```
┌─────────────────────────────────────────────────────────┐
│ Tier 1: Infrastructure Secrets (Octopus)               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│ Repository: octopus-workflows                             │
│ Environment: production                                   │
│ Prefix: OCTOPUS_*                                        │
│ Scope: ALL projects                                      │
│                                                           │
│ Secrets:                                                  │
│ • OCTOPUS_VM_HOST                                        │
│ • OCTOPUS_VM_USER                                        │
│ • OCTOPUS_VM_SSH_PRIVATE_KEY                            │
└─────────────────────────────────────────────────────────┘
                            ↓
                  (Inherited automatically)
                            ↓
┌─────────────────────────────────────────────────────────┐
│ Tier 2: Application Secrets (Projects)                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│ Repository: profile-frontend, profile-services, etc.     │
│ Environment: (repository level)                           │
│ Prefix: (none)                                           │
│ Scope: Single project                                    │
│                                                           │
│ Frontend Secrets:                                         │
│ • NEXT_PUBLIC_API_URL                                    │
│ • NEXTAUTH_URL                                           │
│ • NEXTAUTH_SECRET                                        │
│                                                           │
│ Backend Secrets:                                          │
│ • POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB         │
│ • REDIS_PASSWORD                                         │
│ • JWT_SECRET                                             │
│ • SENDGRID_API_KEY, SENDGRID_EMAIL_FROM                 │
│ • MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY    │
└─────────────────────────────────────────────────────────┘
```

## Best Practices

### 1. Naming Conventions

#### Infrastructure Secrets (Octopus)
- **Always** use `OCTOPUS_` prefix
- Use `SCREAMING_SNAKE_CASE`
- Be descriptive
- Examples:
  - ✅ `OCTOPUS_VM_HOST`
  - ✅ `OCTOPUS_VM_USER`
  - ✅ `OCTOPUS_VM_SSH_PRIVATE_KEY`
  - ❌ `VM_HOST` (missing prefix)
  - ❌ `octopus_vm_host` (wrong case)

#### Application Secrets (Projects)
- **Never** use `OCTOPUS_` prefix (reserved for infrastructure)
- Use `SCREAMING_SNAKE_CASE`
- Be descriptive
- Examples:
  - ✅ `POSTGRES_PASSWORD`
  - ✅ `JWT_SECRET`
  - ✅ `NEXT_PUBLIC_API_URL`
  - ❌ `OCTOPUS_JWT_SECRET` (wrong prefix)
  - ❌ `db_password` (wrong case)

### 2. Secret Scope

#### Infrastructure = Octopus
If a secret is needed by:
- ❓ Multiple projects? → Octopus
- ❓ Infrastructure (VM, network, SSH)? → Octopus
- ❓ Deployment tooling? → Octopus

Examples:
- VM SSH credentials → Octopus
- Docker registry credentials → Octopus (if shared)
- Monitoring API keys → Octopus (if centralized)

#### Application = Project
If a secret is:
- ❓ Specific to one application? → Project
- ❓ Business logic related? → Project
- ❓ External service API? → Project

Examples:
- Database credentials → Project
- JWT signing key → Project
- Stripe API key → Project
- SendGrid API key → Project

### 3. Secret Rotation

#### Octopus Secrets
When rotating infrastructure secrets:

1. **Generate new secret**
   ```bash
   ssh-keygen -t ed25519 -C "deploy-new" -f ~/.ssh/deploy_new
   ```

2. **Add to VM** (don't remove old yet!)
   ```bash
   cat ~/.ssh/deploy_new.pub >> ~/.ssh/authorized_keys
   ```

3. **Update octopus-workflows environment**
   - Settings → Environments → production
   - Update `OCTOPUS_VM_SSH_PRIVATE_KEY`

4. **Test deployment**
   - Run a test deployment
   - Verify success

5. **Remove old key from VM**
   ```bash
   # Remove old key from authorized_keys
   ```

#### Project Secrets
When rotating application secrets:

1. **Generate new secret**
   ```bash
   openssl rand -base64 32
   ```

2. **Update project repository**
   - Settings → Secrets → Actions
   - Update the secret

3. **Deploy**
   - Push to main or run manual deploy
   - Application uses new secret

4. **Verify**
   - Check application functionality
   - Monitor logs

### 4. Security

#### Never Commit Secrets
- ✅ Use GitHub Secrets
- ✅ Use environment variables
- ✅ Use `.env` files (in `.gitignore`)
- ❌ Never hardcode in code
- ❌ Never commit to git
- ❌ Never log secrets

#### Secret Access
- ✅ Limit who can access octopus-workflows environment
- ✅ Use environment protection rules
- ✅ Require approvals for production deploys
- ✅ Audit secret access regularly
- ❌ Don't share secrets via chat/email
- ❌ Don't store secrets in plaintext files

#### Secret Generation
- ✅ Use cryptographically secure random generation
- ✅ Minimum 32 characters for secrets
- ✅ Mix letters, numbers, symbols
- ❌ Don't use weak passwords
- ❌ Don't reuse secrets across environments

```bash
# Good secret generation
openssl rand -base64 32
openssl rand -hex 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Bad secret generation
echo "password123"  # Too weak
date | md5sum       # Predictable
```

## Setup Checklist

### Initial Octopus Setup

- [ ] Create `octopus-workflows` repository
- [ ] Create `production` environment
- [ ] Generate SSH key pair
  ```bash
  ssh-keygen -t ed25519 -C "github-actions-deploy"
  ```
- [ ] Add public key to VM
  ```bash
  cat ~/.ssh/deploy_key.pub | ssh user@vm 'cat >> ~/.ssh/authorized_keys'
  ```
- [ ] Add secrets to octopus environment:
  - [ ] `OCTOPUS_VM_SSH_PRIVATE_KEY`
  - [ ] `OCTOPUS_VM_HOST`
  - [ ] `OCTOPUS_VM_USER`
- [ ] Test SSH access from Actions (manual workflow run)

### Per-Project Setup

#### Frontend Projects

- [ ] Generate NEXTAUTH_SECRET
  ```bash
  openssl rand -base64 32
  ```
- [ ] Add secrets to project:
  - [ ] `NEXT_PUBLIC_API_URL`
  - [ ] `NEXTAUTH_URL`
  - [ ] `NEXTAUTH_SECRET`
- [ ] Create workflows (ci.yml, cd.yml, rollback.yml)
- [ ] Test CI on pull request
- [ ] Test CD on main push

#### Backend Projects

- [ ] Generate secrets
  ```bash
  # PostgreSQL password
  openssl rand -base64 32

  # Redis password
  openssl rand -base64 32

  # JWT secret
  openssl rand -base64 32
  ```
- [ ] Add secrets to project:
  - [ ] `POSTGRES_USER`
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `POSTGRES_DB`
  - [ ] `REDIS_PASSWORD`
  - [ ] `JWT_SECRET`
  - [ ] External service keys (SendGrid, MinIO, etc.)
- [ ] Create workflows (ci.yml, cd.yml, rollback.yml)
- [ ] Test CI on pull request
- [ ] Test CD with migrations

## Troubleshooting

### "Permission denied (publickey)"

**Problem:** SSH authentication failing

**Solutions:**
1. Verify `OCTOPUS_VM_SSH_PRIVATE_KEY` format:
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   ...
   -----END OPENSSH PRIVATE KEY-----
   ```
2. Check public key is in VM's `authorized_keys`
3. Verify VM user and host are correct

### "Secret not found"

**Problem:** Workflow can't find a secret

**Solutions:**
1. Check secret name spelling (case-sensitive)
2. Verify secret exists in correct location:
   - Infrastructure → octopus-workflows environment
   - Application → project repository secrets
3. Check environment name is `production`
4. Verify workflow references correct secret

### "Cannot inherit secrets"

**Problem:** `secrets: inherit` not working

**Solutions:**
1. Ensure calling workflow has access to secrets
2. Check if specific secrets block is used (can't mix with inherit)
3. Verify repository settings allow workflow access

## FAQ

### Q: Why use OCTOPUS_ prefix?

**A:** Clear separation of concerns. When you see `OCTOPUS_*`, you know:
- It's infrastructure-related
- It's managed centrally
- You don't need to configure it per-project
- Changes affect all projects

### Q: Can I override OCTOPUS_ secrets per project?

**A:** Technically yes, but **don't**. The whole point is centralization.
If you need project-specific infrastructure, use a different approach or
create a separate octopus environment (e.g., `staging`, `dev`).

### Q: How do I add a new infrastructure secret?

**A:**
1. Add to octopus-workflows environment with `OCTOPUS_` prefix
2. Reference in workflow: `${{ secrets.OCTOPUS_NEW_SECRET }}`
3. All projects automatically have access
4. Document in this file

### Q: What if I need different VM per project?

**A:** Create multiple environments in octopus-workflows:
- `production` (VM 1)
- `production-eu` (VM 2)
- `production-us` (VM 3)

Then specify environment in project workflow:
```yaml
jobs:
  deploy:
    uses: org/octopus-workflows/.github/workflows/cd.yml@main
    with:
      environment-name: "production-eu"  # Uses VM 2
```

### Q: How do I test secret changes safely?

**A:**
1. Create `staging` environment in octopus
2. Use test VM with test secrets
3. Point a test project to staging
4. Verify everything works
5. Apply to production

## Migration Guide

### From Individual Workflows to Octopus

#### Before (per-project secrets)
```yaml
# In profile-frontend repository
secrets:
  VM_HOST: 192.168.1.100
  VM_USER: deploy
  VM_SSH_PRIVATE_KEY: -----BEGIN...
  NEXTAUTH_SECRET: abc123...
```

#### After (octopus + project)
```yaml
# In octopus-workflows environment "production"
OCTOPUS_VM_HOST: 192.168.1.100
OCTOPUS_VM_USER: deploy
OCTOPUS_VM_SSH_PRIVATE_KEY: -----BEGIN...

# In profile-frontend repository
NEXTAUTH_SECRET: abc123...
```

#### Migration Steps

1. **Setup octopus** (one-time)
   - Create repository
   - Configure environment
   - Add infrastructure secrets with prefix

2. **Per project**
   - Remove `VM_*` secrets from project
   - Keep application secrets in project
   - Update workflows to use octopus

3. **Verify**
   - Test deployment
   - Check logs
   - Rollback if issues

## Security Checklist

- [ ] All secrets use strong, random generation
- [ ] No secrets in git history
- [ ] No secrets in logs or error messages
- [ ] Secrets rotated every 90 days
- [ ] Limited access to octopus environment
- [ ] Environment protection rules enabled
- [ ] Approvals required for production
- [ ] Audit logs reviewed monthly
- [ ] Secrets documented (what they are, not values!)
- [ ] Backup plan for secret recovery
- [ ] Incident response plan for leaked secrets

---

**Remember:** Security is a practice, not a product. Stay vigilant! 🔒
