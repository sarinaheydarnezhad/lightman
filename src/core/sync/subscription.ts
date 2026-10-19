export interface PlanLimits {
  readonly decks: number | null;
  readonly cards: number | null;
}

export interface PlanFeatures {
  readonly unlimitedDecks: boolean;
  readonly unlimitedCards: boolean;
}

export interface PlanDefinition {
  readonly plan: string;
  readonly isPurchasable: boolean;
  readonly unavailableReason: string;
  readonly limits: PlanLimits | null;
  readonly features: PlanFeatures | null;
  readonly prices: readonly { readonly durationMonths: number; readonly priceToman: number }[];
}

export interface PlanCatalog {
  readonly currency: 'Toman';
  readonly purchaseSupported: false;
  readonly freeLimits: PlanLimits;
  readonly plans: readonly PlanDefinition[];
}

export interface Entitlements {
  readonly currentPlan: 'Free' | 'Plus';
  readonly isActive: boolean;
  readonly startsAtUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly features: PlanFeatures;
  readonly limits: PlanLimits;
  readonly isPurchasable: false;
  readonly purchaseSupported: false;
  readonly withinFreeTierLimits: boolean;
  readonly usage: { readonly decks: number; readonly cards: number };
  readonly validatedAtUtc: string;
}

export interface SubscriptionInfo {
  readonly id: string;
  readonly plan: 'Plus' | 'Full';
  readonly storedStatus: 'Active' | 'Expired' | 'Cancelled';
  readonly status: 'Active' | 'Expired' | 'Cancelled' | 'Scheduled' | 'Unavailable';
  readonly startsAtUtc: string;
  readonly expiresAtUtc: string;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface CurrentSubscription {
  readonly subscription: SubscriptionInfo | null;
  readonly entitlements: Entitlements;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) && Number.isFinite(Date.parse(value))
  );
}

function validCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validLimits(limits: PlanLimits | null | undefined): limits is PlanLimits {
  return (
    !!limits &&
    (limits.decks === null || validCount(limits.decks)) &&
    (limits.cards === null || validCount(limits.cards))
  );
}

function validFeatures(features: PlanFeatures | null | undefined): features is PlanFeatures {
  return (
    !!features &&
    typeof features.unlimitedDecks === 'boolean' &&
    typeof features.unlimitedCards === 'boolean'
  );
}

export function validatePlanCatalog(value: unknown): PlanCatalog {
  const catalog = value as PlanCatalog | null;
  if (
    !catalog ||
    catalog.currency !== 'Toman' ||
    catalog.purchaseSupported !== false ||
    !validLimits(catalog.freeLimits) ||
    !Array.isArray(catalog.plans) ||
    !catalog.plans.length ||
    new Set(catalog.plans.map((plan) => plan?.plan)).size !== catalog.plans.length ||
    catalog.plans.some(
      (plan: PlanDefinition) =>
        !plan ||
        typeof plan.plan !== 'string' ||
        !plan.plan ||
        plan.isPurchasable !== false ||
        typeof plan.unavailableReason !== 'string' ||
        !Array.isArray(plan.prices) ||
        (plan.limits !== null && !validLimits(plan.limits)) ||
        (plan.features !== null && !validFeatures(plan.features)) ||
        (plan.plan === 'Full' &&
          (plan.limits !== null || plan.features !== null || plan.prices.length !== 0)) ||
        plan.prices.some(
          (price) =>
            !price ||
            !validCount(price.durationMonths) ||
            price.durationMonths === 0 ||
            !validCount(price.priceToman) ||
            price.priceToman === 0,
        ),
    )
  )
    throw new Error('Invalid server plan catalog. No purchase is available.');
  return catalog;
}

export function validateEntitlements(value: unknown): Entitlements {
  const entitlement = value as Entitlements | null;
  if (
    !entitlement ||
    !['Free', 'Plus'].includes(entitlement.currentPlan) ||
    typeof entitlement.isActive !== 'boolean' ||
    entitlement.isActive !== (entitlement.currentPlan === 'Plus') ||
    entitlement.isPurchasable !== false ||
    entitlement.purchaseSupported !== false ||
    !validDate(entitlement.validatedAtUtc) ||
    typeof entitlement.withinFreeTierLimits !== 'boolean' ||
    !validLimits(entitlement.limits) ||
    !validFeatures(entitlement.features) ||
    !entitlement.usage ||
    !validCount(entitlement.usage.decks) ||
    !validCount(entitlement.usage.cards) ||
    (entitlement.startsAtUtc !== null && !validDate(entitlement.startsAtUtc)) ||
    (entitlement.expiresAtUtc !== null && !validDate(entitlement.expiresAtUtc)) ||
    (entitlement.startsAtUtc === null) !== (entitlement.expiresAtUtc === null) ||
    (entitlement.isActive &&
      (!entitlement.startsAtUtc ||
        !entitlement.expiresAtUtc ||
        Date.parse(entitlement.startsAtUtc) > Date.parse(entitlement.validatedAtUtc) ||
        Date.parse(entitlement.expiresAtUtc) <= Date.parse(entitlement.validatedAtUtc)))
  )
    throw new Error('Invalid server entitlements. Refresh your account online.');
  return entitlement;
}

export function validateSubscription(value: unknown): CurrentSubscription {
  const current = value as CurrentSubscription | null;
  if (!current) throw new Error('Invalid subscription response.');
  const entitlement = validateEntitlements(current.entitlements);
  const subscription = current.subscription;
  if (subscription === null) {
    if (
      entitlement.isActive ||
      entitlement.startsAtUtc !== null ||
      entitlement.expiresAtUtc !== null
    )
      throw new Error('Missing subscription metadata.');
  } else if (
    !subscription ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subscription.id) ||
    !['Plus', 'Full'].includes(subscription.plan) ||
    !['Active', 'Expired', 'Cancelled'].includes(subscription.storedStatus) ||
    !['Active', 'Expired', 'Cancelled', 'Scheduled', 'Unavailable'].includes(subscription.status) ||
    ![
      subscription.startsAtUtc,
      subscription.expiresAtUtc,
      subscription.createdAtUtc,
      subscription.updatedAtUtc,
    ].every(validDate) ||
    Date.parse(subscription.expiresAtUtc) <= Date.parse(subscription.startsAtUtc) ||
    entitlement.startsAtUtc !== subscription.startsAtUtc ||
    entitlement.expiresAtUtc !== subscription.expiresAtUtc ||
    entitlement.isActive !== (subscription.status === 'Active' && subscription.plan === 'Plus')
  )
    throw new Error('Invalid subscription metadata.');
  return current;
}
