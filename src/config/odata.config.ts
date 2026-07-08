import moment from 'moment';
import { FieldDefinition, ODataLiteConfig } from '../types';

const ALL_TYPES: FieldDefinition['type'][] = ['date', 'string', 'number', 'boolean'];

function toComparable(
  value: string,
  type: FieldDefinition['type'],
  boundary: 'start' | 'end' = 'start',
): unknown {
  switch (type) {
    case 'date':
      return boundary === 'end'
        ? moment(value).endOf('day').toDate()
        : moment(value).startOf('day').toDate();
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
        [field]: { $gt: toComparable(value, type, 'start') },
      }),
    },

    lt: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $lt: toComparable(value, type, 'end') },
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
