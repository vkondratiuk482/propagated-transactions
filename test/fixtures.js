const knex = require('knex')({
  client: 'pg',
  connection: {
    version: '8.10',
    host: '127.0.0.1',
    port: 5432,
    user: 'mokuteki',
    password: 'pass123',
    database: 'isolated-test',
  },
});

/**
 * Example of the runner that implements ITransactionRunner
 */
const KnexTransactionRunner = {
  start: async () => {
    const trx = await knex.transaction();

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
  },
};

module.exports = { knex, KnexTransactionRunner, data };
