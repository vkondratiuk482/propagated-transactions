'use strict';

class TransactionError extends Error {
  constructor(message) {
    super(message);
  }

  static NotInContext() {
    return new TransactionError(
      'You are trying to get connection object outside of AsyncLocalStorage context',
    );
  }
}

module.exports = { TransactionError };
