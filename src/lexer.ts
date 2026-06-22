import { ODataLiteError } from './error';
export type Token =
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'value'; value: string }
  | { type: 'and' }
  | { type: 'eof' };

export class Lexer {
  private i = 0;

  constructor(private input: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.i < this.input.length) {
      const c = this.input[this.i];

      if (/\s/.test(c)) {
        this.i++;
        continue;
      }

      if (/[a-zA-z_.]/.test(c)) {
        tokens.push(this.readWord());
        continue;
      }

      if (/[0-9]/.test(c)) {
        tokens.push(this.readValue());
        continue;
      }

      throw new ODataLiteError({
        code: 'INVALID_CHARACTER',
        message: `Unexpected character '${c}' encountered while tokenising filter`,
        token: c,
        position: this.i,
      });
    }
    tokens.push({ type: 'eof' });

    return tokens;
  }

  private readWord(): Token {
    let value = '';

    while (
      this.i < this.input.length &&
      /[a-zA-Z0-9_.]/.test(this.input[this.i])
    ) {
      value += this.input[this.i];
      this.i++;
    }

    if (value === 'and') {
      return { type: 'and' };
    }

    if (value == 'ge' || value == 'le' || value === 'gt' || value === 'lt') {
      return {
        type: 'operator',
        value,
      };
    }

    return {
      type: 'identifier',
      value,
    };
  }

  private readValue(): Token {
    let value = '';

    while (
      this.i < this.input.length &&
      /[a-zA-Z0-9\-:T.Z]/.test(this.input[this.i])
    ) {
      value += this.input[this.i];
      this.i++;
    }

    return {
      type: 'value',
      value,
    };
  }
}
