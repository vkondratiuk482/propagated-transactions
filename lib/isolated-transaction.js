'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

class IsolatedTransaction {
  static #instance = null;

  get connection() {
    return this.als.getStore();
  }

  constructor(runner, als = null) {
    /**
     * Use Singleton Pattern in order to prevent memory leaks caused by
     * creating extra IsolatedTransaction instances with new AsyncLocalStorages
     */
    if (IsolatedTransaction.#instance) {
      return IsolatedTransaction.#instance;
    }

    this.runner = runner;
    this.als = als || new AsyncLocalStorage();

    IsolatedTransaction.#instance = this;
  }

  async start() {
    return this.connection || this.runner.start();
  }

  async commit() {
    return this.runner.commit(this.connection);
  }

  async rollback() {
    return this.runner.rollback(this.connection);
  }

  async run(connection, callback) {
    return this.als.run(connection, callback);
  }
}

module.exports = { IsolatedTransaction };
