'use strict';

class TransactionError extends Error {
  constructor(message) {
    this.message = message;
  }

  static NotStarted() {
    return new TransactionError('You have to start the transaction in order to run it. Use IsolatedTransaction.start()');
  }
}

module.exports = { TransactionError };
