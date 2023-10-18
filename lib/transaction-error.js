'use strict';

class TransactionError extends Error {
  constructor(message) {
    super(message);
  }

  static NotInContext() {
    return new TransactionError(
      'You are trying to commit/rollback the transaction outside of AsyncLocalStorage context',
    );
  }
}

module.exports = { TransactionError };
