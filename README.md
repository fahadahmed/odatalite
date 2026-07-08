# OData Lite Parser

## Overview

This utility implements a lightweight and secure subset of the OData `$filter` syntax for backend filtering of MongoDB queries.

The implementation is intentionally minimal and controlled to support:

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
- logical operators such as `and`, `or`, `not`

References:

- https://www.odata.org/documentation/
- https://www.odata.org/documentation/odata-version-3-0/odata-version-3-0-core-protocol/
- https://www.odata.org/documentation/odata-version-2-0/uri-conventions/

Australian Government API guidance:

- https://api.gov.au/sections/interoperability/api-design.html

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

# Current Supported Syntax

## Single comparison

```txt
metadata.accountPeriodBeginDate ge 2023-07-01
```

## Multiple comparisons using `and`

```txt
metadata.accountPeriodBeginDate ge 2023-07-01 and metadata.accountPeriodEndDate le 2026-06-30
```

## Multiple comparisons using `or`

```txt
metadata.status eq 'active' or metadata.status eq 'pending'
```

`and` binds tighter than `or` (no parentheses support yet), so:

```txt
A and B or C
```

parses as `(A and B) or C`.

## String and boolean literal values

String values must be single-quoted; bare words are otherwise tokenized as identifiers, not values.

```txt
metadata.status eq 'active'
metadata.isActive eq true
```

## Supported operators

| Operator | Meaning | Allowed field types |
|---|---|---|
| `eq` | equal | `date`, `string`, `number`, `boolean` |
| `ne` | not equal | `date`, `string`, `number`, `boolean` |
| `gt` | greater than | `date`, `string`, `number`, `boolean` |
| `lt` | less than | `date`, `string`, `number`, `boolean` |
| `ge` | greater than or equal | `date`, `string`, `number`, `boolean` |
| `le` | less than or equal | `date`, `string`, `number`, `boolean` |

## `any` lambda over collections

A `collection`-typed field can be queried with the `any` lambda operator, which checks whether at least one element matches a predicate:

```txt
metadata.tags/any(t: t/name eq 'urgent')
```

The predicate supports `and`/`or` combinations, and every field referenced inside it must be prefixed with the lambda alias (`t/` above):

```txt
metadata.tags/any(t: t/name eq 'urgent' and t/priority gt 5)
```

---

# Architecture

## Lexer

The lexer converts the raw input string into tokens.

Example:

Input:

```txt
metadata.accountPeriodBeginDate ge 2023-07-01
```

Output:

```ts
[
  {
    type: 'identifier',
    value: 'metadata.accountPeriodBeginDate',
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
  field: 'metadata.accountPeriodBeginDate',
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

For `date` fields, values are validated against a strict `YYYY-MM-DD` format using a Zod schema. Invalid values throw `INVALID_VALUE`.

### `any` validation

For an `any` node, the referenced field must exist in `config.fields` and be declared with `type: 'collection'` and an `items` map (otherwise `INVALID_FIELD` / `FIELD_NOT_A_COLLECTION`). Every field inside the predicate must be prefixed with the lambda alias (`INVALID_ALIAS_REFERENCE` otherwise), and must resolve to a sub-field whitelisted in `items` (`INVALID_FIELD` otherwise). The rest of the predicate — operator whitelisting, type compatibility, value validation — is validated exactly like a top-level comparison.

---

## Mongo Builder

The Mongo builder converts the validated AST into MongoDB query conditions using the `toMongo` function defined per operator in the config.

For `date` fields, `ge`/`le` widen the value to a day boundary (so they behave as an inclusive range over the whole day), while `eq`/`ne`/`gt`/`lt` compare against the exact UTC instant of the value:

| Operator | MongoDB operator | Date conversion |
|---|---|---|
| `ge` | `$gte` | `moment(value).startOf('day').toDate()` — inclusive lower bound |
| `le` | `$lte` | `moment(value).endOf('day').toDate()` — inclusive upper bound |
| `eq` | `$eq` | `moment.utc(value).toDate()` — exact instant |
| `ne` | `$ne` | `moment.utc(value).toDate()` — exact instant |
| `gt` | `$gt` | `moment.utc(value).toDate()` — exact instant |
| `lt` | `$lt` | `moment.utc(value).toDate()` — exact instant |

Example output for a single comparison:

```ts
{
  'metadata.accountPeriodBeginDate': {
    $gte: ISODate('2023-07-01T00:00:00.000Z')
  }
}
```

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
  'metadata.tags': {
    $elemMatch: { name: { $eq: 'urgent' } }
  }
}
```

---

# Configuration

The parser is fully configuration-driven.

## Current configuration

```ts
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
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $eq: toComparable(value, type) },
      }),
    },

    ne: {
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $ne: toComparable(value, type) },
      }),
    },

    gt: {
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $gt: toComparable(value, type) },
      }),
    },

    lt: {
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $lt: toComparable(value, type) },
      }),
    },

    ge: {
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $gte: toComparable(value, type, 'start') },
      }),
    },

    le: {
      allowedTypes: ['date', 'string', 'number', 'boolean'],
      toMongo: (field, value, type) => ({
        [field]: { $lte: toComparable(value, type, 'end') },
      }),
    },
  },
};
```

`toComparable` converts the raw string value based on the field's type: dates default to the exact UTC instant (`moment.utc(value).toDate()`), used by `eq`/`ne`/`gt`/`lt`, while `ge`/`le` pass `'start'`/`'end'` to widen to a day boundary (`startOf('day')` / `endOf('day')`); numbers become `Number(value)`, booleans become `value === 'true'`, and strings pass through unchanged.

---

# Security Model

This implementation follows a strict whitelist-only approach.

## Fields must be explicitly configured

Any field not listed in `config.fields` is rejected.

```ts
fields: {
  'metadata.accountPeriodBeginDate': {
    type: 'date',
  },
}
```

## Operators must be explicitly configured

Any operator not listed in `config.operators` is rejected.

```ts
operators: {
  ge: {
    allowedTypes: ['date', 'number'],
    toMongo: (field, value) => ({
      [field]: { $gte: moment(value).startOf('day').toDate() },
    }),
  },
}
```

## Type compatibility is enforced

Even if a field and operator are both whitelisted, the operator must declare the field's type in `allowedTypes` or the request is rejected.

Anything not explicitly configured is rejected.

---

# Error Handling

## Design Principle

The OData utility is domain-agnostic.

It does NOT throw application-specific errors such as:

- `FactError`
- HTTP errors
- Express errors

Instead it throws:

```ts
ODataLiteError
```

## Error codes

| Code | Thrown by | Meaning |
|---|---|---|
| `INVALID_CHARACTER` | Lexer | Input contains a character not valid in an OData filter |
| `UNEXPECTED_TOKEN` | Parser | Token sequence does not match expected syntax |
| `INVALID_FIELD` | Validator | Field is not in the whitelist |
| `INVALID_OPERATOR` | Validator | Operator is not configured |
| `OPERATOR_NOT_ALLOWED_FOR_FIELD_TYPE` | Validator | Operator does not support the field's type |
| `INVALID_VALUE` | Validator | Value fails type-specific validation (e.g. date format) |
| `FIELD_NOT_A_COLLECTION` | Validator | `any` used on a field not declared as `type: 'collection'` |
| `INVALID_ALIAS_REFERENCE` | Validator | A predicate field inside `any(...)` doesn't reference the lambda alias |

## Error Flow

```txt
ODataLiteError (library layer)
   ↓ mapped at integration boundary
FactError(82000) (application layer)
   ↓
HTTP response
```

---

# API Integration Example

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
    throw new FactError(82000);
  }

  throw err;
}
```

---

# Extending the Parser

## Adding a new field

Add an entry to `config.fields` with a `type` matching one of: `date`, `string`, `number`, `boolean`.

```ts
'metadata.accountPeriodEndDate': {
  type: 'date',
}
```

## Adding a collection field for `any`

Declare `type: 'collection'` with an `items` map whitelisting the sub-fields allowed inside the lambda predicate, keyed by their dotted path within each element.

```ts
'metadata.tags': {
  type: 'collection',
  items: {
    name: { type: 'string' },
    priority: { type: 'number' },
  },
}
```

## Adding a new operator

Add an entry to `config.operators` with `allowedTypes` declaring which field types it supports, and a `toMongo` function that produces the MongoDB query fragment.

```ts
gt: {
  allowedTypes: ['date', 'number'],
  toMongo: (field, value) => ({
    [field]: { $gt: moment.utc(value).toDate() },
  }),
}
```

---

# Testing

The test suite uses Jest with ts-jest for TypeScript support.

```bash
npm test
```

Tests are located in `src/tests/` and cover the lexer, parser, validator, and mongo builder individually.

---

# Future Extensions

The architecture intentionally supports future evolution.

Potential future capabilities include:

## Parentheses support

```txt
(A and B) or C
```

## Additional operators

- `in`

## Alternative query backends

Because the AST is decoupled from MongoDB, future builders could support:

- SQL
- Prisma
- Elasticsearch DSL

without changing parser logic.

---

# Design Principles

This implementation follows:

- separation of concerns
- dependency inversion
- fail-fast validation
- deterministic query generation
- strict whitelist enforcement
