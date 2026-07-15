export type ASTNode = LogicalNode | ComparisonNode | AnyNode;

export interface LogicalNode {
  type: 'logical';
  operator: 'and' | 'or';
  left: ASTNode;
  right: ASTNode;
}

export interface ComparisonNode {
  type: 'comparison';
  field: string;
  operator: string;
  value: string | string[];
}

export interface AnyNode {
  type: 'any';
  field: string;
  alias: string;
  predicate: ASTNode;
}
