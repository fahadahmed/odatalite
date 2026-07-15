import { expect } from '../../testing/setup';
import { createODataLite, ODataLiteError } from '../index';
import { testConfig } from './fixtures/testConfig';

describe('index', () => {
  it('should re-export the public API', () => {
    expect(createODataLite).to.be.a('function');
    expect(ODataLiteError).to.be.a('function');
  });

  it('should produce a working odata lite instance from a consumer-supplied config', () => {
    const odata = createODataLite(testConfig);
    const ast = odata.parse('order.createdAt ge 2025-07-01');

    expect(odata.toMongo(ast)).to.have.property('order.createdAt');
  });
});
