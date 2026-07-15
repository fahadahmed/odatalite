import { expect } from '../../testing/setup';
import moment from 'moment';
import { createODataLite } from '../createODataLite';
import { testConfig } from './fixtures/testConfig';
import { ODataLiteError } from '../error';
import { ODataLiteConfig } from '../types';

describe('createODataLite', () => {
  const odata = createODataLite(testConfig);

  it('should parse and convert a comparison to a mongo query', () => {
    const ast = odata.parse('order.createdAt ge 2025-07-01');

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'order.createdAt',
      operator: 'ge',
      value: '2025-07-01',
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'order.createdAt': {
        $gte: moment('2025-07-01').startOf('day').toDate(),
      },
    });
  });

  it('should parse and convert a logical and expression to a mongo query', () => {
    const ast = odata.parse('order.createdAt ge 2025-07-01 and order.updatedAt le 2026-06-30');

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.have.property('$and');
  });

  it('should throw ODataLiteError when the filter has invalid syntax', () => {
    expect(() => odata.parse('order.createdAt ge')).to.throw(ODataLiteError);
  });

  it('should parse and convert an any lambda expression to a mongo query', () => {
    const collectionConfig: ODataLiteConfig = {
      fields: {
        ...testConfig.fields,
        'metadata.tags': {
          type: 'collection',
          items: {
            name: { type: 'string' },
          },
        },
      },
      operators: testConfig.operators,
    };
    const collectionOdata = createODataLite(collectionConfig);

    const ast = collectionOdata.parse("metadata.tags/any(t: t/name eq 'urgent')");

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

    const mongoQuery = collectionOdata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'metadata.tags': { $elemMatch: { name: { $eq: 'urgent' } } },
    });
  });

  it('should parse and convert an in comparison to a mongo query', () => {
    const stringConfig: ODataLiteConfig = {
      fields: {
        'metadata.status': { type: 'string' },
      },
      operators: testConfig.operators,
    };
    const stringOdata = createODataLite(stringConfig);

    const ast = stringOdata.parse("metadata.status in ('active','pending')");

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.status',
      operator: 'in',
      value: ['active', 'pending'],
    });

    const mongoQuery = stringOdata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'metadata.status': { $in: ['active', 'pending'] },
    });
  });

  it('should parse and convert an in comparison with dates to a mongo query', () => {
    const ast = odata.parse('order.createdAt in (2025-07-01,2025-08-01)');

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'order.createdAt',
      operator: 'in',
      value: ['2025-07-01', '2025-08-01'],
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'order.createdAt': {
        $in: [moment.utc('2025-07-01').toDate(), moment.utc('2025-08-01').toDate()],
      },
    });
  });

  it('should throw ODataLiteError when an in comparison contains an invalid date', () => {
    expect(() => odata.parse('order.createdAt in (2025-07-01,07-01-2025)')).to.throw(
      ODataLiteError,
    );
  });

  it('should throw ODataLiteError when the field is not whitelisted', () => {
    expect(() => odata.parse('invalid.field ge 2025-07-01')).to.throw(ODataLiteError);
  });

  it('should parse and convert an any lambda expression on order.items', () => {
    const ast = odata.parse("order.items/any(i: i/sku eq 'ABC-123')");

    expect(ast).to.deep.equal({
      type: 'any',
      field: 'order.items',
      alias: 'i',
      predicate: {
        type: 'comparison',
        field: 'i/sku',
        operator: 'eq',
        value: 'ABC-123',
      },
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'order.items': {
        $elemMatch: { sku: { $eq: 'ABC-123' } },
      },
    });
  });

  it('should parse and convert an any lambda expression on order.events', () => {
    const ast = odata.parse("order.events/any(e: e/type eq 'shipped' and e/sequence eq 42)");

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'order.events': {
        $elemMatch: {
          $and: [{ type: { $eq: 'shipped' } }, { sequence: { $eq: 42 } }],
        },
      },
    });
  });

  it('should combine an any lambda expression with a top-level comparison via and', () => {
    const ast = odata.parse('order.items/any(i:i/stock ge 300) and order.createdAt ge 2027-07-01');

    expect(ast).to.deep.equal({
      type: 'logical',
      operator: 'and',
      left: {
        type: 'any',
        field: 'order.items',
        alias: 'i',
        predicate: {
          type: 'comparison',
          field: 'i/stock',
          operator: 'ge',
          value: '300',
        },
      },
      right: {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'ge',
        value: '2027-07-01',
      },
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      $and: [
        {
          'order.items': {
            $elemMatch: { stock: { $gte: 300 } },
          },
        },
        {
          'order.createdAt': {
            $gte: moment('2027-07-01').startOf('day').toDate(),
          },
        },
      ],
    });
  });

  it('should throw ODataLiteError when a slash-joined path is used instead of the dotted collection key', () => {
    expect(() => odata.parse('order/items/any(i:i/stock ge 300)')).to.throw(ODataLiteError);
  });
});
