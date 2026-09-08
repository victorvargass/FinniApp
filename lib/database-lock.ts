let operationTail: Promise<void> = Promise.resolve();

/**
 * Serializes operations that need exclusive access to the physical database.
 * The queue always recovers after a rejected operation, while each caller still
 * receives the original result or error.
 */
export async function withDatabaseLock<T>(task: () => Promise<T>): Promise<T> {
  const previous = operationTail;
  let release: () => void = () => undefined;
  operationTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}
