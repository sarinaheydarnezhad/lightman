export interface MyketConfiguration {
  readonly publicKey: string;
  readonly packageName: string;
  readonly skus: readonly string[];
}

export interface MyketCheckout {
  readonly id: string;
  readonly sku: string;
  readonly developerPayload: string;
  readonly durationMonths: number;
  readonly priceToman: number;
  readonly expiresAtUtc: string;
}

export function validateMyketConfiguration(value: unknown): MyketConfiguration {
  const config = value as MyketConfiguration | null;
  if (
    !config ||
    typeof config.publicKey !== 'string' ||
    !config.publicKey ||
    typeof config.packageName !== 'string' ||
    !config.packageName ||
    !Array.isArray(config.skus) ||
    config.skus.length !== 3 ||
    config.skus.some((sku) => typeof sku !== 'string' || !sku) ||
    new Set(config.skus).size !== config.skus.length
  )
    throw new Error('Invalid Myket configuration.');
  return config;
}

export function validateMyketCheckout(value: unknown): MyketCheckout {
  const order = value as MyketCheckout | null;
  if (
    !order ||
    typeof order.id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(order.id) ||
    typeof order.sku !== 'string' ||
    !order.sku ||
    typeof order.developerPayload !== 'string' ||
    !/^[0-9A-F]{64}$/.test(order.developerPayload) ||
    ![1, 6, 12].includes(order.durationMonths) ||
    !Number.isSafeInteger(order.priceToman) ||
    order.priceToman <= 0 ||
    !Number.isFinite(Date.parse(order.expiresAtUtc)) ||
    Date.parse(order.expiresAtUtc) <= Date.now()
  )
    throw new Error('Invalid or expired checkout.');
  return order;
}
