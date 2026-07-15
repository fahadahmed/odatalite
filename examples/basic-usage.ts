import { createODataLite, ODataLiteError } from '../src';
import { config } from './config';

const odata = createODataLite(config);

function run(filter: string): void {
  console.log(`\nfilter: ${filter}`);
  try {
    const ast = odata.parse(filter);
    console.log('ast:', JSON.stringify(ast, null, 2));
    console.log('mongo query:', JSON.stringify(odata.toMongo(ast), null, 2));
  } catch (err) {
    if (err instanceof ODataLiteError) {
      console.log(`rejected: [${err.code}] ${err.message}`);
      return;
    }
    throw err;
  }
}

run("order.status eq 'active' and order.createdAt ge 2025-07-01");
run("order.items/any(i: i/sku eq 'ABC-123' and i/stock gt 5)");

// rejected: field isn't in the whitelist
run("order.internalNotes eq 'do not ship'");

// rejected: value fails the date format check
run('order.createdAt ge 07-01-2025');
