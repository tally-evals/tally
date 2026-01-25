# Configuration

## Supported Formats (Priority Order)

1. `tally.config.ts` — TypeScript (recommended)
2. `tally.config.js` — JavaScript ESM
3. `tally.config.mjs` — JavaScript ESM explicit
4. `tally.config.cjs` — JavaScript CommonJS

## Configuration Schema

```typescript
interface TallyConfig {
  storage: {
    backend: 'local' | 's2' | 'redis';
    path?: string;
    autoCreate?: boolean;
    s2?: { basin: string; accessToken: string };
    redis?: { url: string; keyPrefix?: string; streamMaxLen?: number };
  };
  defaults?: { model?: string; temperature?: number; maxRetries?: number };
  trajectories?: { maxTurns?: number; generateLogs?: boolean };
  evaluation?: { parallelism?: number; timeout?: number };
}
```

## Example Configuration

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 'local',
  },
  defaults: {
    model: 'google:gemini-2.5-flash',
    temperature: 0,
  },
});
```

## Storage Backend Options

### Local Storage (Default)

```typescript
export default defineConfig({
  storage: {
    backend: 'local',
    path: '.tally',      // Relative to project root
    autoCreate: true,    // Create directory if missing
  },
});
```

### S2 Cloud Storage

```typescript
export default defineConfig({
  storage: {
    backend: 's2',
    s2: {
      basin: 'my-basin',
      accessToken: process.env.S2_ACCESS_TOKEN!,
    },
  },
});
```

### Redis Streams

```typescript
export default defineConfig({
  storage: {
    backend: 'redis',
    redis: {
      url: 'redis://localhost:6379',
      keyPrefix: 'tally:',
      streamMaxLen: 10000,
    },
  },
});
```

## Configuration Resolution

The config system searches for configuration files in order:

1. Check current directory for `tally.config.{ts,js,mjs,cjs}`
2. Walk up parent directories until one is found
3. Fall back to `DEFAULT_CONFIG` if none found

```typescript
import { resolveConfig, detectConfigFile } from '@tally-evals/core';

// Auto-detect and load config
const config = await resolveConfig({ cwd: process.cwd() });

// Just find config file path
const configPath = await detectConfigFile({ cwd: process.cwd() });
```

## Environment Variables

Common environment variables used in configuration:

| Variable | Purpose |
|----------|---------|
| `S2_ACCESS_TOKEN` | S2 cloud storage authentication |
| `REDIS_URL` | Redis connection string |
| `TALLY_STORAGE_PATH` | Override default storage path |

## Default Configuration

When no config file is found, these defaults apply:

```typescript
const DEFAULT_CONFIG: TallyConfig = {
  storage: {
    backend: 'local',
    path: '.tally',
    autoCreate: true,
  },
  defaults: {
    temperature: 0,
    maxRetries: 3,
  },
  trajectories: {
    maxTurns: 50,
    generateLogs: false,
  },
  evaluation: {
    parallelism: 4,
    timeout: 30000,
  },
};
```
