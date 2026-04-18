# @octopus-synapse/biome-config

Canonical [Biome](https://biomejs.dev) config for Octopus Synapse repos.

## Usage

1. Install as devDep (GitHub Packages registry scoped to `@octopus-synapse`):

```bash
bun add -d @octopus-synapse/biome-config
```

2. At the root of your repo, create a `biome.json` that extends this one:

```json
{
  "extends": ["@octopus-synapse/biome-config/biome.json"]
}
```

3. Add per-repo overrides below the `extends` if needed. Example for a Svelte monorepo:

```json
{
  "extends": ["@octopus-synapse/biome-config/biome.json"],
  "overrides": [
    { "includes": ["**/*.svelte"], "linter": { "enabled": false } }
  ]
}
```

## What's in the base config

- Indent: 2 spaces, line width 100, single quotes, always semicolons, trailing commas.
- Linter: recommended + stricter `noExplicitAny`, `noDoubleEquals`, `noUnusedImports`, `noUnusedVariables`.
- VCS-aware ignores (`node_modules`, `dist`, `.svelte-kit`, `build`, `coverage`, `generated/`).
- Organize imports on save.
