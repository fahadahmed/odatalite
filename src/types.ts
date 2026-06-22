export interface FieldDefinition {
  type: 'date' | 'string' | 'number' | 'boolean';
  operators?: string[];
}

export interface OperatorDefinition {
  allowedTypes: string[];
  toMongo: (field: string, value: string) => Record<string, unknown>;
}

export interface ODataLiteConfig {
  fields: Record<string, FieldDefinition>;
  operators: Record<string, OperatorDefinition>;
}

export type MongoQuery = Record<string, unknown>;
