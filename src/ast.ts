export type ASTNode = LogicalNode | ComparisonNode;

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
  value: string;
}
