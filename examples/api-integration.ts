import { createODataLite, ODataLiteError, MongoQuery } from '../src';
import { config } from './config';

const odata = createODataLite(config);

/**
 * Framework-agnostic version of what a route handler does: take the raw
 * `$filter` query param, turn it into Mongo conditions, or a 400-shaped
 * error if the filter is invalid. Wire this into Express/Fastify/etc. by
 * calling it with `req.query.$filter` and mapping the result to a response.
 */
export function buildFilterConditions(
  rawFilter: string | undefined,
):
  { ok: true; conditions: MongoQuery } | { ok: false; status: 400; code: string; message: string } {
  if (!rawFilter) {
    return { ok: true, conditions: {} };
  }

  try {
    const ast = odata.parse(rawFilter);
    return { ok: true, conditions: odata.toMongo(ast) };
  } catch (err) {
    if (err instanceof ODataLiteError) {
      return { ok: false, status: 400, code: err.code, message: err.message };
    }
    throw err;
  }
}

// Example Express route:
//
//   app.get('/orders', (req, res) => {
//     const result = buildFilterConditions(req.query.$filter as string | undefined);
//
//     if (!result.ok) {
//       return res.status(result.status).json({ code: result.code, message: result.message });
//     }
//
//     const orders = await Order.find(result.conditions);
//     res.json(orders);
//   });

console.log(buildFilterConditions("order.status eq 'active'"));
console.log(buildFilterConditions('order.internalNotes eq 1'));
