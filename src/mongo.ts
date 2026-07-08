import { AnyNode, ASTNode, ComparisonNode } from './ast';
import { FieldDefinition, MongoQuery, ODataLiteConfig } from './types';

export class MongoBuilder {
  constructor(private readonly config: ODataLiteConfig) {}

  build(node: ASTNode): MongoQuery {
    if (node.type === 'logical') {
      const mongoOperator = node.operator === 'and' ? '$and' : '$or';

      return {
        [mongoOperator]: [this.build(node.left), this.build(node.right)],
      };
    }

    if (node.type === 'any') {
      return this.buildAny(node);
    }

    const type = this.config.fields[node.field]?.type ?? 'string';

    return this.buildComparison(node, node.field, type);
  }

  private buildAny(node: AnyNode): MongoQuery {
    const itemFields = this.config.fields[node.field]?.items ?? {};

    return {
      [node.field]: { $elemMatch: this.buildPredicate(node.predicate, node.alias, itemFields) },
    };
  }

  private buildPredicate(
    node: ASTNode,
    alias: string,
    itemFields: Record<string, FieldDefinition>,
  ): MongoQuery {
    if (node.type === 'logical') {
      const mongoOperator = node.operator === 'and' ? '$and' : '$or';

      return {
        [mongoOperator]: [
          this.buildPredicate(node.left, alias, itemFields),
          this.buildPredicate(node.right, alias, itemFields),
        ],
      };
    }

    if (node.type === 'any') {
      return this.build(node);
    }

    const prefix = `${alias}/`;
    const resolvedField = node.field.startsWith(prefix)
      ? node.field.slice(prefix.length).replace(/\//g, '.')
      : node.field;

    return this.buildComparison(node, resolvedField, itemFields[resolvedField]?.type ?? 'string');
  }

  private buildComparison(
    node: ComparisonNode,
    field: string,
    type: FieldDefinition['type'],
  ): MongoQuery {
    const operator = this.config.operators[node.operator];

    return operator.toMongo(field, node.value, type);
  }
}
