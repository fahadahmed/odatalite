import { expect } from '../../testing/setup';
import { createODataLite, ODataLiteError, odataConfig } from '../index';

describe('index', () => {
  it('should re-export the public API', () => {
    expect(createODataLite).to.be.a('function');
    expect(ODataLiteError).to.be.a('function');
    expect(odataConfig).to.be.an('object');
  });

  it('should produce a working odata lite instance via the public exports', () => {
    const odata = createODataLite(odataConfig);
    const ast = odata.parse('metadata.accountPeriodBeginDate ge 2025-07-01');

    expect(odata.toMongo(ast)).to.have.property('metadata.accountPeriodBeginDate');
  });
});
