import type { CurrentSubscription } from '@/core/sync/subscription';
import type { MyketCheckout, MyketConfiguration } from '@/core/sync/myket-payment';

export interface MyketPurchase {
  readonly sku: string;
  readonly token: string;
  readonly developerPayload: string;
  readonly purchaseState: number;
  readonly packageName: string;
  readonly originalJson: string;
  readonly signature: string;
  readonly itemType: string;
}

export interface MyketDriver {
  connect(key: string): Promise<unknown>;
  disconnect(): Promise<unknown>;
  inventory(skus: readonly string[]): Promise<{ allPurchases: MyketPurchase[] }>;
  purchase(sku: string, payload: string): Promise<MyketPurchase>;
  consume(purchase: MyketPurchase): Promise<unknown>;
}

export interface MyketPaymentApi {
  myketConfiguration(): Promise<MyketConfiguration>;
  beginMyketCheckout(months: number): Promise<MyketCheckout>;
  verifyMyketPurchase(sku: string, token: string): Promise<CurrentSubscription>;
  cancelMyketCheckout(id: string): Promise<void>;
}

export class MyketPaymentError extends Error {
  constructor(readonly code: 'cancelled' | 'pending' | 'unavailable' | 'busy') {
    super(code);
  }
}

export function myketResponseCode(error: unknown): number | undefined {
  const native = error as { message?: string; code?: string; responseCode?: number } | null;
  if (typeof native?.responseCode === 'number') return native.responseCode;
  for (const candidate of [
    native?.message,
    native?.code,
    typeof error === 'string' ? error : undefined,
  ]) {
    if (!candidate) continue;
    try {
      const detail = JSON.parse(candidate) as { responseCode?: number };
      if (typeof detail.responseCode === 'number') return detail.responseCode;
    } catch {}
  }
  return undefined;
}

export class MyketPayments {
  private busy = false;

  constructor(
    private readonly driver: MyketDriver,
    private readonly packageName: () => string | null,
  ) {}

  async run(
    api: MyketPaymentApi,
    months: number | null,
    assertCurrent: () => void,
  ): Promise<boolean> {
    if (this.busy) throw new MyketPaymentError('busy');
    this.busy = true;
    let connected = false;
    let order: MyketCheckout | undefined;
    try {
      assertCurrent();
      const config = await api.myketConfiguration();
      assertCurrent();
      if (config.packageName !== this.packageName()) throw new MyketPaymentError('unavailable');
      await this.driver.connect(config.publicKey);
      connected = true;
      assertCurrent();
      const inventory = await this.driver.inventory(config.skus);
      assertCurrent();
      let recovered = false;
      for (const purchase of inventory.allPurchases) {
        if (!config.skus.includes(purchase.sku)) continue;
        await this.deliver(api, purchase, config, assertCurrent);
        recovered = true;
      }
      if (months === null || recovered) return recovered;
      order = await api.beginMyketCheckout(months);
      assertCurrent();
      if (!config.skus.includes(order.sku) || order.durationMonths !== months)
        throw new MyketPaymentError('unavailable');
      const purchase = await this.driver.purchase(order.sku, order.developerPayload);
      assertCurrent();
      if (purchase.sku !== order.sku || purchase.developerPayload !== order.developerPayload)
        throw new MyketPaymentError('pending');
      await this.deliver(api, purchase, config, assertCurrent);
      return true;
    } catch (error) {
      if ([1, -1005].includes(myketResponseCode(error) ?? 0)) {
        assertCurrent();
        if (order) await api.cancelMyketCheckout(order.id).catch(() => {});
        throw new MyketPaymentError('cancelled');
      }
      throw error;
    } finally {
      if (connected) await this.driver.disconnect().catch(() => {});
      this.busy = false;
    }
  }

  private async deliver(
    api: MyketPaymentApi,
    purchase: MyketPurchase,
    config: MyketConfiguration,
    assertCurrent: () => void,
  ): Promise<void> {
    if (
      purchase.purchaseState !== 0 ||
      purchase.packageName !== config.packageName ||
      !purchase.token
    )
      throw new MyketPaymentError('pending');
    assertCurrent();
    await api.verifyMyketPurchase(purchase.sku, purchase.token);
    assertCurrent();
    await this.driver.consume(purchase);
    assertCurrent();
  }
}
