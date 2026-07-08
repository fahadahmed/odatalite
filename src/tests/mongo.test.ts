import { expect } from '../../testing/setup';
import moment from 'moment';
import { MongoBuilder } from '../mongo';
import { odataConfig } from '../config/odata.config';
import { ODataLiteError } from '../error';
import { ASTNode } from '../ast';
import { ODataLiteConfig } from '../types';

describe('MongoBuilder', () => {
  const builder = new MongoBuilder(odataConfig);

  it('should build mongo query for comparison', () => {
    const ast: ASTNode = {
      type: 'comparison',
      field: 'metadata.accountPeriodBeginDate',
      operator: 'ge',
      value: '2025-07-01',
    };

    const result = builder.build(ast);

    expect(result).to.deep.equal({
      'metadata.accountPeriodBeginDate': {
        $gte: moment('2025-07-01').startOf('day').toDate(),
      },
    });
  });

  it('should build mongo query for an eq comparison', () => {
    const ast: ASTNode = {
      type: 'comparison',
      field: 'metadata.status',
      operator: 'eq',
      value: 'active',
    };

    const result = builder.build(ast);

    expect(result).to.deep.equal({
      'metadata.status': { $eq: 'active' },
    });
  });

  it('should build mongo query for a ne comparison', () => {
    const ast: ASTNode = {
      type: 'comparison',
      field: 'metadata.status',
      operator: 'ne',
      value: 'active',
    };

    const result = builder.build(ast);

    expect(result).to.deep.equal({
      'metadata.status': { $ne: 'active' },
    });
  });

  it('should build mongo query for a logical or expression', () => {
    const ast: ASTNode = {
      type: 'logical',
      operator: 'or',
      left: {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'eq',
        value: 'active',
      },
      right: {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'eq',
        value: 'pending',
      },
    };

    const result = builder.build(ast);

    expect(result).to.have.property('$or');
  });

  it('should build mongo quer for logical expression', () => {
    const ast: ASTNode = {
      type: 'logical',
      operator: 'and',
      left: {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'ge',
        value: '2025-07-01',
      },
      right: {
        type: 'comparison',
        field: 'metadata.accountPeriodEndDate',
        operator: 'le',
        value: '2026-06-30',
      },
    };

    const result = builder.build(ast);

    expect(result).to.have.property('$and');
  });

  describe('type conversion across field types', () => {
    const config: ODataLiteConfig = {
      fields: {
        'metadata.status': { type: 'string' },
        'metadata.amount': { type: 'number' },
        'metadata.isActive': { type: 'boolean' },
        'metadata.accountPeriodBeginDate': { type: 'date' },
      },
      operators: odataConfig.operators,
    };
    const typedBuilder = new MongoBuilder(config);

    it('should build eq/ne for a date field using day boundaries', () => {
      const eq = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'eq',
        value: '2025-07-01',
      });

      expect(eq).to.deep.equal({
        'metadata.accountPeriodBeginDate': {
          $eq: moment('2025-07-01').startOf('day').toDate(),
        },
      });
    });

    it('should build gt/lt for a number field as numeric comparisons', () => {
      const gt = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.amount',
        operator: 'gt',
        value: '100',
      });

      expect(gt).to.deep.equal({ 'metadata.amount': { $gt: 100 } });

      const lt = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.amount',
        operator: 'lt',
        value: '100',
      });

      expect(lt).to.deep.equal({ 'metadata.amount': { $lt: 100 } });
    });

    it('should build eq/ne for a boolean field as boolean comparisons', () => {
      const eq = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.isActive',
        operator: 'eq',
        value: 'true',
      });

      expect(eq).to.deep.equal({ 'metadata.isActive': { $eq: true } });

      const ne = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.isActive',
        operator: 'ne',
        value: 'false',
      });

      expect(ne).to.deep.equal({ 'metadata.isActive': { $ne: false } });
    });

    it('should build ge/le for a string field as lexicographic comparisons', () => {
      const ge = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.status',
        operator: 'ge',
        value: 'active',
      });

      expect(ge).to.deep.equal({ 'metadata.status': { $gte: 'active' } });
    });
  });

  describe('any operator', () => {
    const config: ODataLiteConfig = {
      fields: {
        'metadata.tags': {
          type: 'collection',
          items: {
            name: { type: 'string' },
            priority: { type: 'number' },
          },
        },
      },
      operators: odataConfig.operators,
    };
    const anyBuilder = new MongoBuilder(config);

    it('should build an elemMatch query for a simple any predicate', () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 't/name',
          operator: 'eq',
          value: 'urgent',
        },
      };

      const result = anyBuilder.build(ast);

      expect(result).to.deep.equal({
        'metadata.tags': { $elemMatch: { name: { $eq: 'urgent' } } },
      });
    });

    it('should resolve the sub-field type declared under items', () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 't/priority',
          operator: 'gt',
          value: '5',
        },
      };

      const result = anyBuilder.build(ast);

      expect(result).to.deep.equal({
        'metadata.tags': { $elemMatch: { priority: { $gt: 5 } } },
      });
    });

    it('should build a logical predicate inside an any as $and', () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'logical',
          operator: 'and',
          left: {
            type: 'comparison',
            field: 't/name',
            operator: 'eq',
            value: 'urgent',
          },
          right: {
            type: 'comparison',
            field: 't/priority',
            operator: 'gt',
            value: '5',
          },
        },
      };

      const result = anyBuilder.build(ast);

      expect(result).to.deep.equal({
        'metadata.tags': {
          $elemMatch: {
            $and: [{ name: { $eq: 'urgent' } }, { priority: { $gt: 5 } }],
          },
        },
      });
    });
  });
});
