import { NativeModules, Platform } from 'react-native';
import * as Application from 'expo-application';
import { MyketPayments, type MyketDriver, type MyketPurchase } from './myket-payment';

interface MyketNativeModule {
  connectPayment(key: string): Promise<unknown>;
  disconnectPayment(): Promise<unknown>;
  getPurchaseUpdate(details: boolean, skus: readonly string[]): Promise<string>;
  launchProcessFlow(sku: string, payload: string): Promise<string>;
  usePurchase(purchase: string): Promise<unknown>;
}

const native = () => NativeModules.MyketReactiveBillingModule as MyketNativeModule | undefined;
export const myketSupported = () => Platform.OS === 'android' && !!native();

const driver: MyketDriver = {
  connect: (key) => native()!.connectPayment(key),
  disconnect: () => native()!.disconnectPayment(),
  inventory: async (skus) => JSON.parse(await native()!.getPurchaseUpdate(true, skus)),
  purchase: async (sku, payload) =>
    JSON.parse(await native()!.launchProcessFlow(sku, payload)) as MyketPurchase,
  consume: (purchase) => native()!.usePurchase(JSON.stringify(purchase)),
};

export const myketPayments = new MyketPayments(driver, () => Application.applicationId);
