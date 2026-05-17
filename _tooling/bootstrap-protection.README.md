# bootstrap-protection.sh

Idempotent helper that applies the standard branch protection ruleset to the
`main` branch of an `octopus-synapse` repository.

## Usage

```bash
./bootstrap-protection.sh octopus-synapse/profile-services
```

Dry-run (prints the JSON body without calling the API):

```bash
./bootstrap-protection.sh --dry-run octopus-synapse/profile-services
```

## Prerequisites

- `gh` CLI installed and authenticated as an **org admin**:

  ```bash
  gh auth login
  gh auth status   # must succeed
  ```

- The repo must already have a `main` branch.
- A status check named `ci` should be configured (the protection requires it).

## Rules applied

| Rule                                | Value                       |
| ----------------------------------- | --------------------------- |
| Required status checks              | `["ci"]`, strict (up-to-date) |
| Required PR review                  | 1 approver, dismiss stale   |
| Required linear history             | yes                         |
| Required conversation resolution    | yes                         |
| Enforce on admins                   | yes                         |
| Allow force pushes                  | no                          |
| Allow deletions                     | no                          |

## Rollout

Apply to the three core repos after the W3 hardening PRs are merged:

```bash
./bootstrap-protection.sh octopus-synapse/profile-services
./bootstrap-protection.sh octopus-synapse/patch-careers-ui
./bootstrap-protection.sh octopus-synapse/octopus-workflows
```

Each call is a single `PUT repos/{owner}/{repo}/branches/main/protection`, so
re-running is safe (overwrites with the same desired state).
