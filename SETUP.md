# Setup Guide

Quick setup guide for octopus-workflows.

## 1. Setup Octopus Repository

### Create Repository

```bash
gh repo create octopus-workflows --public
cd octopus-workflows
git init
git remote add origin git@github.com:YOUR_USERNAME/octopus-workflows.git
```

### Create Workflows

Copy the `.github/workflows` directory to this repository.

```bash
git add .
git commit -m "Initial commit: Reusable workflows"
git push -u origin main
```

### Configure Environment

1. Go to **Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Click **Configure environment**
5. Add **OCTOPUS** secrets (infrastructure secrets used by ALL projects):

```
OCTOPUS_VM_SSH_PRIVATE_KEY = <your-ssh-private-key>
OCTOPUS_VM_HOST = <your-vm-ip>
OCTOPUS_VM_USER = <your-ssh-username>
```

**Important:** Use the `OCTOPUS_` prefix! This differentiates infrastructure secrets from project-specific secrets.

#### Generate SSH Key

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key
cat ~/.ssh/deploy_key      # This is VM_SSH_PRIVATE_KEY
cat ~/.ssh/deploy_key.pub  # Add this to VM's authorized_keys
```

#### Add Key to VM

```bash
ssh VM_USER@VM_HOST
mkdir -p ~/.ssh
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 2. Setup VM

### Install Docker

```bash
# Alpine Linux
apk add docker docker-compose
rc-update add docker boot
service docker start
```

### Create Docker Network

```bash
docker network create profile-network
```

### Create Deployment Directories

```bash
mkdir -p /opt/profile-frontend
mkdir -p /opt/profile-services
```

### Verify Connectivity

```bash
# From your local machine
ssh -i ~/.ssh/deploy_key VM_USER@VM_HOST "docker --version"
```

## 3. Setup Project

### Create Workflows

In your project (e.g., `profile-frontend`):

```bash
mkdir -p .github/workflows
```

Create `ci.yml`:
```yaml
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

Create `cd.yml`:
```yaml
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

Create `rollback.yml`:
```yaml
name: Rollback
on:
  workflow_dispatch:
    inputs:
      image_tag:
        required: true
        type: string

jobs:
  rollback:
    uses: YOUR_USERNAME/octopus-workflows/.github/workflows/rollback.yml@main
    with:
      image-tag: ${{ inputs.image_tag }}
      service-port: "3000"
      deploy-path: "/opt/my-service"
```

### Configure Secrets

In your project repository (**not** octopus-workflows):

1. Go to **Settings → Secrets → Actions**
2. Add project-specific secrets

**Frontend example:**
```
NEXT_PUBLIC_API_URL = http://YOUR_VM_IP:3001
NEXTAUTH_URL = http://YOUR_VM_IP:3000
NEXTAUTH_SECRET = <generate with: openssl rand -base64 32>
```

**Backend example:**
```
POSTGRES_USER = postgres
POSTGRES_PASSWORD = <strong-password>
POSTGRES_DB = profile
REDIS_PASSWORD = <strong-password>
JWT_SECRET = <generate with: openssl rand -base64 32>
SENDGRID_API_KEY = <your-key>
SENDGRID_EMAIL_FROM = noreply@yourdomain.com
MINIO_ENDPOINT = http://minio:9000
MINIO_ACCESS_KEY = <your-key>
MINIO_SECRET_KEY = <your-secret>
MINIO_BUCKET = profile
```

## 4. Verify Setup

### Test CI

```bash
git checkout -b test-ci
git commit --allow-empty -m "Test CI"
git push origin test-ci
gh pr create --title "Test CI" --body "Testing CI pipeline"
```

Check **Actions** tab for CI results.

### Test CD

```bash
git checkout main
git commit --allow-empty -m "Test CD"
git push origin main
```

Check **Actions** tab for CD results.

### Test Health

```bash
curl http://VM_HOST:SERVICE_PORT/api/health
```

### Test Rollback

1. Go to **Actions → Rollback**
2. Click **Run workflow**
3. Enter image tag (e.g., `main-abc1234`)
4. Click **Run workflow**

## 5. Checklist

### Octopus Repository
- [ ] Repository created
- [ ] Workflows committed
- [ ] Environment `production` created
- [ ] Secret `VM_SSH_PRIVATE_KEY` added
- [ ] Secret `VM_HOST` added
- [ ] Secret `VM_USER` added

### VM
- [ ] Docker installed
- [ ] Network `profile-network` created
- [ ] Deployment directories created
- [ ] SSH key added to `authorized_keys`
- [ ] SSH access verified

### Project
- [ ] Workflows created (`ci.yml`, `cd.yml`, `rollback.yml`)
- [ ] Project secrets configured
- [ ] Docker files present (`Dockerfile`, `docker-compose.yml`)
- [ ] Health endpoint exists (`/api/health`)
- [ ] CI passing
- [ ] CD successful
- [ ] Service healthy

## Troubleshooting

### SSH Permission Denied
```bash
# Verify key format
cat ~/.ssh/deploy_key  # Should start with "-----BEGIN OPENSSH PRIVATE KEY-----"

# Verify VM has public key
ssh VM_USER@VM_HOST "cat ~/.ssh/authorized_keys"
```

### Docker Login Failed
```bash
# Verify on VM
docker login ghcr.io -u YOUR_USERNAME
```

### Health Check Failed
```bash
# Check container logs
ssh VM_USER@VM_HOST "cd /opt/my-service && docker-compose logs"

# Check if port is open
ssh VM_USER@VM_HOST "netstat -tlnp | grep SERVICE_PORT"
```

### Image Not Found
```bash
# List available images
gh api repos/YOUR_USERNAME/YOUR_REPO/packages
```

## Next Steps

1. Add more projects using the same pattern
2. Setup staging environment (duplicate `production` → `staging`)
3. Add monitoring (health checks, alerts)
4. Setup backups (database, volumes)
