/**
 * Helper for safely managing environment variables in tests
 */

interface EnvSnapshot {
  [key: string]: string | undefined;
}

/**
 * Saves current environment variable values
 */
export function saveEnvVars(...keys: string[]): EnvSnapshot {
  const snapshot: EnvSnapshot = {};
  for (const key of keys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

/**
 * Restores environment variables from a snapshot
 */
export function restoreEnvVars(snapshot: EnvSnapshot): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Sets environment variables temporarily and returns a cleanup function
 */
export function withEnvVars(vars: Record<string, string>): () => void {
  const snapshot = saveEnvVars(...Object.keys(vars));

  for (const [key, value] of Object.entries(vars)) {
    process.env[key] = value;
  }

  return () => restoreEnvVars(snapshot);
}

/**
 * Executes a callback with temporary environment variables
 */
export async function runWithEnvVars<T>(
  vars: Record<string, string>,
  callback: () => Promise<T>,
): Promise<T> {
  const cleanup = withEnvVars(vars);
  try {
    return await callback();
  } finally {
    cleanup();
  }
}
