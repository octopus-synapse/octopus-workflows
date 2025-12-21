# Examples

Real-world examples of using octopus-workflows.

## Example 1: Simple Node.js API

**Service**: REST API with no database
**Port**: 3000
**Path**: `/opt/simple-api`

### CI Workflow
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [dev]

jobs:
  ci:
    uses: efpatti/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
```

### CD Workflow
```yaml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    uses: efpatti/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "simple-api"
      service-port: "3000"
      deploy-path: "/opt/simple-api"
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        PORT=3000
        API_KEY=${{ secrets.API_KEY }}
```

### Secrets to Configure
```
API_KEY = <your-api-key>
```

---

## Example 2: Next.js Frontend

**Service**: Next.js with server-side rendering
**Port**: 3000
**Path**: `/opt/profile-frontend`

### CI Workflow
```yaml
name: CI
on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [dev]

jobs:
  ci:
    uses: efpatti/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
      build-output-dir: ".next"
```

### CD Workflow
```yaml
name: CD
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    uses: efpatti/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "profile-frontend"
      service-port: "3000"
      deploy-path: "/opt/profile-frontend"
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        FRONTEND_PORT=3000
        NEXT_PUBLIC_API_URL=${{ secrets.NEXT_PUBLIC_API_URL }}
        NEXTAUTH_URL=${{ secrets.NEXTAUTH_URL }}
        NEXTAUTH_SECRET=${{ secrets.NEXTAUTH_SECRET }}
```

### Secrets to Configure
```
NEXT_PUBLIC_API_URL = http://YOUR_VM:3001
NEXTAUTH_URL = http://YOUR_VM:3000
NEXTAUTH_SECRET = <generate-with-openssl>
```

---

## Example 3: NestJS Backend with Database

**Service**: NestJS API with PostgreSQL and Redis
**Port**: 3001
**Path**: `/opt/profile-services`

### CI Workflow
```yaml
name: CI
on:
  pull_request:
    branches: [main, dev]
  push:
    branches: [dev]

jobs:
  ci:
    uses: efpatti/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
      has-database: true
      has-redis: true
```

### CD Workflow
```yaml
name: CD
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    uses: efpatti/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "profile-backend"
      service-port: "3001"
      deploy-path: "/opt/profile-services"
      has-database: true
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        BACKEND_PORT=3001
        POSTGRES_USER=${{ secrets.POSTGRES_USER }}
        POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
        POSTGRES_DB=${{ secrets.POSTGRES_DB }}
        DATABASE_URL=postgresql://${{ secrets.POSTGRES_USER }}:${{ secrets.POSTGRES_PASSWORD }}@postgres:5432/${{ secrets.POSTGRES_DB }}
        REDIS_HOST=redis
        REDIS_PORT=6379
        REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }}
        JWT_SECRET=${{ secrets.JWT_SECRET }}
```

### Secrets to Configure
```
POSTGRES_USER = postgres
POSTGRES_PASSWORD = <strong-password>
POSTGRES_DB = profile
REDIS_PASSWORD = <strong-password>
JWT_SECRET = <generate-with-openssl>
```

---

## Example 4: Microservice with External APIs

**Service**: Payment service with Stripe
**Port**: 4000
**Path**: `/opt/payment-service`

### CI Workflow
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [dev]

jobs:
  ci:
    uses: efpatti/octopus-workflows/.github/workflows/ci.yml@main
    with:
      node-version: "20"
      has-database: true
```

### CD Workflow
```yaml
name: CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    uses: efpatti/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "payment-service"
      service-port: "4000"
      deploy-path: "/opt/payment-service"
      has-database: true
    secrets:
      ENV_VARS: |
        NODE_ENV=production
        PORT=4000
        DATABASE_URL=${{ secrets.DATABASE_URL }}
        STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}
        STRIPE_WEBHOOK_SECRET=${{ secrets.STRIPE_WEBHOOK_SECRET }}
        SENTRY_DSN=${{ secrets.SENTRY_DSN }}
```

### Secrets to Configure
```
DATABASE_URL = postgresql://...
STRIPE_SECRET_KEY = sk_live_...
STRIPE_WEBHOOK_SECRET = whsec_...
SENTRY_DSN = https://...@sentry.io/...
```

---

## Rollback Template

Use this for ALL projects:

```yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      image_tag:
        description: "Image tag (e.g., main-abc1234)"
        required: true
        type: string

jobs:
  rollback:
    uses: efpatti/octopus-workflows/.github/workflows/rollback.yml@main
    with:
      image-tag: ${{ inputs.image_tag }}
      service-port: "YOUR_PORT"
      deploy-path: "/opt/YOUR_SERVICE"
```

---

## Finding Image Tags

### Via GitHub CLI
```bash
gh api repos/YOUR_USERNAME/YOUR_REPO/packages
```

### Via GitHub UI
1. Go to repository
2. Click **Packages** (right sidebar)
3. Click your package
4. Copy the tag (e.g., `main-1a2b3c4`)

### Via Docker
```bash
# On VM
docker images | grep YOUR_SERVICE
```

---

## Common Patterns

### Multiple Environments

Create different workflows for staging:

```yaml
# cd-staging.yml
name: CD Staging
on:
  push:
    branches: [develop]

jobs:
  deploy:
    uses: efpatti/octopus-workflows/.github/workflows/cd.yml@main
    with:
      service-name: "my-service-staging"
      service-port: "3000"
      deploy-path: "/opt/staging/my-service"
    secrets:
      ENV_VARS: |
        NODE_ENV=staging
        # ... staging-specific vars
```

### Scheduled Deployments

```yaml
on:
  schedule:
    - cron: '0 2 * * 1'  # Every Monday at 2 AM
  workflow_dispatch:
```

### Manual Approval

Add environment protection rules in GitHub:
1. Settings → Environments → production
2. Add required reviewers
3. CD will wait for approval

---

## Full Project Setup

### 1. Create Project Files

```
my-project/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd.yml
│       └── rollback.yml
├── Dockerfile
├── docker-compose.yml
├── src/
│   └── app/
│       └── api/
│           └── health/
│               └── route.ts
└── package.json
```

### 2. Health Endpoint

**Required** for all services:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
```

### 3. Dockerfile

Must use `standalone` output for Next.js:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### 4. docker-compose.yml

```yaml
version: "3.8"
services:
  app:
    image: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG:-latest}
    container_name: my-service
    restart: unless-stopped
    ports:
      - "3000:3000"
    networks:
      - profile-network

networks:
  profile-network:
    external: true
```

Now you're ready to deploy! 🚀
