import moment from 'moment';
import { ODataLiteConfig } from '../types';

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
      allowedTypes: ['string', 'number', 'boolean'],
      toMongo: (field: string, value: string) => ({
        [field]: { $eq: value },
      }),
    },

    ne: {
      allowedTypes: ['string', 'number', 'boolean'],
      toMongo: (field: string, value: string) => ({
        [field]: { $ne: value },
      }),
    },

    gt: {
      allowedTypes: ['date', 'number'],
      toMongo: (field: string, value: string) => ({
        [field]: {
          $gt: moment(value).startOf('day').toDate(),
        },
      }),
    },

    lt: {
      allowedTypes: ['date', 'number'],
      toMongo: (field: string, value: string) => ({
        [field]: {
          $lt: moment(value).endOf('day').toDate(),
        },
      }),
    },

    ge: {
      allowedTypes: ['date', 'number'],
      toMongo: (field: string, value: string) => ({
        [field]: {
          $gte: moment(value).startOf('day').toDate(),
        },
      }),
    },

    le: {
      allowedTypes: ['date', 'number'],
      toMongo: (field: string, value: string) => ({
        [field]: {
          $lte: moment(value).endOf('day').toDate(),
        },
      }),
    },
  },
} satisfies ODataLiteConfig;
