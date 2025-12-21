# Octopus Workflows

Centralized, reusable GitHub Actions workflows for all projects.

## Philosophy

**Single Responsibility**: Each workflow does ONE thing well.
**DRY**: Write once, use everywhere.
**Configuration over Code**: Projects configure, workflows execute.

## Structure

```
octopus-workflows/
└── .github/workflows/
    ├── ci.yml       # Quality + Tests + Build
    ├── cd.yml       # Deploy to VM
    └── rollback.yml # Rollback deployment
```

## Usage

### 1. CI Pipeline

```yaml
jobs:
  ci:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
      has-database: false
      has-redis: false
      build-output-dir: "dist"
```

### 2. CD Pipeline

```yaml
jobs:
  deploy:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "my-service"
      service-port: "3000"
      deploy-path: "/opt/my-service"
      has-database: false
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        PORT=3000
        API_KEY=${{ secrets.API_KEY }}
```

### 3. Rollback

```yaml
jobs:
  rollback:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/rollback.yml@main
    with:
      image-tag: "main-abc1234"
      service-port: "3000"
      deploy-path: "/opt/my-service"
```

## Secrets Architecture

### Two-Tier Secret System

**Tier 1: Octopus Secrets** (Infrastructure - configured once)
- Stored in `octopus-workflows` repository environment: `production`
- Prefix: `OCTOPUS_*`
- Used by ALL projects automatically
- Examples: `OCTOPUS_VM_HOST`, `OCTOPUS_VM_USER`, `OCTOPUS_VM_SSH_PRIVATE_KEY`

**Tier 2: Project Secrets** (Application - per project)
- Stored in each project repository
- No prefix needed
- Passed explicitly in workflows
- Examples: `POSTGRES_PASSWORD`, `JWT_SECRET`, `NEXTAUTH_SECRET`

### How It Works

```yaml
# In your project workflow
jobs:
  deploy:
    uses: your-org/octopus-workflows/.github/workflows/cd.yml@main
    secrets:
      # Octopus secrets (OCTOPUS_VM_*) inherited automatically ✅
      # Only pass project-specific secrets below
      ENV_VARS: |
        DATABASE_URL=${{ secrets.DATABASE_URL }}
        JWT_SECRET=${{ secrets.JWT_SECRET }}
```

The octopus workflow runs in the `production` environment, which has access to `OCTOPUS_*` secrets.
Your project only needs to provide application-specific secrets via `ENV_VARS`.

## Setup

### 1. Configure Octopus Environment (Once)

In `octopus-workflows` repository:

1. Go to **Settings → Environments**
2. Create environment: `production`
3. Add infrastructure secrets (with `OCTOPUS_` prefix):
   - `OCTOPUS_VM_SSH_PRIVATE_KEY` - SSH private key for deployment
   - `OCTOPUS_VM_HOST` - VM hostname or IP address
   - `OCTOPUS_VM_USER` - SSH username for VM access

### 2. Configure Project Secrets (Per Project)

In your project repository, add only application-specific secrets:

```
# Backend example
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB
REDIS_PASSWORD
JWT_SECRET
SENDGRID_API_KEY

# Frontend example
NEXT_PUBLIC_API_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
```

**Note:** NO need to configure `VM_HOST`, `VM_USER`, or `VM_SSH_PRIVATE_KEY` in project repositories!
These are inherited from octopus automatically.

## Workflows

### CI - Continuous Integration

**What it does:**
1. Code quality (lint + typecheck)
2. Run tests (with DB/Redis if needed)
3. Build application
4. Verify Docker build (on PRs)

**Inputs:**
- `node-version` - Node.js version (default: "20")
- `has-database` - Spin up PostgreSQL (default: false)
- `has-redis` - Spin up Redis (default: false)
- `build-output-dir` - Expected build output (default: "dist")

### CD - Continuous Deployment

**What it does:**
1. Build Docker image
2. Push to GitHub Container Registry
3. Deploy to VM via SSH
4. Run migrations (if database enabled)
5. Health check

**Inputs:**
- `service-name` - Service name (required)
- `service-port` - Service port (required)
- `deploy-path` - Deployment path on VM (required)
- `has-database` - Run migrations (default: false)

**Secrets:**
- `ENV_VARS` - Multiline environment variables (required)

### Rollback

**What it does:**
1. Pull specified image tag
2. Stop current containers
3. Start with rollback image
4. Health check

**Inputs:**
- `image-tag` - Docker image tag (required)
- `service-port` - Service port (required)
- `deploy-path` - Deployment path on VM (required)

## Examples

### Minimal Node.js Service

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [dev]

jobs:
  ci:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
```

```yaml
# .github/workflows/cd.yml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "my-service"
      service-port: "3000"
      deploy-path: "/opt/my-service"
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        PORT=3000
```

### With Database

```yaml
jobs:
  ci:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/ci.yml@main
    with:
      has-database: true
      has-redis: true

  deploy:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "backend"
      service-port: "3001"
      deploy-path: "/opt/backend"
      has-database: true
    secrets:
      ENV_VARS: |
        DATABASE_URL=${{ secrets.DATABASE_URL }}
        REDIS_URL=${{ secrets.REDIS_URL }}
```

## Troubleshooting

### CI Fails
- Check lint/test locally: `npm run lint && npm test`
- Verify build output directory exists

### CD Fails
- Verify VM secrets in octopus-workflows environment
- Check SSH access: `ssh VM_USER@VM_HOST`
- Verify deploy path exists on VM

### Rollback Fails
- Verify image tag exists: Check GitHub Container Registry
- Check health endpoint responds: `curl http://VM_HOST:PORT/api/health`

## Best Practices

1. **Keep workflows minimal** - Projects should only configure, not implement
2. **Use semantic versioning** - Tag octopus-workflows releases
3. **Test changes** - Create a test project before updating all projects
4. **Document secrets** - Keep a checklist of required secrets per project type

## Contributing

This is infrastructure code. Changes affect ALL projects.

**Before changing:**
1. Discuss the change
2. Test on a single project
3. Update documentation
4. Deploy to all projects

## License

Private - Internal use only
