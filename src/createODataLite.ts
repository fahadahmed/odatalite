import { Lexer } from './lexer';
import { MongoBuilder } from './mongo';
import { Parser } from './parser';
import { ODataLiteConfig, MongoQuery } from './types';
import { Validator } from './validator';
import { ASTNode } from './ast';

export interface ODataLite {
  parse(input: string): ASTNode;
  toMongo(ast: ASTNode): MongoQuery;
}

export function createODataLite(config: ODataLiteConfig): ODataLite {
  const validator = new Validator(config);
  const mongoBuilder = new MongoBuilder(config);

  return {
    parse(input: string): ASTNode {
      const lexer = new Lexer(input);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      const ast = parser.parse();
      validator.validate(ast);

      return ast;
    },

    toMongo(ast: ASTNode): MongoQuery {
      return mongoBuilder.build(ast);
    },
  };
}
