import { expect } from '../../testing/setup';
import moment from 'moment';
import { createODataLite } from '../createODataLite';
import { odataConfig } from '../config/odata.config';
import { ODataLiteError } from '../error';

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

  it('should throw ODataLiteError when the field is not whitelisted', () => {
    expect(() => odata.parse('invalid.field ge 2025-07-01')).to.throw(
      ODataLiteError
    );
  });
});
