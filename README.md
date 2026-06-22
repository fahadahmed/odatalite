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

## Supported operators

| Operator | Meaning | Allowed field types |
|---|---|---|
| `gt` | greater than | `date`, `number` |
| `lt` | less than | `date`, `number` |
| `ge` | greater than or equal | `date`, `number` |
| `le` | less than or equal | `date`, `number` |

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

---

## Mongo Builder

The Mongo builder converts the validated AST into MongoDB query conditions using the `toMongo` function defined per operator in the config.

Date operators use `moment` to produce precise day boundaries:

| Operator | MongoDB operator | Boundary |
|---|---|---|
| `ge` | `$gte` | `startOf('day')` — inclusive lower bound |
| `le` | `$lte` | `endOf('day')` — inclusive upper bound |
| `gt` | `$gt` | `endOf('day')` — exclusive upper bound |
| `lt` | `$lt` | `startOf('day')` — exclusive lower bound |

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
    gt: {
      allowedTypes: ['date', 'number'],
      toMongo: (field, value) => ({
        [field]: { $gt: moment(value).endOf('day').toDate() },
      }),
    },

    lt: {
      allowedTypes: ['date', 'number'],
      toMongo: (field, value) => ({
        [field]: { $lt: moment(value).startOf('day').toDate() },
      }),
    },

    ge: {
      allowedTypes: ['date', 'number'],
      toMongo: (field, value) => ({
        [field]: { $gte: moment(value).startOf('day').toDate() },
      }),
    },

    le: {
      allowedTypes: ['date', 'number'],
      toMongo: (field, value) => ({
        [field]: { $lte: moment(value).endOf('day').toDate() },
      }),
    },
  },
};
```

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

## Adding a new operator

Add an entry to `config.operators` with `allowedTypes` declaring which field types it supports, and a `toMongo` function that produces the MongoDB query fragment.

```ts
gt: {
  allowedTypes: ['date', 'number'],
  toMongo: (field, value) => ({
    [field]: { $gt: moment(value).endOf('day').toDate() },
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

## OR support

```txt
A or B
```

## Parentheses support

```txt
(A and B) or C
```

## Additional operators

- `eq`
- `ne`
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
