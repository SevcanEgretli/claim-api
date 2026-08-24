interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

/** Polls fetchFn() until isDone(resource), or throws after timeoutMs. Use for endpoints that settle asynchronously. */
export const pollUntil = async <T>(
  fetchFn: () => Promise<T>,
  isDone: (resource: T) => boolean,
  options: PollOptions = {},
): Promise<T> => {
  const { intervalMs = 500, timeoutMs = 15_000 } = options;
  const start = Date.now();

  let resource = await fetchFn();
  while (!isDone(resource)) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for resource to settle. Last seen: ${JSON.stringify(resource)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    resource = await fetchFn();
  }
  return resource;
};
