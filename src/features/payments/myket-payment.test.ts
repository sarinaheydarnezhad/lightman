import {
  MyketPayments,
  MyketPaymentError,
  type MyketDriver,
  type MyketPaymentApi,
  type MyketPurchase,
} from './myket-payment';

const purchase: MyketPurchase = {
  sku: 'plus1',
  token: 'paid-token',
  developerPayload: 'server-nonce',
  purchaseState: 0,
  packageName: 'com.lerona.app',
  originalJson: '{}',
  signature: 'signed',
  itemType: 'inapp',
};

function setup() {
  const driver: jest.Mocked<MyketDriver> = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    inventory: jest.fn().mockResolvedValue({ allPurchases: [] }),
    purchase: jest.fn().mockResolvedValue(purchase),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const api: jest.Mocked<MyketPaymentApi> = {
    myketConfiguration: jest.fn().mockResolvedValue({
      publicKey: 'public',
      packageName: purchase.packageName,
      skus: ['plus1'],
    }),
    beginMyketCheckout: jest.fn().mockResolvedValue({
      id: 'order',
      sku: 'plus1',
      developerPayload: 'server-nonce',
      durationMonths: 1,
    }),
    verifyMyketPurchase: jest.fn().mockResolvedValue({ entitlements: { isActive: true } }),
    cancelMyketCheckout: jest.fn().mockResolvedValue(undefined),
  };
  const assertCurrent = jest.fn();
  return {
    driver,
    api,
    assertCurrent,
    payments: new MyketPayments(driver, () => purchase.packageName),
  };
}

test('checkout uses server SKU and payload and consumes only after server verification', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  expect(await payments.run(api, 1, assertCurrent)).toBe(true);
  expect(driver.purchase).toHaveBeenCalledWith('plus1', 'server-nonce');
  expect(api.verifyMyketPurchase).toHaveBeenCalledWith('plus1', 'paid-token');
  expect(driver.consume.mock.invocationCallOrder[0]).toBeGreaterThan(
    api.verifyMyketPurchase.mock.invocationCallOrder[0]!,
  );
  expect(driver.disconnect).toHaveBeenCalledTimes(1);
});

test('verification failure preserves the purchase and never consumes or grants locally', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  api.verifyMyketPurchase.mockRejectedValue(new Error('Offline'));
  await expect(payments.run(api, 1, assertCurrent)).rejects.toThrow('Offline');
  expect(driver.consume).not.toHaveBeenCalled();
  expect(driver.disconnect).toHaveBeenCalledTimes(1);
});

test('recovery delivers unfinished purchases without opening another checkout', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  driver.inventory.mockResolvedValue({ allPurchases: [purchase] });
  expect(await payments.run(api, 1, assertCurrent)).toBe(true);
  expect(driver.purchase).not.toHaveBeenCalled();
  expect(api.beginMyketCheckout).not.toHaveBeenCalled();
  expect(driver.consume).toHaveBeenCalledWith(purchase);
});

test('empty explicit recovery never opens a purchase', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  expect(await payments.run(api, null, assertCurrent)).toBe(false);
  expect(driver.purchase).not.toHaveBeenCalled();
});

test.each([1, -1005])(
  'cancellation %s cancels only its server intent and does not verify or consume',
  async (responseCode) => {
    const { driver, api, assertCurrent, payments } = setup();
    driver.purchase.mockRejectedValue({
      message: 'Error not specified.',
      code: JSON.stringify({ responseCode }),
    });
    await expect(payments.run(api, 1, assertCurrent)).rejects.toEqual(
      new MyketPaymentError('cancelled'),
    );
    expect(api.cancelMyketCheckout).toHaveBeenCalledWith('order');
    expect(api.verifyMyketPurchase).not.toHaveBeenCalled();
    expect(driver.consume).not.toHaveBeenCalled();
  },
);

test('mismatched receipts remain unconsumed and are not sent as successful purchases', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  driver.purchase.mockResolvedValue({ ...purchase, developerPayload: 'forged' });
  await expect(payments.run(api, 1, assertCurrent)).rejects.toEqual(
    new MyketPaymentError('pending'),
  );
  expect(api.verifyMyketPurchase).not.toHaveBeenCalled();
  expect(driver.consume).not.toHaveBeenCalled();
});

test('package mismatch fails before connecting or requesting checkout', async () => {
  const { driver, api, assertCurrent } = setup();
  const payments = new MyketPayments(driver, () => 'wrong.package');
  await expect(payments.run(api, 1, assertCurrent)).rejects.toEqual(
    new MyketPaymentError('unavailable'),
  );
  expect(driver.connect).not.toHaveBeenCalled();
});

test('account changes during native checkout cannot verify or consume in a new account', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  driver.purchase.mockImplementation(async () => {
    assertCurrent.mockImplementation(() => {
      throw new Error('Account changed');
    });
    return purchase;
  });
  await expect(payments.run(api, 1, assertCurrent)).rejects.toThrow('Account changed');
  expect(api.verifyMyketPurchase).not.toHaveBeenCalled();
  expect(driver.consume).not.toHaveBeenCalled();
});

test('repeat taps are blocked while the native flow is open', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  let finish: (value: MyketPurchase) => void = () => {};
  driver.purchase.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const first = payments.run(api, 1, assertCurrent);
  await expect(payments.run(api, 1, assertCurrent)).rejects.toEqual(new MyketPaymentError('busy'));
  for (let turn = 0; turn < 10 && !driver.purchase.mock.calls.length; turn++)
    await Promise.resolve();
  finish(purchase);
  await first;
  expect(driver.purchase).toHaveBeenCalledTimes(1);
});

test('consumption failure is recoverable and cannot trigger a new purchase', async () => {
  const { driver, api, assertCurrent, payments } = setup();
  driver.consume.mockRejectedValueOnce(new Error('Consume interrupted'));
  await expect(payments.run(api, 1, assertCurrent)).rejects.toThrow('Consume interrupted');
  driver.inventory.mockResolvedValue({ allPurchases: [purchase] });
  expect(await payments.run(api, null, assertCurrent)).toBe(true);
  expect(driver.purchase).toHaveBeenCalledTimes(1);
  expect(api.verifyMyketPurchase).toHaveBeenCalledTimes(2);
});
