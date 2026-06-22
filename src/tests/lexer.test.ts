import { expect } from '../../testing/setup';
import { Lexer } from '../lexer';
import { ODataLiteError } from '../error';

describe('Lexer', () => {
  it('should tokenize a valid comparison expression', () => {
    const lexer = new Lexer('metadata.accountPeriodBeginDate ge 2025-07-01');

    const tokens = lexer.tokenize();

    expect(tokens).to.deep.equal([
      {
        type: 'identifier',
        value: 'metadata.accountPeriodBeginDate',
      },
      {
        type: 'operator',
        value: 'ge',
      },
      {
        type: 'value',
        value: '2025-07-01',
      },
      {
        type: 'eof',
      },
    ]);
  });

  it('should tokenize chained and expression', () => {
    const lexer = new Lexer(
      'metadata.accountPeriodBeginDate ge 2025-07-01 and metadata.accountPeriodEndDate le 2026-06-30'
    );
    const tokens = lexer.tokenize();
    expect(tokens.some((t) => t.type === 'and')).to.equal(true);
  });

  it('should throw ODataLiteError for invalid characters', () => {
    const lexer = new Lexer('metadata.accountPeriodBeginDate ge 2025/07/01');
    try {
      lexer.tokenize();
      expect.fail('Expected ODataLiteError');
    } catch (err: unknown) {
      expect(err).to.be.instanceOf(ODataLiteError);
      const error = err as ODataLiteError;
      expect(error.code).to.equal('INVALID_CHARACTER');
    }
  });
});
