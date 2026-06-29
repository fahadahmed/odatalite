import { expect } from '../../testing/setup';
import { Validator } from '../validator';
import { odataConfig } from '../config/odata.config';
import { ODataLiteError } from '../error';
import { ASTNode } from '../ast';
import { ODataLiteConfig } from '../types';

describe.only('Validator', () => {
  const validator = new Validator(odataConfig);

  describe('comparison validation', () => {
    it('should validate a valid ge comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'ge',
        value: '2025-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid gt comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'gt',
        value: '2025-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid le comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodEndDate',
        operator: 'le',
        value: '2026-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid lt comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodEndDate',
        operator: 'lt',
        value: '2026-06-30',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should reject non-whitelisted fields', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'invalid.field',
        operator: 'ge',
        value: '2025-07-01',
      };

      await expect((async () => validator.validate(ast))())
        .to.be.rejected
        .then((err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_FIELD');
          expect(err.token).to.equal('invalid.field');
          expect(err.message).to.equal(
            "Field 'invalid.field' is not allowed in OData filter",
          );
        });
    });

    it('should reject unsupported operators', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'contains',
        value: '2025-07-01',
      };

      await expect((async () => validator.validate(ast))())
        .to.be.rejected
        .then((err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_OPERATOR');
          expect(err.token).to.equal('contains');
          expect(err.message).to.equal("Operator 'contains' is not supported");
        });
    });

    it('should reject operators not allowed for the field type', async () => {
      const stringFieldConfig: ODataLiteConfig = {
        fields: {
          'metadata.status': { type: 'string' },
        },
        operators: {
          ge: {
            allowedTypes: ['date', 'number'],
            toMongo: (field: string, value: string) => ({ [field]: { $gte: value } }),
          },
        },
      };

      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'ge',
        value: 'active',
      };

      await expect((async () => new Validator(stringFieldConfig).validate(ast))())
        .to.be.rejected
        .then((err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE');
          expect(err.token).to.equal('ge');
          expect(err.message).to.equal(
            "Operator 'ge' is not allowed for field type 'string'",
          );
        });
    });

    it('should reject invalid dates', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'ge',
        value: '07-01-2025',
      };

      await expect((async () => validator.validate(ast))())
        .to.be.rejected
        .then((err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_VALUE');
          expect(err.token).to.equal('07-01-2025');
          expect(err.message).to.equal("Invalid date value '07-01-2025'");
        });
    });
  });

  describe('logical validation', () => {
    it('should validate logical and expressions', () => {
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

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate logical or expressions', () => {
      const stringFieldConfig: ODataLiteConfig = {
        fields: {
          'metadata.status': { type: 'string' },
        },
        operators: odataConfig.operators,
      };

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

      expect(() => new Validator(stringFieldConfig).validate(ast)).to.not.throw();
    });
  });

  describe('eq / ne validation', () => {
    const stringFieldConfig: ODataLiteConfig = {
      fields: {
        'metadata.status': { type: 'string' },
      },
      operators: odataConfig.operators,
    };

    it('should validate a valid eq comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'eq',
        value: 'active',
      };

      expect(() => new Validator(stringFieldConfig).validate(ast)).to.not.throw();
    });

    it('should validate a valid ne comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'ne',
        value: 'active',
      };

      expect(() => new Validator(stringFieldConfig).validate(ast)).to.not.throw();
    });

    it('should reject eq for date fields', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.accountPeriodBeginDate',
        operator: 'eq',
        value: '2025-07-01',
      };

      await expect((async () => validator.validate(ast))())
        .to.be.rejected
        .then((err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE');
        });
    });
  });
});
