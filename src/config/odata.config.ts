import moment from 'moment';
import { FieldDefinition, ODataLiteConfig } from '../types';

const ALL_TYPES: FieldDefinition['type'][] = ['date', 'string', 'number', 'boolean'];

function toComparable(
  value: string,
  type: FieldDefinition['type'],
  boundary: 'exact' | 'start' | 'end' = 'exact',
): unknown {
  switch (type) {
    case 'date':
      if (boundary === 'start') return moment(value).startOf('day').toDate();
      if (boundary === 'end') return moment(value).endOf('day').toDate();
      return moment.utc(value).toDate();
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    default:
      return value;
  }
}

export const odataConfig = {
  fields: {
    'metadata.accountPeriodBeginDate': {
      type: 'date',
    },

    'metadata.accountPeriodEndDate': {
      type: 'date',
    },

    'factSubjectClient.subjectClients': {
      type: 'collection',
      items: {
        statusCode: { type: 'number' },
        clientIdentifierTypeCode: { type: 'string' },
        clientIdentifierValueID: { type: 'string' },
        coreProcessingTransactionID: { type: 'number' },
      },
    },

    'interactionLink.related': {
      type: 'collection',
      items: {
        linkName: { type: 'string' },
        transactionID: { type: 'number' },
      },
    },
  },

  operators: {
    eq: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $eq: toComparable(value, type) },
      }),
    },

    ne: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $ne: toComparable(value, type) },
      }),
    },

    gt: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $gt: toComparable(value, type) },
      }),
    },

    lt: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $lt: toComparable(value, type) },
      }),
    },

    ge: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $gte: toComparable(value, type, 'start') },
      }),
    },

    le: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $lte: toComparable(value, type, 'end') },
      }),
    },
  },
} satisfies ODataLiteConfig;
