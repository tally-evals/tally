import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  clearConfigCache,
  defineConfig,
  mergeConfig,
  validateConfig,
} from '../../src/config';

describe('defineConfig', () => {
  it('returns validated config input (not merged with defaults)', () => {
    const config = defineConfig({
      storage: { backend: 'local', path: '/custom/path' },
    });

    // defineConfig returns the validated input, not merged with defaults
    expect(config.storage?.backend).toBe('local');
    expect(config.storage?.path).toBe('/custom/path');
  });

  it('throws on invalid storage backend', () => {
    expect(() =>
      defineConfig({
        storage: { backend: 'invalid-backend' as 'local' },
      })
    ).toThrow();
  });
});

describe('mergeConfig', () => {
  it('merges user config with defaults', () => {
    const merged = mergeConfig({
      defaults: { model: 'gpt-4' },
    });

    expect(merged.defaults.model).toBe('gpt-4');
    expect(merged.storage.backend).toBe(DEFAULT_CONFIG.storage.backend);
  });

  it('nested objects merge correctly (storage.s2)', () => {
    const merged = mergeConfig({
      storage: {
        backend: 's2',
        s2: { basin: 'my-basin', accessToken: 'token123' },
      },
    });

    expect(merged.storage.backend).toBe('s2');
    expect(merged.storage.s2.basin).toBe('my-basin');
    expect(merged.storage.s2.accessToken).toBe('token123');
  });

  it('returns DEFAULT_CONFIG when no user config provided', () => {
    const merged = mergeConfig(undefined);
    expect(merged).toEqual(DEFAULT_CONFIG);
  });
});

describe('validateConfig', () => {
  it('validates DEFAULT_CONFIG successfully', () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  it('returns error for invalid storage backend', () => {
    const invalidConfig = {
      ...DEFAULT_CONFIG,
      storage: { ...DEFAULT_CONFIG.storage, backend: 'invalid' as const },
    };
    const result = validateConfig(invalidConfig);
    expect(result.success).toBe(false);
  });
});

describe('clearConfigCache', () => {
  beforeEach(() => clearConfigCache());
  afterEach(() => clearConfigCache());

  it('does not throw', () => {
    expect(() => clearConfigCache()).not.toThrow();
  });
});
