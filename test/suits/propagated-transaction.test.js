const assert = require('node:assert');
const { describe, it, before, afterEach, after } = require('node:test');

const { TransactionError } = require('#root/lib/transaction-error.js');
const { knex, data, KnexTransactionRunner } = require('#test/fixtures.js');
const {
  PropagatedTransaction,
} = require('#root/lib/propagated-transaction.js');
const { IsolationLevels } = require('../../lib/propagated-transaction');

describe('PropagatedTransaction', async () => {
  before(async () => {
    await knex.schema.dropTableIfExists('user');
    await knex.schema.createTable('user', (table) => {
      table.integer('id').primary().unique();
      table.string('name');
      table.string('surname');
      table.integer('balance');
    });
  });

  afterEach(async () => {
    await knex('user').del();
  });

  after(() => {
    process.exit(0);
  });

  it('Successfully create user inside of knex transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const connection = await ptx.start();

    const callback = async () => {
      try {
        const user = await ptx.connection('user').insert(data.user);

        await ptx.commit();
      } catch (err) {
        await ptx.rollback();
      }
    };

    await ptx.run(connection, callback);

    const selected = await knex
      .select('*')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepEqual(selected, data.user);
  });

  it('Successfully execute callback and verify that specifying isolation level works as expected', async () => {
    await knex('user').insert(data.user);

    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const connection = await ptx.start(IsolationLevels.ReadCommitted);

    const callback = async () => {
      try {
        /**
         * For some reason isolation levels don't work as expected if we don't execute at least one random query before performing any query on the outer connection
         * Even though DEBUG=knex:query shows the proper order of SQL queries it still returns wrong results from time to time.
         */
        await ptx.connection('user').count();

        // Operation that is being executed using outer connection
        await knex('user').where({ id: data.user.id }).update({ balance: 100 });

        const user = await ptx
          .connection('user')
          .where({ id: data.user.id })
          .select('*')
          .first();

        await ptx.commit();

        return user;
      } catch (err) {
        await ptx.rollback();
      }
    };

    const user = await ptx.run(connection, callback);

    assert.strictEqual(user.balance, data.user.balance);
  });

  it('Rollback after creating the user inside of knex transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const connection = await ptx.start();

    const callback = async () => {
      await ptx.connection('user').insert(data.user);

      await ptx.rollback();
    };

    await ptx.run(connection, callback);

    const selected = await knex
      .select('*')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepEqual(selected, undefined);
  });

  it('Throw TransactionError.NotInContext when calling .commit() outside of the context', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const handler = async () => {
      await ptx.commit();
    };

    assert.rejects(handler, TransactionError.NotInContext());
  });

  it('Throw TransactionError.NotInContext when calling .rollback() outside of the context', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const handler = async () => {
      await ptx.rollback();
    };

    assert.rejects(handler, TransactionError.NotInContext());
  });
});
