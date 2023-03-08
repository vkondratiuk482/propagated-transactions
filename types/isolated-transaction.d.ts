import { AsyncLocalStorage } from 'node:async_hooks';

export interface ITransactionRunner {
  /**
   * Get transaction object to store it in AsyncLocalStorage
   */
  start(): Promise<unknown>;

  commit(): Promise<void>;
  
  rollback(): Promise<void>;
}

export class IsolatedTransaction {
  constructor(runner: ITransactionRunner, als?: AsyncLocalStorage);

  start(): Promise<unknown>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  run<T>(connection: unknown, callback: () => T): T;

  getStoredConnection<T extends unknown>(): T | undefined;
}
