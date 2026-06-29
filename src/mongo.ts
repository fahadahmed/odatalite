import { ASTNode } from './ast';
import { MongoQuery, ODataLiteConfig } from './types';

export class MongoBuilder {
  constructor(private readonly config: ODataLiteConfig) {}

  build(node: ASTNode): MongoQuery {
    if (node.type == 'logical') {
      const mongoOperator = node.operator === 'and' ? '$and' : '$or';

      return {
        [mongoOperator]: [this.build(node.left), this.build(node.right)],
      };
    }

    const operator = this.config.operators[node.operator];
    return operator.toMongo(node.field, node.value);
  }
}
