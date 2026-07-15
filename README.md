# OData Lite Parser

## Overview

This package implements a lightweight and secure subset of the OData `$filter` syntax, translating it into MongoDB queries.

It is intentionally minimal and configuration-driven to support:

- strict field/operator whitelisting
- predictable query generation
- safe MongoDB translation
- future extensibility

The architecture follows a classic compiler-style pipeline:

```txt
Input String
   ↓
Lexer (tokenization)
   ↓
Parser (AST generation)
   ↓
Validator (whitelist enforcement)
   ↓
Mongo Builder (query translation)
```

---

## Installation

```bash
pnpm add odata-lite
```

---

## Quick start

`odata-lite` ships no built-in field configuration — you define the whitelist of fields, types, and operators your application allows, and the parser enforces it.

```ts
import { createODataLite, ODataLiteError } from 'odata-lite';

const odata = createODataLite({
  fields: {
    'order.status': { type: 'string' },
    'order.createdAt': { type: 'date' },
    'order.amount': { type: 'number' },
  },
  operators: {
    eq: {
      allowedTypes: ['string', 'date', 'number'],
      toMongo: (field, value) => ({ [field]: { $eq: value } }),
    },
    ge: {
      allowedTypes: ['date', 'number'],
      toMongo: (field, value) => ({ [field]: { $gte: value } }),
    },
  },
});

try {
  const ast = odata.parse("order.status eq 'active' and order.createdAt ge 2025-07-01");
  const mongoQuery = odata.toMongo(ast);
  // { $and: [{ 'order.status': { $eq: 'active' } }, { 'order.createdAt': { $gte: '2025-07-01' } }] }
} catch (err) {
  if (err instanceof ODataLiteError) {
    // handle a rejected/invalid filter
  }
  throw err;
}
```

See [Configuration](#configuration) below for a fuller example, including date handling and collection (`any`) fields.

---

# What is OData?

OData (Open Data Protocol) is a standardized protocol for building and consuming RESTful APIs.

One of its key features is the `$filter` query syntax, which allows clients to express filtering logic declaratively.

Example:

```txt
Price ge 10 and Price le 100
```

OData operators include:

- `eq` → equal
- `ne` → not equal
- `gt` → greater than
- `ge` → greater than or equal
- `lt` → less than
- `le` → less than or equal
- `in` → value is one of a list
- logical operators such as `and`, `or`, `not`

References:

- https://www.odata.org/documentation/
- https://www.odata.org/documentation/odata-version-3-0/odata-version-3-0-core-protocol/
- https://www.odata.org/documentation/odata-version-2-0/uri-conventions/

`odata-lite` does not implement the full OData specification — see [Scope](#scope) below.

---

# Why this implementation exists

Directly exposing unrestricted query syntax to backend systems introduces several risks:

- field injection
- unrestricted query complexity
- expensive database queries
- accidental exposure of internal schema
- inconsistent validation logic

This implementation solves this by:

- only allowing explicitly whitelisted fields
- only allowing explicitly whitelisted operators
- validating values before query generation
- translating into controlled MongoDB queries
- rejecting invalid filters early

---

# Scope

`odata-lite` implements a whitelisted subset of the `$filter` query option only, targeting MongoDB. It does not implement `$select`, `$expand`, `$orderby`, `$top`/`$skip`, `$count`, `$apply`, batch requests, or any backend other than MongoDB. See [Future Extensions](#future-extensions) for the roadmap.

---

# Current Supported Syntax

## Single comparison

```txt
order.createdAt ge 2023-07-01
```

## Multiple comparisons using `and`

```txt
order.createdAt ge 2023-07-01 and order.updatedAt le 2026-06-30
```

## Multiple comparisons using `or`

```txt
order.status eq 'active' or order.status eq 'pending'
```

`and` binds tighter than `or` (no parentheses support yet), so:

```txt
A and B or C
```

parses as `(A and B) or C`.

## String and boolean literal values

String values must be single-quoted; bare words are otherwise tokenized as identifiers, not values.

```txt
order.status eq 'active'
order.isPaid eq true
```

## Value lists (`in`)

`in` checks a field against a parenthesized, comma-separated list of values. Each value follows the same literal rules as a single comparison (quoted strings, bare dates/numbers/booleans):

```txt
order.status in ('active','pending')
order.createdAt in (2025-07-01,2025-08-01)
```

## Supported operators

| Operator | Meaning                | Allowed field types                   |
| -------- | ---------------------- | ------------------------------------- |
| `eq`     | equal                  | `date`, `string`, `number`, `boolean` |
| `ne`     | not equal              | `date`, `string`, `number`, `boolean` |
| `gt`     | greater than           | `date`, `string`, `number`, `boolean` |
| `lt`     | less than              | `date`, `string`, `number`, `boolean` |
| `ge`     | greater than or equal  | `date`, `string`, `number`, `boolean` |
| `le`     | less than or equal     | `date`, `string`, `number`, `boolean` |
| `in`     | value is one of a list | `date`, `string`, `number`, `boolean` |

Every operator above is a reference implementation you can copy into your own config — none of it is built into the engine (see [Configuration](#configuration)).

## `any` lambda over collections

A `collection`-typed field can be queried with the `any` lambda operator, which checks whether at least one element matches a predicate:

```txt
order.items/any(i: i/sku eq 'ABC-123')
```

The predicate supports `and`/`or` combinations, and every field referenced inside it must be prefixed with the lambda alias (`i/` above):

```txt
order.items/any(i: i/sku eq 'ABC-123' and i/stock gt 5)
```

---

# Architecture

## Lexer

The lexer converts the raw input string into tokens.

Example:

Input:

```txt
order.createdAt ge 2023-07-01
```

Output:

```ts
[
  {
    type: 'identifier',
    value: 'order.createdAt',
  },
  {
    type: 'operator',
    value: 'ge',
  },
  {
    type: 'value',
    value: '2023-07-01',
  },
];
```

The lexer is intentionally strict and throws an `ODataLiteError` on invalid syntax.

---

## Parser

The parser converts tokens into an Abstract Syntax Tree (AST).

Example AST:

```ts
{
  type: 'comparison',
  field: 'order.createdAt',
  operator: 'ge',
  value: '2023-07-01'
}
```

For chained expressions:

```ts
{
  type: 'logical',
  operator: 'and',
  left: {...},
  right: {...}
}
```

For `in`, `value` is an array instead of a single string:

```ts
{
  type: 'comparison',
  field: 'order.status',
  operator: 'in',
  value: ['active', 'pending']
}
```

---

## What is an AST?

AST stands for Abstract Syntax Tree.

It is a structured representation of the query that allows:

- validation
- transformation
- query translation
- future extensibility

Instead of working directly with raw strings, the system works with structured nodes.

This makes the implementation:

- safer
- easier to extend
- easier to test

---

## Validator

The validator enforces field whitelisting, operator whitelisting, type compatibility, and value validation.

### Field whitelisting

Only fields explicitly listed in `config.fields` are permitted. Any other field throws `INVALID_FIELD`.

### Operator whitelisting

Only operators explicitly defined in `config.operators` are permitted. Any other operator throws `INVALID_OPERATOR`.

### Type compatibility

Each operator declares which field types it supports via `allowedTypes`. If the field's type is not in the operator's `allowedTypes`, the request is rejected with `OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE`.

```ts
operators: {
  ge: {
    allowedTypes: ['date', 'number'],
    toMongo: ...,
  }
}
```

### Value validation

For `date` fields, values are validated against a strict `YYYY-MM-DD` format using a Zod schema. Invalid values throw `INVALID_VALUE`. For `in`, every value in the list is validated the same way — a single invalid date anywhere in the list rejects the whole filter.

### `any` validation

For an `any` node, the referenced field must exist in `config.fields` and be declared with `type: 'collection'` and an `items` map (otherwise `INVALID_FIELD` / `FIELD_NOT_A_COLLECTION`). Every field inside the predicate must be prefixed with the lambda alias (`INVALID_ALIAS_REFERENCE` otherwise), and must resolve to a sub-field whitelisted in `items` (`INVALID_FIELD` otherwise). The rest of the predicate — operator whitelisting, type compatibility, value validation — is validated exactly like a top-level comparison.

---

## Mongo Builder

The Mongo builder converts the validated AST into MongoDB query conditions using the `toMongo` function defined per operator in the config. The specific date-boundary widening, numeric coercion, etc. shown in the examples below belong to the _reference_ operator implementations in [Configuration](#configuration) — the builder itself just calls whatever `toMongo` your config supplies.

Logical expressions become:

```ts
{
  $and: [...]
}
```

or, for `or` expressions:

```ts
{
  $or: [...]
}
```

An `any` node becomes an `$elemMatch`, with predicate fields resolved relative to the collection element (the alias prefix is stripped and remaining `/` segments are joined with `.`):

```ts
{
  'order.items': {
    $elemMatch: { sku: { $eq: 'ABC-123' } }
  }
}
```

---

# Configuration

The parser is fully configuration-driven — `odata-lite` ships no fields and no operators. You supply an `ODataLiteConfig` to `createODataLite`.

## Example configuration

```ts
import moment from 'moment'; // optional — any date library works
import { ODataLiteConfig, FieldDefinition } from 'odata-lite';

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
```

`toComparable` converts the raw string value based on the field's type: dates default to the exact UTC instant, used by `eq`/`ne`/`gt`/`lt`/`in`, while `ge`/`le` pass `'start'`/`'end'` to widen to a day boundary (inclusive range over the whole day); numbers become `Number(value)`, booleans become `value === 'true'`, and strings pass through unchanged. This is a reference implementation, not a requirement — write whatever `toMongo` logic your fields need.

The full working version of this config (used by the test suite) lives at [src/tests/fixtures/testConfig.ts](src/tests/fixtures/testConfig.ts).

---

# Security Model

This implementation follows a strict whitelist-only approach.

## Fields must be explicitly configured

Any field not listed in `config.fields` is rejected.

## Operators must be explicitly configured

Any operator not listed in `config.operators` is rejected.

## Type compatibility is enforced

Even if a field and operator are both whitelisted, the operator must declare the field's type in `allowedTypes` or the request is rejected.

Anything not explicitly configured is rejected.

---

# Error Handling

## Design principle

The parser is domain-agnostic: it never throws application-specific errors (HTTP errors, framework errors, etc.). Every failure — lexer, parser, or validator — throws a single `ODataLiteError` with a stable `code` and `token`, so callers can catch one error type at the integration boundary and map it to whatever error convention their application uses.

## Error codes

| Code                                  | Thrown by | Meaning                                                                |
| ------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `INVALID_CHARACTER`                   | Lexer     | Input contains a character not valid in an OData filter                |
| `UNEXPECTED_TOKEN`                    | Parser    | Token sequence does not match expected syntax                          |
| `INVALID_FIELD`                       | Validator | Field is not in the whitelist                                          |
| `INVALID_OPERATOR`                    | Validator | Operator is not configured                                             |
| `OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE` | Validator | Operator does not support the field's type                             |
| `INVALID_VALUE`                       | Validator | Value fails type-specific validation (e.g. date format)                |
| `FIELD_NOT_A_COLLECTION`              | Validator | `any` used on a field not declared as `type: 'collection'`             |
| `INVALID_ALIAS_REFERENCE`             | Validator | A predicate field inside `any(...)` doesn't reference the lambda alias |

## Integration example

```ts
try {
  const ast = odata.parse(filter);
  const mongoConditions = odata.toMongo(ast);

  queryOpts.conditions = {
    ...queryOpts.conditions,
    ...mongoConditions,
  };
} catch (err: unknown) {
  if (err instanceof ODataLiteError) {
    // map to your application's own error type/HTTP response here
    throw new BadRequestError(err.code, err.message);
  }

  throw err;
}
```

---

# Extending the Parser

## Adding a new field

Add an entry to `config.fields` with a `type` matching one of: `date`, `string`, `number`, `boolean`.

```ts
'order.updatedAt': {
  type: 'date',
}
```

## Adding a collection field for `any`

Declare `type: 'collection'` with an `items` map whitelisting the sub-fields allowed inside the lambda predicate, keyed by their dotted path within each element.

```ts
'order.items': {
  type: 'collection',
  items: {
    sku: { type: 'string' },
    stock: { type: 'number' },
  },
}
```

## Adding a new operator

Add an entry to `config.operators` with `allowedTypes` declaring which field types it supports, and a `toMongo` function that produces the MongoDB query fragment.

```ts
gt: {
  allowedTypes: ['date', 'number'],
  toMongo: (field, value) => ({
    [field]: { $gt: value },
  }),
}
```

---

# Testing

The test suite uses [Vitest](https://vitest.dev/), with [Chai](https://www.chaijs.com/) for assertions.

```bash
pnpm test
pnpm test:coverage
```

Tests are located in `src/tests/` and cover the lexer, parser, validator, and mongo builder individually, plus the public API in `index.test.ts`. Test-only fixtures (a generic example config) live in `src/tests/fixtures/`.

---

# Future Extensions

Potential future capabilities, roughly in priority order:

## Completing `$filter`

- `not` (logical negation)
- Parentheses / grouping — `(A or B) and C`
- String functions — `contains()`, `startswith()`, `endswith()`
- `all()` lambda (sibling of `any()`)

## Additional query options

- `$select`, `$orderby`, `$top`, `$skip`, `$count`

## Alternative query backends

Because the AST is decoupled from MongoDB, future builders could support SQL or Elasticsearch DSL without changing parser logic. `$expand` and `$apply` (aggregation) are explicitly out of scope for now — see project issues for discussion.

---

# Design Principles

This implementation follows:

- separation of concerns
- dependency inversion
- fail-fast validation
- deterministic query generation
- strict whitelist enforcement

---

# License

MIT — see [LICENSE](LICENSE).
