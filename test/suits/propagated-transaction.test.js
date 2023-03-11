const assert = require('node:assert');
const { describe, it, before, afterEach, after } = require('node:test');

const { TransactionError } = require('#root/lib/transaction-error.js');
const { knex, KnexTransactionRunner, data } = require('#test/fixtures.js');
const {
  PropagatedTransaction,
} = require('#root/lib/propagated-transaction.js');

describe('PropagatedTransaction', async () => {
  before(async () => {
    await knex.schema.dropTableIfExists('user');
    await knex.schema.createTable('user', (table) => {
      table.integer('id');
      table.string('name');
      table.string('surname');
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
      .select('id', 'name', 'surname')
      .from('user')
      .where('id', data.user.id)
      .first();

    assert.deepEqual(selected, data.user);
  });

  it('Rollback after creating the user inside of knex transaction', async () => {
    const ptx = new PropagatedTransaction(KnexTransactionRunner);

    const connection = await ptx.start();

    const callback = async () => {
      const user = await ptx.connection('user').insert(data.user);

      await ptx.rollback();
    };

    await ptx.run(connection, callback);

    const selected = await knex
      .select('id', 'name', 'surname')
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
