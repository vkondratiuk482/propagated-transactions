const knex = require('knex')({
  client: 'pg',
  connection: {
    version: '8.10',
    host: '127.0.0.1',
    port: 5432,
    user: 'mokuteki',
    password: 'pass123',
    database: 'propagated-test',
  },
});

/**
 * Example of the runner that implements ITransactionRunner
 */
const KnexTransactionRunner = {
  start: async (isolationLevel) => {
    const trx = await knex.transaction({
      isolationLevel: isolationLevel.toLowerCase(),
    });

    return trx;
  },
  commit: async (trx) => {
    return trx.commit();
  },
  rollback: async (trx) => {
    return trx.rollback();
  },
};

const data = {
  user: {
    id: 1,
    name: 'Mykola',
    surname: 'Lysenko',
    balance: 0,
  },
};

module.exports = { knex, KnexTransactionRunner, data };
