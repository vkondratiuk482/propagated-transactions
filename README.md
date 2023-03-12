# @mokuteki/propagated-transactions
Convenient wrapper to propagate database connection and give you opportunity to manage the state of your transactions, uses `AsyncLocalStorage` under the hood, Typescript friendly, 0 production dependencies

### Main advantages and use cases
* Do not pollute method arguments with connection object `userService.create(payload, connection)`, the package does it for you
* Don't bind your transaction managing logic to any database, driver, ORM, whatever. In case you need to change one of the mentioned above, you will just need to provide a different implementation of `ITransactionRunner`


## Installation
```bash
npm i @mokuteki/propagated-transactions
```

## Usage

1. Create an implementation of `ITransactionRunner` interface (provided by the package) for your specific database, driver, ORM, whatever
2. Create an instance of `PropagatedTransaction` and pass implementation from step one into constructor
3. Instantiate and store database connection by starting the transaction with `PropagatedTransaction.start()`
4. Create a callback that executes business logic, use `PropagatedTransaction.commit() / PropagatedTransaction.rollback()` inside of it 
5. Run `PropagatedTransaction.run(connection, callback)`, where `connection` is stored connection from step three, `callback` is a callback from step four
6. Obtain connection inside of inner method/abstraction layer and use it to run your query

### Javascript example

```js
const { PropagatedTransaction } = require('@mokuteki/propagated-transactions');

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

// Step 1
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

// Step 2
module.exports.ptx = new PropagatedTransaction(KnexTransactionRunner);
```

```js
async create(payload1, payload2) {
  // Step 3
  const connection = await this.ptx.start();

  // Step 4
  const callback = async () => {
    try {
      const user = await userService.create(payload1);
      const wallet = await walletService.create(payload2);

      await this.ptx.commit();

      return user;
    } catch (err) {
      await this.ptx.rollback();
    }
  };

  // Step 5
  const user = await this.ptx.run(connection, callback);

  return user;
}
```

```js
class UserService {
  async create(payload) {
    /**
     * Step 6
     * If you run this method in PropagatedTransaction context it will be executed in transaction
     * Otherwise it will be executed as usual query
     */
    const connection = ptx.connection || knex;
    return connection('user').insert(payload);
  }
}
```

```js
class WalletService {
  async create(payload, trx) {
    // Step 6
    const connection = ptx.connection || knex;
    return connection('wallet').insert(payload);
  }
}
```

### Typescript example + Layers Separation

```ts
import { DataSource, QueryRunner } from 'typeorm';
import { PropagatedTransaction, ITransactionRunner } from '@mokuteki/propagated-transactions';

// Step 1
class TypeormTransactionRunner implements ITransactionRunner<QueryRunner> {
  private readonly ptx = new PropagatedTransaction();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Book and return database connection, run `.start()` method if exists
   */
  public async start(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    await queryRunner.startTransaction();

    return queryRunner;
  }

  public async commit(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.commitTransaction();

    return queryRunner.release();
  }

  public async rollback(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.rollbackTransaction();

    return queryRunner.release();
  }
}

// Step 2
export const ptx = new PropagatedTransaction(TypeormTransactionRunner);
```

```ts
export class UserService {
  constructor(
    private readonly ptx: PropagatedTransaction, 
    private readonly userRepository: IUserRepository, 
    private readonly walletRepository: IWalletRepository, 
  ) {}

  public async create(
    payload1: ICreateUser, 
    payload2: ICreateWallet
  ): Promise<UserEntity> {
    // Step 3
    const connection = await this.ptx.start();

    // Step 4
    const callback = async () => {
      try {
        const user = await this.userRepository.create(payload1);
        const wallet = await this.walletRepository.create(payload2);

        await this.ptx.commit();

        return user;
      } catch (err) {
        await this.ptx.rollback();
      }
    };

    // Step 5
    const user = await this.ptx.run<Promise<UserEntity>>(connection, callback);

    return user;
  }
}
```

```ts
export class UserRepository implements IUserRepository {
  constructor(
    private readonly manager: EntityManager, 
    private readonly ptx: PropagatedTransaction,
  ) {}

  /**
   * Step 6
   * If you run this method in PropagatedTransaction context it will be executed in transaction
   * Otherwise it will be executed as usual query
   */
  public async create(data: ICreateUser): Promise<UserEntity> {
    const manager = this.ptx.connection?.manager || this.manager;

    const user = manager.getRepository(TypeormUserEntity).create(data);

    return manager.save(user)
  }
}
```

```ts
export class WalletRepository implements IWalletRepository {
  constructor(
    private readonly manager: EntityManager, 
    private readonly ptx: PropagatedTransaction,
  ) {}

  /**
   * Step 6
   * If you run this method in PropagatedTransaction context it will be executed in transaction
   * Otherwise it will be executed as usual query
   */
  public async create(data: ICreateWallet): Promise<WalletEntity> {
    const manager = this.ptx.connection?.manager || this.manager;

    const wallet = manager.getRepository(TypeormWalletEntity).create(data);

    return manager.save(wallet)
  }
}
```



## Motivation

Imagine we need to run `UserService.create()` and `WalletService.create()` in transaction

```js
class UserService {
  async create(payload) {
    return knex('user').insert(payload);
  }
}
```

```js
class WalletService {
  async create(payload) {
    return knex('wallet').insert(payload);
  }
}
```

Due to Node.js asynchronous nature in order to guarantee operations' atomicity we have to book a database connection and execute all of the transaction's operations using this specific connection. So we have to do something like this
```js
class UserService {
  async create(payload, trx) {
    return trx('user').insert(payload);
  }
}
```

```js
class WalletService {
  async create(payload, trx) {
    return trx('wallet').insert(payload);
  }
}
```

```js
async create(payload1, payload2) {
  const trx = await knex.transaction();

  try {
    const user = await userService.create(payload1, trx);
    const wallet = await walletService.create(payload2, trx);

    await trx.commit();
  } catch (err) {
    await trx.rollback();
  }
}
```
The idea of this package is to propagate the connection and give you opportunity to manage the state of your transaction without binding your business logic to any database, ORM, driver, whatever

## Tests
Before doing any kind of contribution run tests, here is how
```bash
cd db && sudo docker-compose up -d

npm run test
```

## License
Licensed under [MIT](https://github.com/mokuteki225/propagated-transactions/blob/main/LICENSE.md)
