'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

class IsolatedTransaction {
  #als; 
  #runner;

  static #instance = null;

  constructor(runner, als = null) {
    /**
     * Use Singleton Pattern in order to prevent memory leaks caused by 
     * creating extra IsolatedTransaction instances with new AsyncLocalStorages
     */
    if (IsolatedTransaction.#instance) {
      return IsolatedTransaction.#instance;
    }

    this.#runner = runner;
    this.#als = als || new AsyncLocalStorage();

    IsolatedTransaction.#instance = this;
  }

  async start() {
    return this.#runner.start();
  }

  async commit() {
    return this.#runner.commit();
  }

  async rollback() {
    return this.#runner.rollback();
  }

  async run(connection, callback) {
    return this.#als.run(connection, callback);
  }

  async getStoredConnection() {
    return this.#als.getStore();
  }
}

module.exports = { IsolatedTransaction };

