import moment from 'moment'; // optional — any date library works
import { ODataLiteConfig, FieldDefinition } from '../src';

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

export const config: ODataLiteConfig = {
  fields: {
    'order.status': { type: 'string' },
    'order.createdAt': { type: 'date' },
    'order.updatedAt': { type: 'date' },

    'order.items': {
      type: 'collection',
      items: {
        sku: { type: 'string' },
        stock: { type: 'number' },
      },
    },
  },

  operators: {
    eq: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({ [field]: { $eq: toComparable(value as string, type) } }),
    },
    ne: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({ [field]: { $ne: toComparable(value as string, type) } }),
    },
    gt: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({ [field]: { $gt: toComparable(value as string, type) } }),
    },
    lt: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({ [field]: { $lt: toComparable(value as string, type) } }),
    },
    ge: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $gte: toComparable(value as string, type, 'start') },
      }),
    },
    le: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $lte: toComparable(value as string, type, 'end') },
      }),
    },
    in: {
      allowedTypes: ALL_TYPES,
      toMongo: (field, value, type) => ({
        [field]: { $in: (value as string[]).map((v) => toComparable(v, type)) },
      }),
    },
  },
};
