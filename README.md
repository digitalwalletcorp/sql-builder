# SQL Builder

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Fsql-builder)](https://www.npmjs.com/package/@digitalwalletcorp/sql-builder) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Fsql-builder)](https://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/sql-builder/ci.yml?branch=main)](https://github.com/digitalwalletcorp/sql-builder/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/sql-builder.svg)](https://codecov.io/gh/digitalwalletcorp/sql-builder)

Inspired by Java's S2Dao, this TypeScript/JavaScript library dynamically generates SQL. It embeds entity objects into SQL templates, simplifying complex query construction and enhancing readability. Ideal for flexible, type-safe SQL generation without a full ORM. It efficiently handles dynamic `WHERE` clauses, parameter binding, and looping, reducing boilerplate code.

The core mechanism involves parsing special SQL comments (`/*IF ...*/`, `/*BEGIN...*/`, etc.) in a template and generating a final query based on a provided data object.

#### ✨ Features

* Dynamic Query Generation: Build complex SQL queries dynamically at runtime.
* Conditional Logic (`/*IF...*/`): Automatically include or exclude SQL fragments based on JavaScript conditions evaluated against your data.
* Optional Blocks (`/*BEGIN...*/`): Wrap entire clauses (like `WHERE`) that are only included if at least one inner `/*IF...*/` condition is met.
* Looping (`/*FOR...*/`): Generate repetitive SQL snippets by iterating over arrays in your data (e.g., for multiple `LIKE` or `OR` conditions).
* Simple Parameter Binding: Easily bind values from your data object into the SQL query.
* Zero Dependencies: A single, lightweight class with no external library requirements.

#### ✅ Compatibility

This library is written in pure, environment-agnostic JavaScript/TypeScript and has zero external dependencies, allowing it to run in various environments.

- ✅ **Node.js**: Designed and optimized for server-side use in any modern Node.js environment. This is the **primary and recommended** use case.
- ⚠️ **Browser-like Environments (Advanced)**: While technically capable of running in browsers (e.g., for use with in-browser databases like SQLite via WebAssembly), generating SQL on the client-side to be sent to a server **is a significant security risk and is strongly discouraged** in typical web applications.

#### 📦 Instllation

```bash
npm install @digitalwalletcorp/sql-builder
# or
yarn add @digitalwalletcorp/sql-builder
```

#### 📖 How It Works & Usage

You provide the `SQLBuilder` with a template string containing special, S2Dao-style comments and a data object (the "bind entity"). The builder parses the template and generates the final SQL.

##### Example 1: Dynamic WHERE Clause

This is the most common use case. The `WHERE` clause is built dynamically based on which properties exist in the `bindEntity`.

**Template:**

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

**Code:**

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

**Resulting SQL:**

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

**Template:**

```sql
SELECT * FROM activity
WHERE
  1 = 0
  /*FOR name:projectNames*/OR project_name LIKE '%' || /*name*/'default' || '%'/*END*/
```

**Code:**

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

**Resulting SQL:**

```sql
SELECT * FROM activity
WHERE
  1 = 0
  OR project_name LIKE '%' || 'api' || '%'
  OR project_name LIKE '%' || 'batch' || '%'
  OR project_name LIKE '%' || 'frontend' || '%'
```

#### 📚 API Reference

##### `new SQLBuilder()`

Creates a new instance of the SQL builder.

##### `generateSQL(template: string, entity: Record<string, any>): string`

Generates a final SQL string by processing the template with the provided data entity.

* `template`: The SQL template string containing S2Dao-style comments.
* `entity`: A data object whose properties are used for evaluating conditions (`/*IF...*/`) and binding values (`/*variable*/`).
* Returns: The generated SQL string.

##### `generateParameterizedSQL(template: string, entity: Record<string, any>, bindType: 'postgres' | 'mysql' | 'oracle'): [string, Array<any> | Record<string, any>]`

Generates a SQL string with placeholders for prepared statements and returns an array of bind parameters. This method is crucial for preventing SQL injection.

* `template`: The SQL template string containing S2Dao-style comments.
* `entity`: A data object whose properties are used for evaluating conditions (`/*IF...*/`) and binding values.
* `bindType`: Specifies the database type ('postgres', 'mysql', or 'oracle') to determine the correct placeholder syntax (`$1`, `?`, or `:name`).

    **Note on `bindType` Mapping:**
    While `bindType` explicitly names PostgreSQL, MySQL, and Oracle, the generated placeholder syntax is compatible with other SQL databases as follows:

    | `bindType` | Placeholder Syntax | Compatible Databases | Bind Parameter Type |
    | :------------- | :----------------- | :------------------- | :------------------ |
    | `postgres`     | `$1`, `$2`, ...    | **PostgreSQL** | `Array<any>`        |
    | `mysql`        | `?`, `?`, ...      | **MySQL**, **SQLite**, **SQL Server** (for unnamed parameters) | `Array<any>`        |
    | `oracle`       | `:name`, `:age`, ... | **Oracle**, **SQLite** (for named parameters) | `Record<string, any>` |

* Returns: A tuple `[sql, bindParams]`.
    * `sql`: The generated SQL query with appropriate placeholders.
    * `bindParams`: An array of values (for PostgreSQL/MySQL) or an object of named values (for Oracle) to bind to the placeholders.

##### Example 3: Parameterized SQL with PostgreSQL

**Template:**

```sql
SELECT
  id,
  user_name
FROM users
/*BEGIN*/WHERE
  1 = 1
  /*IF userId != null*/AND user_id = /*userId*/0/*END*/
  /*IF projectNames.length*/AND project_name IN /*projectNames*/('default_project')/*END*/
/*END*/
```

**Code:**

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();
const template = `...`; // The SQL template from above

const bindEntity = {
  userId: 123,
  projectNames: ['project_a', 'project_b']
};

const [sql, params] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
console.log('SQL:', sql);
console.log('Parameters:', params);
```

**Resulting SQL & Parameters:**

```
SQL: SELECT id, user_name FROM users WHERE 1 = 1 AND user_id = $1 AND project_name IN ($2, $3)
Parameters: [ 123, 'project_a', 'project_b' ]
```

## 🪄 Special Comment Syntax

| Tag | Syntax | Description |
| --- | --- | --- |
| IF | `/*IF condition*/ ... /*END*/` | Includes the enclosed SQL fragment only if the `condition` evaluates to a truthy value. The condition is a JavaScript expression evaluated against the `entity` object. |
| BEGIN | `/*BEGIN*/ ... /*END*/` | A wrapper block, typically for a `WHERE` clause. The entire block is included only if at least one `/*IF...*/` statement inside it is evaluated as true. This intelligently removes the `WHERE` keyword if no filters apply. |
| FOR | `/*FOR item:collection*/ ... /*END*/` | Iterates over the `collection` array from the `entity`. For each loop, the enclosed SQL is generated, and the current value is available as the `item` variable for binding. |
| Bind Variable | `/*variable*/` | Binds a value from the `entity`. It automatically formats values: strings are quoted (`'value'`), numbers are left as is (`123`), and arrays are turned into comma-separated lists in parentheses (`('a','b',123)`). |
| END | `/*END*/` | Marks the end of an `IF`, `BEGIN`, or `FOR` block. |

---
#### 💡 Supported Property Paths

For `/*variable*/` (Bind Variable) tags and the `collection` part of `/*FOR item:collection*/` tags, you can specify a path to access properties within the `entity` object.

* **Syntax:** `propertyName`, `nested.property`.
* **Supported:** Direct property access (e.g., `user.id`, `order.items.length`).
* **Unsupported:** Function calls (e.g., `user.name.trim()`, `order.items.map(...)`) or any complex JavaScript expressions.

**Example:**

* **Valid Expression:** `/*userId*/` (accesses `entity.userId` as simple property)
* **Valid Expression:** `/*items*/` (accesses `entity.items` as array)
* **Invalid Expression:** `/*userId.slice(0, 10)*/` (Function call)
* **Invalid Expression:** `/*items.filter(...)*/` (Function call)

---

#### 💡 Supported `IF` Condition Syntax

The `condition` inside an `/*IF ...*/` tag is evaluated as a JavaScript expression against the `entity` object. To ensure security and maintain simplicity, only a **limited subset of JavaScript syntax** is supported.

**Supported Operations:**

* **Entity Property Access:** You can reference properties from the `entity` object (e.g., `propertyName`, `nested.property`).
* **Object Property Access:** Access the `length`, `size` or other property of object (e.g., `String.length`, `Array.length`, `Set.size`, `Map.size`).
* **Comparison Operators:** `==`, `!=`, `===`, `!==`, `<`, `<=`, `>`, `>=`
* **Logical Operators:** `&&` (AND), `||` (OR), `!` (NOT)
* **Literals:** Numbers (`123`, `0.5`), Booleans (`true`, `false`), `null`, `undefined`, and string literals (`'value'`, `"value"`).
* **Parentheses:** `()` for grouping expressions.

**Unsupported Operations (and will cause an error if used):**

* **Function Calls:** You **cannot** call functions on properties (e.g., `user.name.startsWith('A')`, `array.map(...)`).

**Example:**

* **Valid Condition:** `user.age > 18 && user.name.length > 0 && user.id != null`
* **Invalid Condition:** `user.name.startsWith('A')` (Function call)
* **Invalid Condition:** `user.role = 'admin'` (Assignment)

---

#### 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.

#### 🎓 Advanced Usage & Examples

This README covers the basic usage of the library. For more advanced use cases and a comprehensive look at how to verify its behavior, the test suite serves as practical and up-to-date documentation.

We recommend Browse the test files to understand how to handle and verify the sequential, race-condition-free execution in various scenarios.

You can find the test case in the `/test/specs` directory of our GitHub repository.

- **[Explore our Test Suite for Advanced Examples](https://github.com/digitalwalletcorp/sql-builder/tree/main/test/specs)**
