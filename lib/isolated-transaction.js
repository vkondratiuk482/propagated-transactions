'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

class IsolatedTransaction {
  #als; 
  #runner;

  constructor(runner, als = null) {
    this.#runner = runner;
    this.#als = als || new AsyncLocalStorage();
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

  async run(store, callback) {
    return this.#als.run(store, callback);
  }
}

module.exports = { IsolatedTransaction };

