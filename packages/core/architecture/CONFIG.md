# Configuration Architecture

## Overview

Core provides centralized configuration management using TypeScript config files (`tally.config.ts` or `tally.config.js`). This approach offers:

- **Type Safety** — Full TypeScript support with autocompletion
- **Dynamic Values** — Access to environment variables and runtime logic
- **Code Reuse** — Import shared configurations
- **Validation** — Runtime validation with Zod schemas

---

## Configuration Files

### Supported Formats (Priority Order)

1. `tally.config.ts` — TypeScript (recommended)
2. `tally.config.js` — JavaScript ESM
3. `tally.config.mjs` — JavaScript ESM explicit
4. `tally.config.cjs` — JavaScript CommonJS

### Config File Location

Resolution walks up from `cwd` looking for config files:

```
/home/user/project/
├── tally.config.ts     ← Found first
├── .tally/             ← Storage folder
└── src/
    └── tests/          ← cwd
```

---

## defineConfig Helper

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  // Configuration options
});
```

The `defineConfig` function provides:
- Type inference for all options
- Validation at load time
- Default value merging

---

## Configuration Schema

```typescript
interface TallyConfig {
  /** Storage configuration */
  storage: {
    /** Storage backend */
    backend: 'local' | 's2' | 'redis';
    
    /** Path to .tally folder (local backend) */
    path?: string;
    
    /** Auto-create folders on write */
    autoCreate?: boolean;
    
    /** S2 configuration */
    s2?: {
      basin: string;
      accessToken: string;
    };
    
    /** Redis configuration */
    redis?: {
      url: string;
      keyPrefix?: string;
      streamMaxLen?: number;
    };
  };
  
  /** Default LLM settings */
  defaults?: {
    model?: string;
    temperature?: number;
    maxRetries?: number;
  };
  
  /** Trajectory execution defaults */
  trajectories?: {
    maxTurns?: number;
    generateLogs?: boolean;
    loopDetection?: {
      maxConsecutiveSameStep?: number;
    };
  };
  
  /** Evaluation settings */
  evaluation?: {
    parallelism?: number;
    timeout?: number;
  };
}
```

---

## Example Configurations

### Minimal (Local Development)

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 'local',
  },
});
```

### S2 Cloud Storage

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 's2',
    s2: {
      basin: 'my-tally-basin',
      accessToken: process.env.S2_ACCESS_TOKEN!,
    },
  },
  defaults: {
    model: 'google:gemini-2.5-flash',
    temperature: 0,
  },
});
```

### Redis Streams

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

export default defineConfig({
  storage: {
    backend: 'redis',
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: 'tally:',
      streamMaxLen: 10000,
    },
  },
  trajectories: {
    maxTurns: 15,
    generateLogs: true,
  },
});
```

### Multi-Environment

```typescript
// tally.config.ts
import { defineConfig } from '@tally-evals/core';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  storage: isProduction
    ? {
        backend: 's2',
        s2: {
          basin: 'prod-tally',
          accessToken: process.env.S2_ACCESS_TOKEN!,
        },
      }
    : {
        backend: 'local',
        path: '.tally',
      },
  defaults: {
    temperature: isProduction ? 0 : 0.7,
  },
});
```

---

## Configuration Resolution

### API

```typescript
import { resolveConfig, getConfig } from '@tally-evals/core';

// Full resolution (reads file, applies defaults)
const config = await resolveConfig();

// With overrides
const config = await resolveConfig({
  cwd: '/path/to/project',
  overrides: {
    storage: { backend: 'local' },
  },
});

// Cached access (after initial resolution)
const config = await getConfig();
```

### Resolution Order

1. **Default values** — Built-in defaults
2. **Config file** — `tally.config.ts` values
3. **Environment variables** — `TALLY_*` prefix
4. **Runtime overrides** — Programmatic overrides

---

## Environment Variables

Environment variables override config file values:

| Variable | Config Path | Example |
|----------|-------------|---------|
| `TALLY_STORAGE_BACKEND` | `storage.backend` | `s2` |
| `TALLY_STORAGE_PATH` | `storage.path` | `.tally-dev` |
| `TALLY_S2_BASIN` | `storage.s2.basin` | `my-basin` |
| `TALLY_S2_ACCESS_TOKEN` | `storage.s2.accessToken` | `s2_...` |
| `TALLY_REDIS_URL` | `storage.redis.url` | `redis://...` |
| `TALLY_DEFAULT_MODEL` | `defaults.model` | `openai:gpt-4` |

---

## Folder Detection

If no config file is found, core looks for `.tally/` folder:

```typescript
function scanTallyDirectory(startPath: string): string {
  // Walk up from startPath looking for .tally/conversations/
  // If not found, create at cwd
}
```

This enables zero-config usage while still respecting explicit configuration.

---

## TypeScript Config Loading

Config files are loaded using dynamic import with TypeScript support:

```typescript
async function loadConfigFile(configPath: string): Promise<TallyConfig> {
  // For .ts files, use tsx/esbuild-register for transpilation
  // For .js files, use dynamic import directly
  const module = await import(configPath);
  return module.default;
}
```

This requires Node.js 18+ with ESM support or a TypeScript loader.
