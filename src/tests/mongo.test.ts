import { expect } from '../../testing/setup';
import moment from 'moment';
import { MongoBuilder } from '../mongo';
import { odataConfig } from '../config/odata.config';
import { ODataLiteError } from '../error';
import { ASTNode } from '../ast';

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
});
