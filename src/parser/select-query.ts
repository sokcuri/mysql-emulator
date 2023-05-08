import { Select } from 'node-sql-parser';
import { BinaryExpression, buildExpression, ColumnRef, Expression, FunctionType, Star } from './expression';

export type From = {
  database: string | null;
  table: string;
  join: 'INNER JOIN' | 'LEFT JOIN' | 'RIGHT JOIN' | null;
  on: Expression | null;
};

type WithAlias<T> = T & { alias: string | null };
export type SelectColumn =
  | WithAlias<ColumnRef>
  | WithAlias<FunctionType & { column: string }>
  | WithAlias<BinaryExpression & { column: string }>
  | Star;
export type OrderBy = ColumnRef & { order: 'ASC' | 'DESC' };

export class SelectQuery {
  constructor(
    public from: From[],
    public columns: SelectColumn[],
    public where: Expression | null,
    public groupBy: ColumnRef[],
    public orderBy: OrderBy[],
    public limit: number,
    public offset: number,
  ) {}

  static fromAst(ast: Select): SelectQuery {
    const tableAliases = new Map<string, string>();
    (ast.from || []).forEach(f => f.as && tableAliases.set(f.as, f.table));
    const from = (ast.from || []).map(f => ({
      database: f.db || null,
      table: f.table,
      join: f.join || null,
      on: f.on ? buildExpression(f.on, tableAliases) : null,
    }));

    const columns = [...ast.columns].map((c): SelectColumn => {
      if (c === '*') {
        return buildExpression({ type: 'star', value: c }, tableAliases) as Star;
      } else if (c.expr?.type === 'column_ref' && c.expr.column === '*') {
        return buildExpression(c.expr, tableAliases) as Star;
      } else if (c.expr?.type === 'column_ref') {
        return {
          ...buildExpression(c.expr, tableAliases) as ColumnRef,
          alias: c.as,
        };
      } else if (['binary_expr', 'aggr_func', 'function'].includes(c.expr?.type)) {
        return {
          ...buildExpression(c.expr, tableAliases) as FunctionType | BinaryExpression,
          // todo: build column name
          column: ['aggr_func', 'function'].includes(c.expr?.type)
            ? `${c.expr.name}()`
            : '',
          alias: c.as,
        };
      }
      throw new Error('Could not map columns');
    });
    const groupBy: ColumnRef[] = (ast.groupby || []).map(g => (
      buildExpression(g, tableAliases) as ColumnRef
    ));
    const orderBy: OrderBy[] = (ast.orderby || []).map(o => ({
      ...buildExpression(o.expr, tableAliases),
      order: o.type,
    } as OrderBy));
    let limit = 0;
    let offset = 0;
    if (ast.limit?.value.length === 1) {
      [{ value: limit }] = ast.limit?.value;
    } else if (ast.limit?.value.length === 2 && ast.limit?.seperator === ',') {
      [{ value: offset }, { value: limit }] = ast.limit?.value;
    } else if (ast.limit?.value.length === 2 && ast.limit?.seperator === 'offset') {
      [{ value: limit }, { value: offset }] = ast.limit?.value;
    }

    return new SelectQuery(
      from,
      columns,
      ast.where ? buildExpression(ast.where, tableAliases) : null,
      groupBy,
      orderBy,
      limit,
      offset,
    );
  }
}
