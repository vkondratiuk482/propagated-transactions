import { AsyncLocalStorage } from 'node:async_hooks';

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

export enum IsolationLevels {
  READ_COMMITTED = 'READ COMMITTED',
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}
