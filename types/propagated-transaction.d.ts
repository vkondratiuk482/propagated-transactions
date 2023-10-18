import { AsyncLocalStorage } from 'node:async_hooks';
import { IsolationLevels } from '../lib/propagated-transaction';

export interface ITransactionRunner<T extends unknown> {
  /**
   * Get transaction object to store it in AsyncLocalStorage
   */
  start(isolationLevel?: IsolationLevels): Promise<T>;

  commit(connection: T): Promise<void>;
  
  rollback(connection: T): Promise<void>;
}

export class PropagatedTransaction<T extends unknown> {
  connection: T;

  constructor(runner: ITransactionRunner<T>, als?: AsyncLocalStorage<T>);

  start(isolationLevel?: IsolationLevels): Promise<unknown>;

  commit(): Promise<void>;

  rollback(): Promise<void>;

  run<R>(connection: unknown, callback: () => R): R;
}
