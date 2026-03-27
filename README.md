# SQL Builder

[![NPM Version](https://img.shields.io/npm/v/%40digitalwalletcorp%2Fsql-builder)](https://www.npmjs.com/package/@digitalwalletcorp/sql-builder) [![License](https://img.shields.io/npm/l/%40digitalwalletcorp%2Fsql-builder)](https://opensource.org/licenses/MIT) [![Build Status](https://img.shields.io/github/actions/workflow/status/digitalwalletcorp/sql-builder/ci.yml?branch=main)](https://github.com/digitalwalletcorp/sql-builder/actions) [![Test Coverage](https://img.shields.io/codecov/c/github/digitalwalletcorp/sql-builder.svg)](https://codecov.io/gh/digitalwalletcorp/sql-builder)

Inspired by Java's **S2Dao its successor Doma**, this TypeScript/JavaScript library dynamically generates SQL. It embeds entity objects into SQL templates, simplifying complex query construction and enhancing readability. Ideal for flexible, type-safe SQL generation without a full ORM. It efficiently handles dynamic `WHERE` clauses, parameter binding, and looping, reducing boilerplate code.

The core mechanism involves parsing special SQL comments (`/*IF ...*/`, `/*BEGIN...*/`, etc.) in a template and generating a final query based on a provided data object.

### ⚠️ Breaking Change in IN Clause Behavior (v1 → v2)

**v2.0.0 introduces a breaking change in how arrays are rendered for `IN` clauses.**

- **v1.x behavior:** The bind array was automatically output with surrounding parentheses, so the template **did not need to include parentheses**.
- **v2.x behavior:** Only the array values are output. You must **include parentheses in the template** to form a valid `IN` clause.

**v1.x Example (no parentheses in template)**
```sql
SELECT *
FROM activity
WHERE project_name IN /*projectNames*/('project1')
```

```typescript
const bindEntity = { projectNames: ['api', 'batch'] };
const sql = builder.generateSQL(template, bindEntity);
console.log(sql);

// Output (v1.x)
// project_name IN ('api','batch') ← parentheses added automatically
```

**v2.x Example (parentheses required in template)**
```sql
SELECT *
FROM activity
WHERE project_name IN (/*projectNames*/'project1')
```

```typescript
const bindEntity = { projectNames: ['api', 'batch'] };
const sql = builder.generateSQL(template, bindEntity);
console.log(sql);

// Output (v2.x)
// project_name IN ('api','batch')  ← only values are inserted
```

> 💡 Tip: If you upgrade a template from v1.x to v2.x, make sure to add parentheses around any IN bind variables to avoid SQL syntax errors.

#### ✨ Features

* Dynamic Query Generation: Build complex SQL queries dynamically at runtime.
* Conditional Logic (`/*IF...*/`, `/*ELSEIF...*/`, `/*ELSE...*/`): Robust conditional branching. Support for complex `if-elseif-else` structures, including nesting.
* Optional Blocks (`/*BEGIN...*/`): Wrap entire clauses (like `WHERE`) that are only included if at least one inner `/*IF...*/` condition is met.
* Looping (`/*FOR...*/`): Generate repetitive SQL snippets by iterating over arrays in your data (e.g., for multiple `LIKE` or `OR` conditions).
* Simple Parameter Binding: Easily bind values from your data object into the SQL query.
* Zero Dependencies: A single, lightweight class with no external library requirements.

#### ✅ Compatibility

This library is written in pure, environment-agnostic JavaScript/TypeScript and has zero external dependencies, allowing it to run in various environments.

- ✅ **Node.js**: Designed and optimized for server-side use in any modern Node.js environment. This is the **primary and recommended** use case.
- ⚠️ **Browser-like Environments (Advanced)**: While technically capable of running in browsers (e.g., for use with in-browser databases like SQLite via WebAssembly), generating SQL on the client-side to be sent to a server **is a significant security risk and is strongly discouraged** in typical web applications.

#### 📦 Installation

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
  /*IF projectNames != null && projectNames.length*/AND project_name IN (/*projectNames*/'project1')/*END*/
  /*IF statuses != null && statuses.length*/AND status IN (/*statuses*/1)/*END*/
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

##### Example 2: Dynamic WHERE Clause with `ELSEIF/ELSE`

**Template:**

```sql
SELECT
  *
FROM users
WHERE
  1 = 1
  /*IF role === 'admin'*/
    AND access_level = 99
  /*ELSEIF role === 'editor'*/
    AND access_level = 50
  /*ELSE*/
    AND access_level = 1
  /*END*/
```

**Code:**

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();

const template = `...`; // The SQL template from above

const bindEntity1 = {
  role: 'editor'
};

// SCENARIO A: Matched with ELSEIF condition
const sql = builder.generateSQL(template, bindEntity1);
console.log(sql1);

// SCENARIO B: Matched with ELSE condition
const bindEntity2 = {
  role: 'read'
};
const sql2 = builder.generateSQL(template, bindEntity2);
console.log(sql2);
```

**Resulting SQL:**

* SQL 1 (Scenario A)

```sql
SELECT
  *
FROM users
WHERE
  1 = 1
  AND access_level = 50
```

* SQL 2 (Scenario B)

```sql
SELECT
  *
FROM users
WHERE
  1 = 1
  AND access_level = 1
```

##### Example 3: FOR Loop

Use a `/*FOR...*/` block to iterate over an array and generate SQL for each item. This is useful for building multiple `LIKE` conditions.

**Template:**

```sql
SELECT * FROM activity
WHERE
  1 = 0
  /*FOR id:targetIds*/
  OR id = /*id*/0
  /*END*/
ORDER BY
  CASE id
    /*FOR id: targetids*/
    WHEN /*id*/0 THEN /*_count*/1
    /*END*/
```

**Code:**

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();
const template = `...`; // The SQL template from above

const bindEntity = {
  targetIds: [28, 26, 27]
};

const sql = builder.generateSQL(template, bindEntity);
console.log(sql);
```

**Resulting SQL:**

```sql
SELECT * FROM activity
WHERE
  1 = 0
  OR id = 28
  OR id = 26
  OR id = 27
ORDER BY
  CASE id
    WHEN 28 THEN 1
    WHEN 26 THEN 2
    WHEN 27 THEN 3
  END
```

### 📚 API Reference

##### `new SQLBuilder(bindType?: 'postgres' | 'mysql' | 'oracle' | 'mssql')`

Creates a new instance of the SQL builder.

The bindType parameter is optional. If provided in the constructor, you do not need to specify it again when calling `generateParameterizedSQL`. This is useful for projects that consistently use a single database type.

**Note on `bindType` Mapping:**
While `bindType` explicitly names PostgreSQL, MySQL, Oracle and SQL Server the generated placeholder syntax is compatible with other SQL databases as follows:

| `bindType` | Placeholder Syntax | Compatible Databases | Bind Parameter Type |
| :------------- | :----------------- | :------------------- | :------------------ |
| `postgres`     | `$1`, `$2`, ...    | **PostgreSQL** | `Array<any>`        |
| `mysql`        | `?`, `?`, ...      | **MySQL**, **SQLite** (for unnamed parameters) | `Array<any>`        |
| `oracle`       | `:name`, `:age`, ... | **Oracle**, **SQLite** (for named parameters) | `Record<string, any>` |
| `mssql`        | `@name`, `@age`, ... | **SQL Server** (for named parameters) | `Record<string, any>` |

##### `generateSQL(template: string, entity: Record<string, any>): string`

Generates a final SQL string by processing the template with the provided data entity.

* `template`: The SQL template string containing S2Dao-style comments.
* `entity`: A data object whose properties are used for evaluating conditions (`/*IF...*/`) and binding values (`/*variable*/`).
* Returns: The generated SQL string.

⚠️ **Limitations**

`generateSQL` is designed to generate **database-agnostic SQL**.
Therefore, it does **not support database-specific or non-standard SQL syntax** that requires dialect-aware parsing or parameter binding.

Examples of unsupported constructs include (but are not limited to):

- PostgreSQL-specific syntax such as `ANY ($1::text[])`
- Vendor-specific extensions that cannot be safely rendered as literals

If you need to use database-specific features, use `generateParameterizedSQL` with an explicit `bindType`.

##### `generateParameterizedSQL(template: string, entity: Record<string, any>, bindType?: 'postgres' | 'mysql' | 'oracle' | 'mssql'): [string, Array<any> | Record<string, any>]`

Generates a SQL string with placeholders for prepared statements and returns bind parameters.
This method prevents SQL injection for value bindings by using parameterized queries.

* `template`: The SQL template string containing S2Dao-style comments.
* `entity`: A data object whose properties are used for evaluating conditions (`/*IF...*/`) and binding values.
* `bindType`: Specifies the database type ('postgres', 'mysql', or 'oracle') to determine the correct placeholder syntax (`$1`, `?`, or `:name`).

* Returns: A tuple `[sql, bindParams]`.
* `sql`: The generated SQL query with appropriate placeholders.
* `bindParams`: An array of values (for PostgreSQL/MySQL) or an object of named values (for Oracle/SQL Server) to bind to the placeholders.

##### Example 4: Parameterized SQL with PostgreSQL

**Template:**

```sql
SELECT
  id,
  user_name
FROM users
/*BEGIN*/WHERE
  1 = 1
  /*IF userId != null*/AND user_id = /*userId*/0/*END*/
  /*IF projectNames.length*/AND project_name IN (/*projectNames*/'default_project')/*END*/
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

```sql
SQL:
  SELECT
    id,
    user_name
  FROM users
  WHERE
    1 = 1
    AND user_id = $1
    AND project_name IN ($2, $3)

Parameters:
  [ 123, 'project_a', 'project_b' ]
```

##### Example 5: INSERT with NULL normalization

**Template:**

```sql
INSERT INTO users (
  user_id,
  user_name,
  email,
  age
) VALUES (
  /*userId*/0,
  /*userName*/'anonymous',
  /*email*/'dummy@example.com',
  /*age*/0
)
```

**Code:**

```typescript
import { SQLBuilder } from '@digitalwalletcorp/sql-builder';

const builder = new SQLBuilder();

const template = `...`; // The SQL template from above

const bindEntity = {
  userId: 1001,
  userName: 'Alice',
  email: undefined, // optional column (not provided)
  age: null         // optional column (explicitly null)
};

const sql1 = builder.generateSQL(
  template,
  bindEntity
);

console.log('SQL1:', sql1);

const [sql2, params2] = builder.generateParameterizedSQL(
  template,
  bindEntity,
  'postgres'
);

console.log('SQL2:', sql2);
console.log('Parameters2:', params2);
```

**Result:**

```sql
SQL1:
  INSERT INTO users (
    user_id,
    user_name,
    email,
    age
  ) VALUES (
    1001,
    'Alice',
    NULL,
    NULL
  )

SQL2:
  INSERT INTO users (
    user_id,
    user_name,
    email,
    age
  ) VALUES (
    $1,
    $2,
    $3,
    $4
  )

Parameters2:
  [ 1001, 'Alice', null, null ]
```

**Notes:**

- For both `generateSQL` and `generateParameterizedSQL`, `undefined` and `null` values are normalized to SQL `NULL`.
- This behavior is especially important for INSERT / UPDATE statements, where the number of columns and values must always match.
- NOT NULL constraint violations are intentionally left to the database.
- If you need to handle `IS NULL` conditions explicitly, you can use `/*IF */` blocks as shown below:

```sql
WHERE
  1 = 1
  /*IF param == null*/AND param IS NULL/*END*/
  /*IF param != null*/AND param = /*param*/'abc'/*END*/
```

**⚠️ Strict Binding Check:**
- Every bind tag (e.g., `/*userId*/`) **must have a corresponding property** in the `bindEntity`.
- If a property is missing in the `bindEntity`, the builder will throw an `Error` to prevent generating invalid or unintended SQL.
- If you want to bind a `NULL` value, explicitly set the property to `null` or `undefined`.

### 🪄 Special Comment Syntax

| Tag | Syntax | Description |
| --- | --- | --- |
| IF | `/*IF condition*/ ... /*END*/` | Includes the enclosed SQL fragment only if the `condition` evaluates to a truthy value. The condition is a JavaScript expression evaluated against the `entity` object. |
| ELSEIF | `/*ELSEIF condition*/ ...` | Evaluates only if the preceding `IF` or `ELSEIF` was false. Must be placed inside an `IF` block. |
| ELSE | `/*ELSE*/ ...`	| Included if all preceding `IF` and `ELSEIF` conditions in the block were false. |
| BEGIN | `/*BEGIN*/ ... /*END*/` | A wrapper block, typically for a `WHERE` clause. The entire block is included only if at least one inner `IF/ELSEIF/ELSE` or `FOR` block is active. This intelligently removes the `WHERE` keyword if no filters apply. |
| FOR | `/*FOR item:collection*/ ... /*END*/` | Iterates over the `collection` array. For each loop, the current value is available as `item`. Additionally, inside the loop, `_index` (0-based) and `_count` (1-based) are available. If your entity already contains these properties, your values will take priority, meaning `_index` and `_count` properties for `FOR` tag will not work as expected. |
| Bind Variable | `/*variable*/` | Binds a value from the `entity`. Strings are quoted `'value'`, numbers are rendered as-is `123`. When the value is an array, elements are expanded into a comma-separated list. The template may contain zero or one dummy expression after a bind tag. If present, only a single SQL expression is allowed. Multiple comma-separated dummy values are not supported. |
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

#### Vendor Dependency TIPS

**PostgreSQL**

When using PostgreSQL-specific features such as `ANY` with array parameters,
the SQL template must be written in a form that is valid PostgreSQL SQL by itself.

For example, to use `ANY` with a text array, write the array literal directly in the template.
The builder will replace the **entire array literal** with a single bind placeholder:

```sql
AND user_id = ANY (/*userIds*/ARRAY['U100','U101']::text[])
```

This will be rendered as:

```sql
AND user_id = ANY ($1::text[])
```

with the following bind parameters:

```typescript
[ ['U100', 'U101'] ]
```

**MSSQL**

When working with a large number of values for an IN condition in SQL Server, directly expanding them into:

```sql
WHERE UserID IN (1, 2, 3, ..., N)
```

may lead to:

* **No Parameter Limits:** Counts as only 1 parameter regardless of array size.
* **Better Performance:** Avoids the overhead of parsing thousands of individual parameters.
* **Type Safety:** `OPENJSON` allows explicit type mapping (e.g., `INT`, `UNIQUEIDENTIFIER`).

SQL Server has a maximum limit of 2,100 parameters per RPC request. When using large IN (...) clauses via drivers like `Tedious`, each item in the list is typically treated as a separate parameter.

**Template:**

```sql
DECLARE @jsonUserIds NVARCHAR(MAX) = N'[/*userIds*/100]';

WITH T AS (
  SELECT value AS UserID
  FROM OPENJSON(@jsonUserIds)
)
SELECT
  U.UserID,
  U.Status,
  U.CreatedAt,
  U.UpdatedAt
FROM Users U
JOIN T
  ON U.UserID = T.UserID
```

**Code:**

```typescript
const template = '...'; // above SQL
const builder = new SQLBuilder();
const [sql, params] = builder.generateParameterizedSQL(template, { userIds: [100, 101, 102, 103] }, 'mssql');
console.log(sql, params);
```

**Result:**

```sql
SQL:
  DECLARE @jsonUserIds NVARCHAR(MAX) = @userIds;

  WITH T AS (
    SELECT value AS UserID
    FROM OPENJSON(@jsonUserIds)
  )
  SELECT
    U.UserID,
    U.Status,
    U.CreatedAt,
    U.UpdatedAt
  FROM Users U
  JOIN T
    ON U.UserID = T.UserID

Parameters:
  {
    userIds: '[100,101,102,103]'
  }
```

By passing the array as a single JSON parameter and expanding it with OPENJSON, you can avoid large IN (...) lists and handle arbitrarily large collections in a clean and scalable way.

---

#### 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://opensource.org/licenses/MIT) file for details.
