import { expect } from '../../testing/setup';
import moment from 'moment';
import { createODataLite } from '../createODataLite';
import { odataConfig } from '../config/odata.config';
import { ODataLiteError } from '../error';
import { ODataLiteConfig } from '../types';

describe('createODataLite', () => {
  const odata = createODataLite(odataConfig);

  it('should parse and convert a comparison to a mongo query', () => {
    const ast = odata.parse('metadata.accountPeriodBeginDate ge 2025-07-01');

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.accountPeriodBeginDate',
      operator: 'ge',
      value: '2025-07-01',
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'metadata.accountPeriodBeginDate': {
        $gte: moment('2025-07-01').startOf('day').toDate(),
      },
    });
  });

  it('should parse and convert a logical and expression to a mongo query', () => {
    const ast = odata.parse(
      'metadata.accountPeriodBeginDate ge 2025-07-01 and metadata.accountPeriodEndDate le 2026-06-30'
    );

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.have.property('$and');
  });

  it('should throw ODataLiteError when the filter has invalid syntax', () => {
    expect(() => odata.parse('metadata.accountPeriodBeginDate ge')).to.throw(
      ODataLiteError
    );
  });

  it('should parse and convert an any lambda expression to a mongo query', () => {
    const collectionConfig: ODataLiteConfig = {
      fields: {
        ...odataConfig.fields,
        'metadata.tags': {
          type: 'collection',
          items: {
            name: { type: 'string' },
          },
        },
      },
      operators: odataConfig.operators,
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
      operators: odataConfig.operators,
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
    const ast = odata.parse('metadata.accountPeriodBeginDate in (2025-07-01,2025-08-01)');

    expect(ast).to.deep.equal({
      type: 'comparison',
      field: 'metadata.accountPeriodBeginDate',
      operator: 'in',
      value: ['2025-07-01', '2025-08-01'],
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'metadata.accountPeriodBeginDate': {
        $in: [moment.utc('2025-07-01').toDate(), moment.utc('2025-08-01').toDate()],
      },
    });
  });

  it('should throw ODataLiteError when an in comparison contains an invalid date', () => {
    expect(() =>
      odata.parse('metadata.accountPeriodBeginDate in (2025-07-01,07-01-2025)')
    ).to.throw(ODataLiteError);
  });

  it('should throw ODataLiteError when the field is not whitelisted', () => {
    expect(() => odata.parse('invalid.field ge 2025-07-01')).to.throw(
      ODataLiteError
    );
  });

  it('should parse and convert an any lambda expression on factSubjectClient.subjectClients', () => {
    const ast = odata.parse(
      "factSubjectClient.subjectClients/any(c: c/clientIdentifierValueID eq '428578998')"
    );

    expect(ast).to.deep.equal({
      type: 'any',
      field: 'factSubjectClient.subjectClients',
      alias: 'c',
      predicate: {
        type: 'comparison',
        field: 'c/clientIdentifierValueID',
        operator: 'eq',
        value: '428578998',
      },
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'factSubjectClient.subjectClients': {
        $elemMatch: { clientIdentifierValueID: { $eq: '428578998' } },
      },
    });
  });

  it('should parse and convert an any lambda expression on interactionLink.related', () => {
    const ast = odata.parse(
      "interactionLink.related/any(r: r/linkName eq 'taxRtnTrst' and r/transactionID eq 3200000000001)"
    );

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      'interactionLink.related': {
        $elemMatch: {
          $and: [
            { linkName: { $eq: 'taxRtnTrst' } },
            { transactionID: { $eq: 3200000000001 } },
          ],
        },
      },
    });
  });

  it('should combine an any lambda expression with a top-level comparison via and', () => {
    const ast = odata.parse(
      'factSubjectClient.subjectClients/any(c:c/statusCode ge 300) and metadata.accountPeriodBeginDate ge 2027-07-01'
    );

    expect(ast).to.deep.equal({
      type: 'logical',
      operator: 'and',
      left: {
        type: 'any',
        field: 'factSubjectClient.subjectClients',
        alias: 'c',
        predicate: {
          type: 'comparison',
          field: 'c/statusCode',
          operator: 'ge',
          value: '300',
        },
      },
      right: {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'ge',
        value: '2027-07-01',
      },
    });

    const mongoQuery = odata.toMongo(ast);

    expect(mongoQuery).to.deep.equal({
      $and: [
        {
          'factSubjectClient.subjectClients': {
            $elemMatch: { statusCode: { $gte: 300 } },
          },
        },
        {
          'metadata.accountPeriodBeginDate': {
            $gte: moment('2027-07-01').startOf('day').toDate(),
          },
        },
      ],
    });
  });

  it('should throw ODataLiteError when a slash-joined path is used instead of the dotted collection key', () => {
    expect(() =>
      odata.parse('factSubjectClient/subjectClients/any(c:c/statusCode ge 300)')
    ).to.throw(ODataLiteError);
  });
});
