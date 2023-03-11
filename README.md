# @mokuteki/propagated-transactions
Convenient wrapper around AsyncLocalStorage to propagate and manage database transactions without breaking the abstraction layer for Node.js, including Typescript .d.ts support

## Installation
```bash
npm i @mokuteki/propagated-transactions
```

## Motivation
Splitting the business logic and data layers brings a lot of flexebility and overall makes your piece of software better. We don't want the business logic to be bound to one specific implementation of the data layer, or any database driver, ORM, whatever. First we create an interface for our data layer 
```ts
export interface IUserRepository {
  findById(id: string): Promise<UserEntity>
}
```
Then we implement the interface (Typeorm is used in this example)
```ts
export class TypeormUserRepository implements IUserRepository {
  constructor(private readonly userRepository: Repository<TypeormUserEntity>) {}

  public async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository
      .createQueryBuilder('u')
      .where('id = :id', { id })
      .getOne();

    return user;
  }
}
```
So that now we are able to use our implementation through the interface inside of our business logic layer
```ts
export class UserService {
  constructor(private readonly userRepository: IUserRepository) {}

  public async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);

    return user;
  }
}
```
Looks great, but in real life our applications are much more complex, one day you'll have to take care of atomicity of your operations. Due to Node.js asynchronous nature in order to guarantee atomicity we have to book a database connection and execute all of the transaction's operations using this connection. Without separating the layers we could do something like this straight in the business logic layer (Typeorm example)
```ts
const queryRunner = dataSource.createQueryRunner()

await queryRunner.connect()
await queryRunner.startTransaction()

try {
    await queryRunner.manager.save(user1)
    await queryRunner.manager.save(user2)
    await queryRunner.manager.save(photos)

    await queryRunner.commitTransaction()
} catch (err) {
    await queryRunner.rollbackTransaction()
} finally {
    await queryRunner.release()
}
```
But that will bind the business logic to the ORM which is not a good practice at all. The first solution that comes to mind is to propagate the connection object straight to the Repository
```ts
export interface IUserRepository {
  findById(id: string, queryRunner: QueryRunner): Promise<UserEntity>
}
```
But this approach also breaks the abstraction and ruins the whole idea of separate layers. Here is the place where AsyncLocalStorage and this package come in handy

## Usage
We have decided that we want our business logic be independent of data layer, but still be able to manage operations' atomicity. There are a few steps to follow in order to use this library

1. Create an implementation of `ITransactionRunner` interface (provided by the package) for your specific database, driver, ORM, whatever
2. Create an instance of `PropagatedTransaction` and pass implementation from step one into constructor
3. Instantiate and store database connection by starting the transaction with `PropagatedTransaction.start()`
4. Create a callback that executes business logic, use `PropagatedTransaction.commit() / PropagatedTransaction.rollback()` inside of it 
5. Run `PropagatedTransaction.run(connection, callback)`, where `connection` is stored connection from step three, `callback` is a callback from step four
6. Inside of data layer (for example UserRepository) obtain connection and use it to run your query


Let's take a more detailed view on each of the steps:

### Step 1
Library provides ITransactionRunner interface which looks like this
```ts
// types/isolated-transaction.d.ts

export interface ITransactionRunner<T extends unknown> {
  start(): Promise<T>;

  commit(connection: T): Promise<void>;
  
  rollback(connection: T): Promise<void>;
}
```
Let's implement a TypeormTransactionRunner that manages transactions for Typeorm
```ts
import { DataSource, QueryRunner } from 'typeorm';
import { PropagatedTransaction, ITransactionRunner } from '@mokuteki/isolated-transaction';

export class TypeormTransactionRunner implements ITransactionRunner<QueryRunner> {
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
```
Library works like a charm even without Typescript, so you don't have to use Typescript-specific `interfaces` and `implement` syntax to make it work. Here is an example of pure Javascript implementation for Knex library
```js
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
```

### Step 2
Create `PropagatedTransaction` instance, it can be created in any way, any where. For example you can create custom provider if you are using Nestjs and inject it inside of your providers. Or you can use approach below 
```ts
export const ptx = new PropagatedTransaction(TypeormTransactionRunner);
```

### Step 3
Instantiate and store database connection
```ts
export class UserService {
  constructor(
    private readonly ptx: PropagatedTransaction, 
    private readonly userRepository: IUserRepository
  ) {}


  public async create(name: string): Promise<UserEntity> {
    const connection = await this.ptx.start();

    const user = await this.userRepository.create(name);

    return user;
  }
}
```

### Step 4
Create a callback that executes business logic with the help of `PropagatedTransaction.commit() / PropagatedTransaction.rollback()`
```ts
export class UserService {
  constructor(
    private readonly ptx: PropagatedTransaction, 
    private readonly userRepository: IUserRepository
  ) {}

  public async create(id: string): Promise<UserEntity> {
    const connection = await this.ptx.start();

    const callback = async () => {
      try {
        const user = await this.userRepository.create(name);

        await this.ptx.commit();

        return user;
      } catch (err) {
        await this.ptx.rollback();
      }
    };

    return null;
  }
}
```
If you try calling `PropagatedTransaction.commit() / PropagatedTransaction.rollback()` outside of the context you will receive 
```ts
throw TransactionError.NotInContext();
^

TransactionError: You are trying to get connection object outside of AsyncLocalStorage context
```

### Step 5

Run the transaction
```ts
export class UserService {
  constructor(
    private readonly ptx: PropagatedTransaction, 
    private readonly userRepository: IUserRepository
  ) {}

  public async create(id: string): Promise<UserEntity> {
    const connection = await this.ptx.start();

    const callback = async () => {
      try {
        const user = await this.userRepository.create(name);

        await this.ptx.commit();

        return user;
      } catch (err) {
        await this.ptx.rollback();
      }
    };

    return this.ptx.run(connection, callback);
  }
}
```
`PropagatedTransaction.run()` returns Promise which resolves with the data returned from the `callback`. You can also wait for the transaction to finish and do something with the results
```ts
export class UserService {
  constructor(
    private readonly ptx: PropagatedTransaction, 
    private readonly userRepository: IUserRepository
  ) {}

  public async create(id: string): Promise<UserEntity> {
    const connection = await this.ptx.start();

    const callback = async () => {
      try {
        const user = await this.userRepository.create(name);

        await this.ptx.commit();

        return user;
      } catch (err) {
        await this.ptx.rollback();
      }
    };

    const user = await this.ptx.run(connection, callback);

    console.log(user);

    return user;
  }
}
```

### Step 6
Obtain database connection inside of the data layer using `PropagatedTransaction.connection`
```ts
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    private readonly manager: EntityManager, 
    private readonly ptx: PropagatedTransaction,
  ) {}

  public async create(name: string): Promise<UserEntity> {
    /**
     * If there is no connection stored, we use our injected one and run the query outside of transaction
     */
    const manager = this.ptx.connection?.manager || this.manager;

    const user = manager.getRepository(TypeormUserEntity).create({ name });

    return manager.save(user)
  }
}
```

## Tests
Before doing any kind of contribution run tests, here is how
```bash
cd db && sudo docker-compose up -d

npm run test
```

## License
Licensed under [MIT](https://github.com/mokuteki225/propagated-transactions/blob/main/LICENSE.md)
