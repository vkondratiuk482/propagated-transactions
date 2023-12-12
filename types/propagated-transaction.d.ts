import { AsyncLocalStorage } from 'node:async_hooks';

type IsolationLevelKey = 'Serializable' | 'ReadCommitted' | 'RepeatableRead' | 'ReadUncommitted'
type IsolationLevelValue = 'SERIALIZABLE' | 'READ COMMITTED' | 'REPEATABLE READ' | 'READ UNCOMMITTED';

export const IsolationLevels: Record<IsolationLevelKey, IsolationLevelValue> = {
  Serializable: 'SERIALIZABLE',
  ReadCommitted: 'READ COMMITTED',
  RepeatableRead: 'REPEATABLE READ',
  ReadUncommitted: 'READ UNCOMMITTED',
};

export interface ITransactionRunner<T extends unknown> {
  /**
   * Get transaction object to store it in AsyncLocalStorage
   */
  start(isolationLevel?: IsolationLevelValue): Promise<T>;

  commit(connection: T): Promise<void>;
  
  rollback(connection: T): Promise<void>;
}

export class PropagatedTransaction<T extends unknown> {
  connection: T;

  constructor(runner: ITransactionRunner<T>, als?: AsyncLocalStorage<T>);

  run<R>(callback: () => R, isolationLevel?: IsolationLevelValue): R;
}
