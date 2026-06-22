import { expect } from '../../testing/setup';
import { Lexer } from '../lexer';
import { Parser } from '../parser';
import { ODataLiteError } from '../error';

describe('Parser', () => {
  it('should parse a comparison expression', () => {
    const tokens = new Lexer('metadata.accountPeriodBeginDate ge 2025-07-01').tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.accountPeriodBeginDate',
      operator: 'ge',
      value: '2025-07-01',
    });
  });

  it('should parse logical and expressions', () => {
    const tokens = new Lexer(
      'metadata.accountPeriodBeginDate ge 2025-07-01 and metadata.accountPeriodEndDate le 2026-06-30'
    ).tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast.type).to.equal('logical');
  });

  it('should throw ODataLiteError for malformed expression', () => {
    const tokens = new Lexer('metadata.accountPeriodBeginDate ge').tokenize();
    const parser = new Parser(tokens);
    try {
      parser.parse();
      expect.fail('Expected ODataLiteError');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(ODataLiteError);
      const error = err as ODataLiteError;
      expect(error.code).to.equal('UNEXPECTED_TOKEN');
    }
  });
});
