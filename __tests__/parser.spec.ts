import {
  CreateTableQuery,
  InsertQuery,
  Parser,
  SelectQuery,
  TransactionQuery,
  TransactionStatement,
} from '../src/parser';

describe('Parser', () => {
  describe('transaction', () => {
    it('should return START_TRANSACTION TransactionQuery', () => {
      const p = new Parser();
      const res = p.parse('START TRANSACTION', []);

      expect(res).toBeInstanceOf(TransactionQuery);
      expect((res as TransactionQuery).statement).toBe(TransactionStatement.START_TRANSACTION);
    });
    it('should return COMMIT TransactionQuery', () => {
      const p = new Parser();
      const res = p.parse('COMMIT', []);

      expect(res).toBeInstanceOf(TransactionQuery);
      expect((res as TransactionQuery).statement).toBe(TransactionStatement.COMMIT);
    });
    it('should return ROLLBACK TransactionQuery', () => {
      const p = new Parser();
      const res = p.parse('ROLLBACK', []);

      expect(res).toBeInstanceOf(TransactionQuery);
      expect((res as TransactionQuery).statement).toBe(TransactionStatement.ROLLBACK);
    });
  });

  describe('create table', () => {
    it('should return CreateTableQuery', () => {
      const p = new Parser();
      const sql = `
        CREATE TABLE \`companies\` (
          \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
          \`name\` varchar(255) NOT NULL,
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `;
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(CreateTableQuery);
      expect((res as CreateTableQuery).databaseName).toBe(null);
      expect((res as CreateTableQuery).tableName).toBe('companies');
      expect((res as CreateTableQuery).columns).toEqual([
        { name: 'id', dataType: 'INT' },
        { name: 'name', dataType: 'VARCHAR' },
      ]);
    });
  });

  describe('insert', () => {
    it('should return InsertQuery', () => {
      const p = new Parser();
      const sql = `INSERT INTO users (id, name) VALUES (1, 'name1'), (2, 'name2'), (3, 'name3')`;
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(InsertQuery);
      expect((res as InsertQuery).databaseName).toBe(null);
      expect((res as InsertQuery).tableName).toBe('users');
      expect((res as InsertQuery).rows).toEqual([
        { id: 1, name: 'name1' },
        { id: 2, name: 'name2' },
        { id: 3, name: 'name3' },
      ]);
    });
  });

  describe('select', () => {
    it('should parse function column', () => {
      const p = new Parser();
      const sql = 'SELECT database()';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).from).toBe(null);
      expect((res as SelectQuery).columns).toEqual([
        { type: 'function', name: 'database', alias: 'database()' }
      ]);
    });
    it('should parse aliased function column', () => {
      const p = new Parser();
      const sql = 'SELECT database() name';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).from).toBe(null);
      expect((res as SelectQuery).columns).toEqual([
        { type: 'function', name: 'database', alias: 'name' }
      ]);
    });
    it('should parse star column', () => {
      const p = new Parser();
      const sql = 'SELECT * FROM users';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).columns).toEqual([
        { type: 'star', table: null }
      ]);
    });
    it('should parse star column for specific table', () => {
      const p = new Parser();
      const sql = 'SELECT u.* FROM users u';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).columns).toEqual([
        { type: 'star', table: 'users' }
      ]);
    });
    it('should parse FROM', () => {
      const p = new Parser();
      const sql = 'SELECT * FROM users';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).from).toEqual({
        databaseName: null,
        tableName: 'users',
        alias: null,
      });
    });
    it('should parse aliased FROM', () => {
      const p = new Parser();
      const sql = 'SELECT u.* FROM users u';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).from).toEqual({
        databaseName: null,
        tableName: 'users',
        alias: 'u',
      });
    });
    it('should parse equals expression', () => {
      const p = new Parser();
      const sql = 'SELECT * FROM users u where u.id = 1';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).where).toEqual({
        type: 'binary_expression',
        operator: '=',
        left: { type: 'column_ref', table: 'users', column: 'id' },
        right: { type: 'number', value: 1 },
      });
    });
    it('should parse IN expression', () => {
      const p = new Parser();
      const sql = 'SELECT * FROM users u where u.id IN (1, 2)';
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).where).toEqual({
        type: 'binary_expression',
        operator: 'IN',
        left: { type: 'column_ref', table: 'users', column: 'id' },
        right: { type: 'array', value: [1, 2] },
      });
    });
    it('should parse string values', () => {
      const p = new Parser();
      const sql = `SELECT * FROM users u where u.id IN ('1', "2")`;
      const res = p.parse(sql, []);

      expect(res).toBeInstanceOf(SelectQuery);
      expect((res as SelectQuery).where).toEqual({
        type: 'binary_expression',
        operator: 'IN',
        left: { type: 'column_ref', table: 'users', column: 'id' },
        right: { type: 'array', value: ['1', '2'] },
      });
    });
  });
});
