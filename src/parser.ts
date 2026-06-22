import { ASTNode } from './ast';
import { Token } from './lexer';
import { ODataLiteError } from './error';

export class Parser {
  private current = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ASTNode {
    try {
      return this.parseAnd();
    } catch {
      throw new ODataLiteError({
        code: 'UNEXPECTED_TOKEN',
        message: `Unexpected token. Not an AND operation.`,
      });
    }
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison();

    while (this.match('and')) {
      const right = this.parseComparison();

      left = {
        type: 'logical',
        operator: 'and',
        left,
        right,
      };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    const field = this.consume('identifier').value;
    const operator = this.consume('operator').value;
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

    if (!token || token.type !== type) {
      throw new ODataLiteError({
        code: 'UNEXPECTED_TOKEN',
        message: `Expected token '${type}' but received '${token.type ?? 'EOF'}'`,
        token: token?.type,
      });
    }

    this.current++;

    return token as Extract<Token, { type: T }>;
  }
}
