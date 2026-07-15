export interface FieldDefinition {
  type: 'date' | 'string' | 'number' | 'boolean' | 'collection';
  operators?: string[];
  /** Whitelisted sub-fields for a `collection` field, keyed by their dotted path within each element. Required when `type` is `collection`. */
  items?: Record<string, FieldDefinition>;
}

export interface OperatorDefinition {
  allowedTypes: string[];
  toMongo: (
    field: string,
    value: string | string[],
    type: FieldDefinition['type'],
  ) => Record<string, unknown>;
}

export interface ODataLiteConfig {
  fields: Record<string, FieldDefinition>;
  operators: Record<string, OperatorDefinition>;
}

export type MongoQuery = Record<string, unknown>;
