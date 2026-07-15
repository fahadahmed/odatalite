import { z } from 'zod';

export const ODataDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid OData date format (expected YYYY-MM-DD)');
