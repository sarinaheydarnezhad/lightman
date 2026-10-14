import * as SecureStore from 'expo-secure-store';

export const logoutBarrierKey = 'lerona.cloud.signed-out.v1';
const journalKey = 'lerona.cloud.revocations.v1';
const identityPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LogoutResult {
  readonly synchronized: boolean;
  readonly serverRevoked: boolean;
  readonly credentialsCleared: boolean;
  readonly retryAvailable: boolean;
}

export interface RevocationReceipt {
  readonly userId: string;
  readonly sessionId: string;
  readonly requestedAtUtc: string;
}

interface Journal {
  version: 1;
  receipts: RevocationReceipt[];
  result: LogoutResult | null;
}

export function sessionReference(tokens: {
  accessToken: string;
  userId?: string;
  sessionId?: string;
}): RevocationReceipt | null {
  let userId = tokens.userId;
  let sessionId = tokens.sessionId;
  try {
    const encoded = tokens.accessToken.split('.')[1]!;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    ) as {
      sub?: string;
      sid?: string;
    };
    userId ??= claims.sub;
    sessionId ??= claims.sid;
  } catch {}
  if (!userId || !sessionId || !identityPattern.test(userId) || !identityPattern.test(sessionId))
    return null;
  return {
    userId: userId.toLowerCase(),
    sessionId: sessionId.toLowerCase(),
    requestedAtUtc: new Date().toISOString(),
  };
}

export class LogoutJournal {
  private pending: Promise<void> = Promise.resolve();

  async read(): Promise<Journal> {
    const raw = await SecureStore.getItemAsync(journalKey);
    if (!raw) return { version: 1, receipts: [], result: null };
    const parsed = JSON.parse(raw) as Journal;
    if (parsed.version !== 1)
      throw new Error('Unsupported logout journal. Existing revocation references were preserved.');
    if (
      !Array.isArray(parsed.receipts) ||
      parsed.receipts.some(
        (receipt) =>
          !receipt ||
          !identityPattern.test(receipt.userId) ||
          !identityPattern.test(receipt.sessionId) ||
          !Number.isFinite(Date.parse(receipt.requestedAtUtc)),
      ) ||
      (parsed.result !== null &&
        (!parsed.result ||
          ['synchronized', 'serverRevoked', 'credentialsCleared', 'retryAvailable'].some(
            (key) => typeof parsed.result![key as keyof LogoutResult] !== 'boolean',
          )))
    )
      throw new Error('Logout status storage is invalid. Server revocation remains unconfirmed.');
    return parsed;
  }

  update(change: (journal: Journal) => void): Promise<void> {
    const operation = this.pending
      .catch(() => {})
      .then(async () => {
        const journal = await this.read();
        change(journal);
        await SecureStore.setItemAsync(journalKey, JSON.stringify(journal));
      });
    this.pending = operation;
    return operation;
  }

  add(receipt: RevocationReceipt): Promise<void> {
    return this.update((journal) => {
      if (
        !journal.receipts.some(
          (saved) => saved.userId === receipt.userId && saved.sessionId === receipt.sessionId,
        )
      )
        journal.receipts.push(receipt);
    });
  }

  remove(receipt: RevocationReceipt): Promise<void> {
    return this.update((journal) => {
      journal.receipts = journal.receipts.filter(
        (saved) => saved.userId !== receipt.userId || saved.sessionId !== receipt.sessionId,
      );
    });
  }
}
