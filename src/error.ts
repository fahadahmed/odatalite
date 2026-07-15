export type ODataLiteErrorCode =
  | 'INVALID_CHARACTER'
  | 'INVALID_SYNTAX'
  | 'INVALID_FIELD'
  | 'INVALID_OPERATOR'
  | 'OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE'
  | 'INVALID_VALUE'
  | 'UNEXPECTED_TOKEN'
  | 'FIELD_NOT_A_COLLECTION'
  | 'INVALID_ALIAS_REFERENCE';

export interface ODataLiteErrorOptions {
  code: ODataLiteErrorCode;
  message: string;
  token?: string;
  position?: number;
}

export class ODataLiteError extends Error {
  public readonly code: ODataLiteErrorCode;
  public readonly token?: string;
  public readonly postion?: number;

  constructor(options: ODataLiteErrorOptions) {
    super(options.message);

    this.name = 'ODataLiteError';
    this.code = options.code;
    this.token = options.token;
    this.postion = options.position;
  }
}
