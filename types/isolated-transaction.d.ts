import { AsyncLocalStorage } from 'node:async_hooks';

export interface ITransactionRunner<T extends unknown> {
  /**
   * Get transaction object to store it in AsyncLocalStorage
   */
  start(): Promise<T>;

  commit(connection: T): Promise<void>;
  
  rollback(connection: T): Promise<void>;
}

export class IsolatedTransaction<T extends unknown> {
  connection: T;

  constructor(runner: ITransactionRunner<T>, als?: AsyncLocalStorage<T>);

  start(): Promise<unknown>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  run<R>(connection: unknown, callback: () => R): R;
}
