export type SyncEntityType = 'deck' | 'card' | 'reviewState' | 'reviewEvent' | 'settings';
export type SyncOperation = 'upsert' | 'archive' | 'create';

export interface PendingOperation {
  readonly sequence: number;
  readonly operationId: string;
  readonly entityType: SyncEntityType;
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly payload: unknown;
  readonly expectedVersion: number;
  readonly createdAt: string;
  readonly retryCount: number;
  readonly status: 'pending' | 'synced' | 'conflict' | 'failed';
}

export interface ServerChange {
  readonly entityType: SyncEntityType;
  readonly entityId: string;
  readonly operation: SyncOperation;
  readonly deviceId: string;
  readonly clientChangeId: string;
  readonly clientChangedAtUtc: string;
  readonly serverVersion: number;
  readonly payload: Record<string, unknown>;
}

export interface PullPage {
  readonly cursor: number;
  readonly latestVersion: number;
  readonly hasMore: boolean;
  readonly changes: ServerChange[];
}

export interface SyncConflict {
  readonly entityType: SyncEntityType;
  readonly entityId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;
  readonly serverValue: Record<string, unknown> | null;
  readonly clientValue: Record<string, unknown> | null;
}
