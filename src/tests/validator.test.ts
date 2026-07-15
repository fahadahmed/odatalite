import { expect } from '../../testing/setup';
import { Validator } from '../validator';
import { testConfig } from './fixtures/testConfig';
import { ODataLiteError } from '../error';
import { ASTNode } from '../ast';
import { ODataLiteConfig } from '../types';

describe('Validator', () => {
  const validator = new Validator(testConfig);

  describe('comparison validation', () => {
    it('should validate a valid ge comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'ge',
        value: '2025-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid gt comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'gt',
        value: '2025-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid le comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.updatedAt',
        operator: 'le',
        value: '2026-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate a valid lt comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.updatedAt',
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

      await expect((async () => validator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_FIELD');
          expect(err.token).to.equal('invalid.field');
          expect(err.message).to.equal("Field 'invalid.field' is not allowed in OData filter");
        },
      );
    });

    it('should reject unsupported operators', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'contains',
        value: '2025-07-01',
      };

      await expect((async () => validator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_OPERATOR');
          expect(err.token).to.equal('contains');
          expect(err.message).to.equal("Operator 'contains' is not supported");
        },
      );
    });

    it('should reject operators not allowed for the field type', async () => {
      const stringFieldConfig: ODataLiteConfig = {
        fields: {
          'metadata.status': { type: 'string' },
        },
        operators: {
          ge: {
            allowedTypes: ['date', 'number'],
            toMongo: (field: string, value: string | string[]) => ({ [field]: { $gte: value } }),
          },
        },
      };

      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'ge',
        value: 'active',
      };

      await expect(
        (async () => new Validator(stringFieldConfig).validate(ast))(),
      ).to.be.rejected.then((err: ODataLiteError) => {
        expect(err).to.be.instanceOf(ODataLiteError);
        expect(err.code).to.equal('OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE');
        expect(err.token).to.equal('ge');
        expect(err.message).to.equal("Operator 'ge' is not allowed for field type 'string'");
      });
    });

    it('should reject invalid dates', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'ge',
        value: '07-01-2025',
      };

      await expect((async () => validator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_VALUE');
          expect(err.token).to.equal('07-01-2025');
          expect(err.message).to.equal("Invalid date value '07-01-2025'");
        },
      );
    });
  });

  describe('in validation', () => {
    const stringFieldConfig: ODataLiteConfig = {
      fields: {
        'metadata.status': { type: 'string' },
      },
      operators: testConfig.operators,
    };

    it('should validate a valid in comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'metadata.status',
        operator: 'in',
        value: ['active', 'pending'],
      };

      expect(() => new Validator(stringFieldConfig).validate(ast)).to.not.throw();
    });

    it('should validate each date value in an in comparison', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'in',
        value: ['2025-07-01', '2026-06-30'],
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should reject an in comparison with an invalid date value', async () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'in',
        value: ['2025-07-01', '07-01-2025'],
      };

      await expect((async () => validator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_VALUE');
          expect(err.token).to.equal('07-01-2025');
        },
      );
    });
  });

  describe('logical validation', () => {
    it('should validate logical and expressions', () => {
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

      expect(() => validator.validate(ast)).to.not.throw();
    });

    it('should validate logical or expressions', () => {
      const stringFieldConfig: ODataLiteConfig = {
        fields: {
          'metadata.status': { type: 'string' },
        },
        operators: testConfig.operators,
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

  describe('any operator validation', () => {
    const collectionConfig: ODataLiteConfig = {
      fields: {
        ...testConfig.fields,
        'metadata.tags': {
          type: 'collection',
          items: {
            name: { type: 'string' },
            priority: { type: 'number' },
          },
        },
      },
      operators: testConfig.operators,
    };
    const collectionValidator = new Validator(collectionConfig);

    it('should validate a valid any comparison', () => {
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

      expect(() => collectionValidator.validate(ast)).to.not.throw();
    });

    it('should validate an any comparison with a logical predicate', () => {
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

      expect(() => collectionValidator.validate(ast)).to.not.throw();
    });

    it('should reject any on a non-collection field', async () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'order.createdAt',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 't/name',
          operator: 'eq',
          value: 'urgent',
        },
      };

      await expect((async () => collectionValidator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('FIELD_NOT_A_COLLECTION');
        },
      );
    });

    it('should reject any on an unregistered collection field', async () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.unknownTags',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 't/name',
          operator: 'eq',
          value: 'urgent',
        },
      };

      await expect((async () => collectionValidator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_FIELD');
        },
      );
    });

    it('should reject a predicate field not referencing the lambda alias', async () => {
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

      await expect((async () => collectionValidator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_ALIAS_REFERENCE');
        },
      );
    });

    it('should reject a predicate field not whitelisted in items', async () => {
      const ast: ASTNode = {
        type: 'any',
        field: 'metadata.tags',
        alias: 't',
        predicate: {
          type: 'comparison',
          field: 't/secret',
          operator: 'eq',
          value: 'urgent',
        },
      };

      await expect((async () => collectionValidator.validate(ast))()).to.be.rejected.then(
        (err: ODataLiteError) => {
          expect(err).to.be.instanceOf(ODataLiteError);
          expect(err.code).to.equal('INVALID_FIELD');
        },
      );
    });
  });

  describe('eq / ne validation', () => {
    const stringFieldConfig: ODataLiteConfig = {
      fields: {
        'metadata.status': { type: 'string' },
      },
      operators: testConfig.operators,
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

    it('should validate a valid eq comparison for date fields', () => {
      const ast: ASTNode = {
        type: 'comparison',
        field: 'order.createdAt',
        operator: 'eq',
        value: '2025-07-01',
      };

      expect(() => validator.validate(ast)).to.not.throw();
    });
  });
});
