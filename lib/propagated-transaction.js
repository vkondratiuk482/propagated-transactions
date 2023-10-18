'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { TransactionError } = require('#root/lib/transaction-error.js');

class IsolationLevels {
  static Serializable = 'SERIALIZABLE';
  static ReadCommitted = 'READ COMMITTED';
  static RepeatableRead = 'REPEATABLE READ';
  static ReadUncommitted = 'READ UNCOMMITTED';
}

class PropagatedTransaction {
  static #instance = null;

  get connection() {
    const connection = this.als.getStore();

    return connection;
  }

  constructor(runner, als = null) {
    if (PropagatedTransaction.#instance) {
      return PropagatedTransaction.#instance;
    }

    this.runner = runner;
    this.als = als || new AsyncLocalStorage();

    PropagatedTransaction.#instance = this;
  }

  async start(isolationLevel = 'READ COMMITTED') {
    return this.connection || this.runner.start(isolationLevel);
  }

  async commit() {
    if (!this.connection) {
      throw TransactionError.NotInContext();
    }

    return this.runner.commit(this.connection);
  }

  async rollback() {
    if (!this.connection) {
      throw TransactionError.NotInContext();
    }

    return this.runner.rollback(this.connection);
  }

  async run(connection, callback) {
    return this.als.run(connection, callback);
  }
}

module.exports = { PropagatedTransaction, IsolationLevels };
