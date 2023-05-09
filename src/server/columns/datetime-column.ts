import { Column } from '../column';
import { Expression } from '../../parser';

export class DatetimeColumn extends Column {
  constructor(
    name: string,
    nullable: boolean,
    defaultValue: Expression | null,
  ) {
    super(name, nullable, defaultValue);
  }
}
