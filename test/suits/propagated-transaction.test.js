const assert = require('node:assert');
const { describe, it, before, after, beforeEach } = require('node:test');

const { TransactionError } = require('#root/lib/transaction-error.js');
const { knex, data, KnexTransactionRunner } = require('#test/fixtures.js');
const {
  IsolationLevels,
  PropagatedTransaction,
} = require('#root/lib/propagated-transaction.js');

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

  beforeEach(async () => {
    await knex('user').del();
  });

  after(() => {
    process.exit();
  });

  it('Successfully create user inside of knex transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const callback = async () => {
      const user = await ptx.connection('user').insert(data.user);
    };

    await ptx.run(callback);

    const selected = await knex
      .select('*')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepStrictEqual(selected, data.user);
  });

  it('Successfully execute callback and verify that specifying isolation level works as expected', async () => {
    await knex('user').insert(data.user);

    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const callback = async () => {
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

      return user;
    };

    const user = await ptx.run(callback, IsolationLevels.RepeatableRead);

    assert.strictEqual(user.balance, data.user.balance);
  });

  it('Successfully reuse connection inside of a nested transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const nestedMethod = async (id) => {
      const nestedCallback = async () => {
        return ptx.connection('user').where({ id }).select('*').first();
      };

      return ptx.run(nestedCallback);
    };

    const method = async () => {
      const callback = async () => {
        await ptx.connection('user').insert(data.user);

        return nestedMethod(data.user.id);
      };

      return ptx.run(callback);
    };

    const result = await method();

    const selected = await knex
      .select('*')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepStrictEqual(selected, result);
  });

  it('Rollback after creating the user inside of knex transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const error = new Error('Internal error');

    const callback = async () => {
      await ptx.connection('user').insert(data.user);

      throw error;
    };

    const handler = async () => {
      await ptx.run(callback);
    };

    assert.rejects(handler, error);

    const selected = await knex
      .select('*')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepStrictEqual(selected, undefined);
  });
});
