import { ASTNode } from './ast';
import { Token } from './lexer';
import { ODataLiteError } from './error';

export class Parser {
  private current = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ASTNode {
    try {
      return this.parseOr();
    } catch {
      throw new ODataLiteError({
        code: 'UNEXPECTED_TOKEN',
        message: `Unexpected token. Not an AND operation.`,
      });
    }
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.match('or')) {
      const right = this.parseAnd();

      left = {
        type: 'logical',
        operator: 'or',
        left,
        right,
      };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parsePrimary();

    while (this.match('and')) {
      const right = this.parsePrimary();

      left = {
        type: 'logical',
        operator: 'and',
        left,
        right,
      };
    }
    return left;
  }

  private parsePrimary(): ASTNode {
    let field = this.consume('identifier').value;

    while (this.match('slash')) {
      if (this.check('any')) {
        return this.parseAny(field);
      }

      field += '/' + this.consume('identifier').value;
    }

    const operator = this.consume('operator').value;

    if (operator === 'in') {
      return {
        type: 'comparison',
        field,
        operator,
        value: this.parseValueList(),
      };
    }

    const value = this.consume('value').value;

    if (!field || !operator || !value) {
      throw new ODataLiteError({
        code: 'UNEXPECTED_TOKEN',
        message: `Not a valid syntax received in the filter.`,
      });
    }

    return {
      type: 'comparison',
      field,
      operator,
      value,
    };
  }

  private parseValueList(): string[] {
    this.consume('lparen');
    const values = [this.consume('value').value];

    while (this.match('comma')) {
      values.push(this.consume('value').value);
    }

    this.consume('rparen');

    return values;
  }

  private parseAny(field: string): ASTNode {
    this.consume('any');
    this.consume('lparen');
    const alias = this.consume('identifier').value;
    this.consume('colon');
    const predicate = this.parseOr();
    this.consume('rparen');

    return {
      type: 'any',
      field,
      alias,
      predicate,
    };
  }

  private check(type: Token['type']): boolean {
    return this.tokens[this.current]?.type === type;
  }

  private match(type: Token['type']): boolean {
    const token = this.tokens[this.current];

    if (token?.type === type) {
      this.current++;
      return true;
    }
    return false;
  }

  private consume<T extends Token['type']>(type: T): Extract<Token, { type: T }> {
    const token = this.tokens[this.current];

    if (token.type !== type) {
      throw new ODataLiteError({
        code: 'UNEXPECTED_TOKEN',
        message: `Expected token '${type}' but received '${token.type}'`,
        token: token.type,
      });
    }

    this.current++;

    return token as Extract<Token, { type: T }>;
  }
}
