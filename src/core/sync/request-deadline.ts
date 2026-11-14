export class RequestTransportError extends Error {
  constructor(
    readonly code: 'request_timeout' | 'request_cancelled',
    message: string,
  ) {
    super(message);
  }
}

/** One deadline spans fetch AND asynchronous body consumption. No native-only signal APIs. */
export async function withRequestDeadline<T>(
  url: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
  requests: Set<AbortController>,
  timeoutMs = 12_000,
): Promise<T> {
  const controller = new AbortController();
  let response: Response | undefined;
  let terminal = false;
  let failure: RequestTransportError | undefined;
  let rejectAbort: (error: unknown) => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const cancel = (timeout: boolean) => {
    if (failure || terminal) return;
    failure = new RequestTransportError(
      timeout ? 'request_timeout' : 'request_cancelled',
      timeout
        ? 'The cloud request timed out. Please try again.'
        : 'The cloud request was cancelled.',
    );
    rejectAbort(failure);
    controller.abort();
  };
  const externalAbort = () => cancel(false);
  const internalAbort = () => {
    // Account/lifecycle invalidation may abort a registered controller directly.
    if (!failure) cancel(false);
  };
  controller.signal.addEventListener('abort', internalAbort);
  init.signal?.addEventListener('abort', externalAbort);
  requests.add(controller);
  const timer = setTimeout(() => cancel(true), timeoutMs);
  const release = (value?: Response) => {
    try {
      if (value?.body && !value.bodyUsed) void value.body.cancel().catch(() => {});
    } catch {
      /* Some native fetch implementations do not expose streams. */
    }
  };
  try {
    if (init.signal?.aborted) externalAbort();
    const work = (async () => {
      if (controller.signal.aborted) throw failure;
      response = await fetch(url, { ...init, signal: controller.signal });
      if (terminal || controller.signal.aborted) {
        release(response);
        throw failure;
      }
      return consume(response);
    })();
    return await Promise.race([work, aborted]);
  } finally {
    terminal = true;
    clearTimeout(timer);
    controller.signal.removeEventListener('abort', internalAbort);
    init.signal?.removeEventListener('abort', externalAbort);
    requests.delete(controller);
    release(response);
  }
}
