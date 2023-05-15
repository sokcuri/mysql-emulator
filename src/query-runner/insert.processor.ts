import { Column, IntegerColumn, Server } from '../server';
import { ColumnRef, InsertQuery } from '../parser';
import { Evaluator } from './evaluator';
import { ServerError } from '../server/server-error';
import { ProcessorError } from './processor-error';

export class InsertProcessor {
  constructor(protected server: Server) {}

  process(query: InsertQuery) {
    const db = this.server.getDatabase(query.database);
    const table = db.getTable(query.table);
    const columnDefinitions = table.getColumns();
    const columnDefinitionMap = new Map<string, Column>(
      columnDefinitions.map((c) => [c.getName(), c])
    );
    const evaluator = new Evaluator(
      this.server,
      columnDefinitions.map(c => `${query.table}::${c.getName()}`),
    );
    const columns = query.columns || columnDefinitions.map(c => c.getName());
    const getColumnDefinition = (column: string): Column => {
      const c = columnDefinitionMap.get(column);
      if (!c) {
        throw new ProcessorError(`Unknown column '${column}' in 'field list'`);
      }
      return c;
    };
    const evaluateDefaultValue = (column: Column, row: Object): any | null => {
      if (column instanceof IntegerColumn && column.hasAutoIncrement()) {
        return column.getNextAutoIncrementValue();
      }
      const defaultValue = column.getDefaultValueExpression();
      if (defaultValue) {
        return evaluator.evaluateExpression(defaultValue, row);
      }
      return null;
    };

    let insertId = 0;
    let affectedRows = 0;
    query.values.forEach((values, rowIndex) => {
      if (values.length !== columns.length) {
        throw new ProcessorError(`Column count doesn't match value count at row ${rowIndex + 1}`);
      }
      const rawRow = values.reduce((res, expression, valueIndex) => ({
        ...res,
        [`${query.table}::${columns[valueIndex]}`]: expression.type === 'default'
          ? evaluateDefaultValue(getColumnDefinition(columns[valueIndex]), res)
          : evaluator.evaluateExpression(expression, res),
      }), {});
      const row = columnDefinitions.reduce((res, c) => {
        const columnRef: ColumnRef = {
          type: 'column_ref',
          table: query.table,
          column: c.getName(),
        };
        const value = evaluator.evaluateExpression(columnRef, rawRow) ?? evaluateDefaultValue(c, rawRow);
        if (value === null && !c.isNullable()) {
          throw new ProcessorError(`Field '${c.getName()}' doesn't have a default value`);
        }
        if (c instanceof IntegerColumn && c.hasAutoIncrement()) {
          insertId = value;
        }
        try {
          return {
            ...res,
            [c.getName()]: c.cast(value),
          }
        } catch (err: any) {
          if (['OUT_OF_RANGE_VALUE', 'INCORRECT_INTEGER_VALUE'].includes(err.code)) {
            throw new ProcessorError(`${err.message} at row ${rowIndex + 1}`);
          }
          throw err;
        }
      }, {});
      table.insertRow(row);
      affectedRows++;
    });

    return { affectedRows, insertId };
  }
}
