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

  it('should parse an eq comparison expression', () => {
    const tokens = new Lexer("metadata.status eq 'active'").tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.status',
      operator: 'eq',
      value: 'active',
    });
  });

  it('should parse logical or expressions', () => {
    const tokens = new Lexer(
      "metadata.status eq 'active' or metadata.status eq 'pending'"
    ).tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    expect(ast.type).to.equal('logical');
    expect((ast as { operator: string }).operator).to.equal('or');
  });

  it('should parse and with higher precedence than or', () => {
    const tokens = new Lexer(
      "metadata.status eq 'active' and metadata.accountPeriodBeginDate ge 2025-07-01 or metadata.status eq 'pending'"
    ).tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.type).to.equal('logical');
    expect((ast as { operator: string }).operator).to.equal('or');
    expect((ast as { left: { type: string; operator: string } }).left.type).to.equal('logical');
    expect((ast as { left: { type: string; operator: string } }).left.operator).to.equal('and');
  });

  it('should parse an any lambda expression', () => {
    const tokens = new Lexer("metadata.tags/any(t: t/name eq 'urgent')").tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'any',
      field: 'metadata.tags',
      alias: 't',
      predicate: {
        type: 'comparison',
        field: 't/name',
        operator: 'eq',
        value: 'urgent',
      },
    });
  });

  it('should parse an any lambda expression with a logical predicate', () => {
    const tokens = new Lexer(
      "metadata.tags/any(t: t/name eq 'urgent' and t/priority gt 5)"
    ).tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.type).to.equal('any');
    expect((ast as { predicate: { type: string } }).predicate.type).to.equal('logical');
  });

  it('should parse an in comparison expression with a value list', () => {
    const tokens = new Lexer("metadata.status in ('active','pending')").tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.status',
      operator: 'in',
      value: ['active', 'pending'],
    });
  });

  it('should parse an in comparison expression with a single value', () => {
    const tokens = new Lexer("metadata.status in ('active')").tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.status',
      operator: 'in',
      value: ['active'],
    });
  });

  it('should parse an in comparison expression with date values', () => {
    const tokens = new Lexer(
      'metadata.accountPeriodBeginDate in (2025-07-01,2025-08-01)'
    ).tokenize();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.accountPeriodBeginDate',
      operator: 'in',
      value: ['2025-07-01', '2025-08-01'],
    });
  });

  it('should throw ODataLiteError for an empty quoted value', () => {
    const tokens = new Lexer("metadata.status eq ''").tokenize();
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
