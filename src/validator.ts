import { ASTNode, AnyNode, ComparisonNode } from './ast';
import { FieldDefinition, ODataLiteConfig } from './types';
import { ODataLiteError } from './error';
import { ODataDateSchema } from './schemas/date.schema';

interface LambdaContext {
  alias: string;
  itemFields: Record<string, FieldDefinition>;
}

export class Validator {
  constructor(private readonly config: ODataLiteConfig) {}

  validate(node: ASTNode, context?: LambdaContext): void {
    if (node.type === 'logical') {
      this.validate(node.left, context);
      this.validate(node.right, context);

      return;
    }

    if (node.type === 'any') {
      this.validateAny(node);
      return;
    }

    this.validateComparison(node, context);
  }

  private validateAny(node: AnyNode): void {
    const fieldConfig = this.config.fields[node.field];

    if (!fieldConfig) {
      throw new ODataLiteError({
        code: 'INVALID_FIELD',
        message: `Field '${node.field}' is not allowed in OData filter`,
        token: node.field,
      });
    }

    if (fieldConfig.type !== 'collection' || !fieldConfig.items) {
      throw new ODataLiteError({
        code: 'FIELD_NOT_A_COLLECTION',
        message: `Field '${node.field}' does not support the 'any' operator`,
        token: node.field,
      });
    }

    this.validate(node.predicate, { alias: node.alias, itemFields: fieldConfig.items });
  }

  private validateComparison(node: ComparisonNode, context?: LambdaContext): void {
    const fieldConfig = this.resolveFieldConfig(node, context);

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
      if (Array.isArray(node.value)) {
        node.value.forEach((value) => this.validateDate(value));
      } else {
        this.validateDate(node.value);
      }
    }
  }

  private resolveFieldConfig(
    node: ComparisonNode,
    context?: LambdaContext,
  ): FieldDefinition | undefined {
    if (!context) {
      return this.config.fields[node.field];
    }

    const prefix = `${context.alias}/`;

    if (!node.field.startsWith(prefix)) {
      throw new ODataLiteError({
        code: 'INVALID_ALIAS_REFERENCE',
        message: `Field '${node.field}' must reference the lambda alias '${context.alias}'`,
        token: node.field,
      });
    }

    const resolvedField = node.field.slice(prefix.length).replace(/\//g, '.');

    return context.itemFields[resolvedField];
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
