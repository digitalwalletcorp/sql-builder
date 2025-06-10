# SQL Builder

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Fsql-builder)](https://www.npmjs.com/package/@digitalwalletcorp/sql-builder) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Fsql-builder)](https://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/sql-builder/ci.yml?branch=main)](https://github.com/digitalwalletcorp/sql-builder/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/sql-builder.svg)](https://codecov.io/gh/digitalwalletcorp/sql-builder)

Inspired by Java's S2Dao, this TypeScript/JavaScript library dynamically generates SQL. It embeds entity objects into SQL templates, simplifying complex query construction and enhancing readability. Ideal for flexible, type-safe SQL generation without a full ORM. It efficiently handles dynamic `WHERE` clauses, parameter binding, and looping, reducing boilerplate code.

The core mechanism involves parsing special SQL comments (`/*IF ...*/`, `/*BEGIN...*/`, etc.) in a template and generating a final query based on a provided data object.

## ✨ Features

* Dynamic Query Generation: Build complex SQL queries dynamically at runtime.
* Conditional Logic (`/*IF...*/`): Automatically include or exclude SQL fragments based on JavaScript conditions evaluated against your data.
* Optional Blocks (`/*BEGIN...*/`): Wrap entire clauses (like `WHERE`) that are only included if at least one inner `/*IF...*/` condition is met.
* Looping (`/*FOR...*/`): Generate repetitive SQL snippets by iterating over arrays in your data (e.g., for multiple `LIKE` or `OR` conditions).
* Simple Parameter Binding: Easily bind values from your data object into the SQL query.
* Zero Dependencies: A single, lightweight class with no external library requirements.

## ✅ Compatibility

This library is written in pure, environment-agnostic JavaScript/TypeScript and has zero external dependencies, allowing it to run in various environments.

- ✅ **Node.js**: Designed and optimized for server-side use in any modern Node.js environment. This is the **primary and recommended** use case.
- ⚠️ **Browser-like Environments (Advanced)**: While technically capable of running in browsers (e.g., for use with in-browser databases like SQLite via WebAssembly), generating SQL on the client-side to be sent to a server **is a significant security risk and is strongly discouraged** in typical web applications.

## 📦 Instllation

```bash
npm install @digitalwalletcorp/sql-builder
# or
yarn add @digitalwalletcorp/sql-builder
```

## 📖 How It Works & Usage

You provide the `SQLBuilder` with a template string containing special, S2Dao-style comments and a data object (the "bind entity"). The builder parses the template and generates the final SQL.

##### Example 1: Dynamic WHERE Clause

This is the most common use case. The `WHERE` clause is built dynamically based on which properties exist in the `bindEntity`.

##### Template:

```sql
SELECT
  id,
  project_name,
  status
FROM activity
/*BEGIN*/WHERE
  1 = 1
  /*IF projectNames != null && projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
  /*IF statuses != null && statuses.length*/AND status IN /*statuses*/(1)/*END*/
/*END*/
ORDER BY started_at DESC
LIMIT /*limit*/100
```

##### Code:

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();

const template = `...`; // The SQL template from above

// SCENARIO A: Only `statuses` and `limit` are provided.
const bindEntity1 = {
  statuses: [1, 2, 5],
  limit: 50
};

const sql1 = builder.generateSQL(template, bindEntity1);
console.log(sql1);

// SCENARIO B: No filter conditions are met, so the entire WHERE clause is removed.
const bindEntity2 = {
    limit: 100
};
const sql2 = builder.generateSQL(template, bindEntity2);
console.log(sql2);
```

##### Resulting SQL:

* SQL 1 (Scenario A): The `project_name` condition is excluded, but the `status` condition is included.

```sql
SELECT
  id,
  project_name,
  status
FROM activity
WHERE
  1 = 1
  AND status IN (1,2,5)
ORDER BY started_at DESC
LIMIT 50
```

* SQL 2 (Scenario B): Because no `/*IF...*/` conditions inside the `/*BEGIN*/.../*END*/` block were met, the entire block (including the `WHERE` keyword) is omitted.

```sql
SELECT
  id,
  project_name,
  status
FROM activity
ORDER BY started_at DESC
LIMIT 100
```

##### Example 2: FOR Loop

Use a `/*FOR...*/` block to iterate over an array and generate SQL for each item. This is useful for building multiple `LIKE` conditions.

##### Template:

```sql
SELECT * FROM activity
WHERE 1 = 1
/*FOR name:projectNames*/AND project_name LIKE '%' || /*name*/'default' || '%'/*END*/
```

##### Code:

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();
const template = `...`; // The SQL template from above

const bindEntity = {
  projectNames: ['api', 'batch', 'frontend']
};

const sql = builder.generateSQL(template, bindEntity);
console.log(sql);
```

##### Resulting SQL:

```sql
SELECT * FROM activity
WHERE 1 = 1
AND project_name LIKE '%' || 'api' || '%'
AND project_name LIKE '%' || 'batch' || '%'
AND project_name LIKE '%' || 'frontend' || '%'
```

## 📚 API Reference

##### `new SQLBuilder()`

Creates a new instance of the SQL builder.

##### `generateSQL(template: string, entity: Record<string, any>): string`

Generates a final SQL string by processing the template with the provided data entity.

* `template`: The SQL template string containing S2Dao-style comments.
* `entity`: A data object whose properties are used for evaluating conditions (`/*IF...*/`) and binding values (`/*variable*/`).
* Returns: The generated SQL string.

## 🪄 Special Comment Syntax

| Tag | Syntax | Description |
| --- | --- | --- |
| IF | `/*IF condition*/ ... /*END*/` | Includes the enclosed SQL fragment only if the `condition` evaluates to a truthy value. The condition is a JavaScript expression evaluated against the `entity` object. |
| BEGIN | `/*BEGIN*/ ... /*END*/` | A wrapper block, typically for a `WHERE` clause. The entire block is included only if at least one `/*IF...*/` statement inside it is evaluated as true. This intelligently removes the `WHERE` keyword if no filters apply. |
| FOR | `/*FOR item:collection*/ ... /*END*/` | Iterates over the `collection` array from the `entity`. For each loop, the enclosed SQL is generated, and the current value is available as the `item` variable for binding. |
| Bind Variable | `/*variable*/` | Binds a value from the `entity`. It automatically formats values: strings are quoted (`'value'`), numbers are left as is (`123`), and arrays are turned into comma-separated lists in parentheses (`('a','b',123)`). |
| END | `/*END*/` | Marks the end of an `IF`, `BEGIN`, or `FOR` block. |

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.

## 🎓 Advanced Usage & Examples

This README covers the basic usage of the library. For more advanced use cases and a comprehensive look at how to verify its behavior, the test suite serves as practical and up-to-date documentation.

We recommend Browse the test files to understand how to handle and verify the sequential, race-condition-free execution in various scenarios.

You can find the test case in the `/test/specs` directory of our GitHub repository.

- **[Explore our Test Suite for Advanced Examples](https://github.com/digitalwalletcorp/sql-builder/tree/main/test/specs)**
