import { expect } from '../../testing/setup';
import moment from 'moment';
import { MongoBuilder } from '../mongo';
import { testConfig } from './fixtures/testConfig';
import { ASTNode } from '../ast';
import { ODataLiteConfig } from '../types';

describe('MongoBuilder', () => {
  const builder = new MongoBuilder(testConfig);

  it('should build mongo query for comparison', () => {
    const ast: ASTNode = {
      type: 'comparison',
      field: 'order.createdAt',
      operator: 'ge',
      value: '2025-07-01',
    };

    const result = builder.build(ast);

    expect(result).to.deep.equal({
      'order.createdAt': {
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

  it('should build mongo query for an in comparison', () => {
    const ast: ASTNode = {
      type: 'comparison',
      field: 'metadata.status',
      operator: 'in',
      value: ['active', 'pending'],
    };

    const result = builder.build(ast);

    expect(result).to.deep.equal({
      'metadata.status': { $in: ['active', 'pending'] },
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
        field: 'order.createdAt',
        operator: 'ge',
        value: '2025-07-01',
      },
      right: {
        type: 'comparison',
        field: 'order.updatedAt',
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
        'order.createdAt': { type: 'date' },
      },
      operators: testConfig.operators,
    };
    const typedBuilder = new MongoBuilder(config);

    it('should build eq/ne for a date field using the exact UTC instant', () => {
      const eq = typedBuilder.build({
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'eq',
        value: '2025-07-01',
      });

      expect(eq).to.deep.equal({
        'order.createdAt': {
          $eq: moment.utc('2025-07-01').toDate(),
        },
      });
    });

    it('should build gt/lt for a date field using the exact UTC instant', () => {
      const gt = typedBuilder.build({
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'gt',
        value: '2025-07-01',
      });

      expect(gt).to.deep.equal({
        'order.createdAt': {
          $gt: moment.utc('2025-07-01').toDate(),
        },
      });

      const lt = typedBuilder.build({
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'lt',
        value: '2025-07-01',
      });

      expect(lt).to.deep.equal({
        'order.createdAt': {
          $lt: moment.utc('2025-07-01').toDate(),
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

    it('should build in for a number field as a numeric $in list', () => {
      const result = typedBuilder.build({
        type: 'comparison',
        field: 'metadata.amount',
        operator: 'in',
        value: ['100', '200'],
      });

      expect(result).to.deep.equal({ 'metadata.amount': { $in: [100, 200] } });
    });

    it('should build in for a date field as a $in list of exact UTC instants', () => {
      const result = typedBuilder.build({
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'in',
        value: ['2025-07-01', '2025-08-01'],
      });

      expect(result).to.deep.equal({
        'order.createdAt': {
          $in: [moment.utc('2025-07-01').toDate(), moment.utc('2025-08-01').toDate()],
        },
      });
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
        'metadata.groups': {
          type: 'collection',
          items: {
            label: { type: 'string' },
          },
        },
      },
      operators: testConfig.operators,
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

    it('should build a nested any inside an any predicate', () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'any',
          field: 'metadata.groups',
          alias: 'g',
          predicate: {
            type: 'comparison',
            field: 'g/label',
            operator: 'eq',
            value: 'core',
          },
        },
      };

      const result = anyBuilder.build(ast);

      expect(result).to.deep.equal({
        'metadata.tags': {
          $elemMatch: {
            'metadata.groups': { $elemMatch: { label: { $eq: 'core' } } },
          },
        },
      });
    });

    it('should treat a predicate field not prefixed with the alias as a literal item field', () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 'name',
          operator: 'eq',
          value: 'urgent',
        },
      };

      const result = anyBuilder.build(ast);

      expect(result).to.deep.equal({
        'metadata.tags': { $elemMatch: { name: { $eq: 'urgent' } } },
      });
    });
  });
});
