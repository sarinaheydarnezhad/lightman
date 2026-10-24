export function retryAfterDelay(value?: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const delay = /^\d+(?:\.\d+)?$/.test(value.trim())
    ? Number(value) * 1000
    : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.min(86_400_000, Math.max(0, delay)) : undefined;
}

export function retryDelay(attempt: number, minimumMs = 0, random = Math.random): number {
  const exponential = Math.min(60_000, 1000 * 2 ** Math.min(6, Math.max(0, attempt - 1)));
  return Math.max(
    Math.round(minimumMs * (1 + random() * 0.25)),
    Math.min(60_000, Math.round(exponential * (0.5 + random()))),
  );
}
