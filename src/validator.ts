import { ASTNode, ComparisonNode } from './ast';
import { ODataLiteConfig } from './types';
import { ODataLiteError } from './error';
import { ODataDateSchema } from './schemas/date.schema';

export class Validator {
  constructor(private readonly config: ODataLiteConfig) {}

  validate(node: ASTNode): void {
    if (node.type === 'logical') {
      this.validate(node.left);
      this.validate(node.right);

      return;
    }

    this.validateComparison(node);
  }

  private validateComparison(node: ComparisonNode): void {
    const fieldConfig = this.config.fields[node.field];

    if (!fieldConfig) {
      throw new ODataLiteError({
        code: 'INVALID_FIELD',
        message: `Field '${node.field}' is not allowed in OData filter`,
        token: node.field,
      });
    }

    const operatorConfig = this.config.operators[node.operator];

    if (!operatorConfig) {
      throw new ODataLiteError({
        code: 'INVALID_OPERATOR',
        message: `Operator '${node.operator}' is not supported`,
        token: node.operator,
      });
    }

    if (!operatorConfig.allowedTypes.includes(fieldConfig.type)) {
      throw new ODataLiteError({
        code: 'OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE',
        message: `Operator '${node.operator}' is not allowed for field type '${fieldConfig.type}'`,
        token: node.operator,
      });
    }

    if (fieldConfig.type === 'date') {
      this.validateDate(node.value);
    }
  }

  private validateDate(value: string): void {
    const result = ODataDateSchema.safeParse(value);
    if (!result.success) {
      throw new ODataLiteError({
        code: 'INVALID_VALUE',
        message: `Invalid date value '${value}'`,
        token: value,
      });
    }
  }
}
