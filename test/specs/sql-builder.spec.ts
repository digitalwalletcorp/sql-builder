import { SQLBuilder } from '@/sql-builder';

/**
 * フォーマッター
 *
 * @param {string} sql
 * @returns {string}
 */
const formatSQL = (sql: string): string => {
  let str = '';
  if (sql) {
    const lines = sql.split('\n');
    for (const line of lines) {
      if (!line.match(/^[\s]*\-\-.*$/)) {
        str += line;
        str += ' ';
      }
    }
  }
  return str.trim().replace(/\r\n|\r|\n/g, ' ').replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ');
}

describe('@/server/common/sql-builder.ts', () => {
  describe('generateSQL', () => {
    describe('Typical Test Cases', () => {
      it('generateSQL.typical.001', () => {
        // すべてのIF条件が成立する(BEGINあり)
        const builder = new SQLBuilder();
        const template = `
          SELECT COUNT(*) AS cnt FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
          /*END*/
        `;
        const bindEntity = {
          projectNames: ['pj1', 'pj2'],
          nodeNames: ['node1', 'node2'],
          jobNames: ['job1', 'job2'],
          statuses: [1, 2]
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            AND project_name IN ('pj1','pj2')
            AND node_name IN ('node1','node2')
            AND job_name IN ('job1','job2')
            AND status IN (1,2)
        `));
      });
      it('generateSQL.typical.002', () => {
        // すべてのIF条件が成立する(BEGINなし)
        const builder = new SQLBuilder();
        const template = `
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
        `;
        const bindEntity = {
          projectNames: ['pj1', 'pj2'],
          nodeNames: ['node1', 'node2'],
          jobNames: ['job1', 'job2'],
          statuses: [1, 2]
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            AND project_name IN ('pj1','pj2')
            AND node_name IN ('node1','node2')
            AND job_name IN ('job1','job2')
            AND status IN (1,2)
        `));
      });
      it('generateSQL.typical.003', () => {
        // IF条件の一部が成立しない
        const builder = new SQLBuilder();
        const template = `
          SELECT COUNT(*) AS cnt FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
          /*END*/
        `;
        const bindEntity = {
          projectNames: ['pj1', 'pj2'],
          statuses: [1, 2]
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            AND project_name IN ('pj1','pj2')
            AND status IN (1,2)
        `));
      });
      it('generateSQL.typical.004', () => {
        // IF条件のすべてが成立しない(BEGIN内が成立しない)
        const builder = new SQLBuilder();
        const template = `
          SELECT COUNT(*) AS cnt FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
          /*END*/
        `;
        const bindEntity = {
          projectNames: [] // 長さ0の配列
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT COUNT(*) AS cnt FROM activity
        `));
      });
      it('generateSQL.typical.005', () => {
        // NULL値のバインド
        const builder = new SQLBuilder();
        const template = `
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
        `;
        const bindEntity = {
          userId: 1001,
          userName: 'Alice',
          email: undefined,
          age: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
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
        `));
      });
    });

    describe('Syntax Test Cases', () => {
      it('generateSQL.syntax.001', () => {
        // FOR文の展開(BEGINあり)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*FOR name:projectNames*/AND project_name LIKE '%' || /*name*/'aaa' || '%'/*END*/
          /*END*/
        `;
        const bindEntity = {
          projectNames: ['aaa', 'bbb', 'ccc']
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND project_name LIKE '%' || 'aaa' || '%'
            AND project_name LIKE '%' || 'bbb' || '%'
            AND project_name LIKE '%' || 'ccc' || '%'
        `));
      });
      it('generateSQL.syntax.002', () => {
        // FOR文の展開(BEGINなし)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*FOR name:projectNames*/AND project_name LIKE '%' || /*name*/'aaa' || '%'/*END*/
        `;
        const bindEntity = {
          projectNames: ['aaa', 'bbb', 'ccc']
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND project_name LIKE '%' || 'aaa' || '%'
            AND project_name LIKE '%' || 'bbb' || '%'
            AND project_name LIKE '%' || 'ccc' || '%'
        `));
      });
      it('generateSQL.syntax.003', () => {
        // 特殊ケース: FOR文の中にFORと関連しないタグが存在する
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          /*BEGIN*/WHERE
            1 = 1
            /*FOR id:itemIds*/
              AND item_id = /*id*/0
              AND item_name LIKE '%' || /*name*/'default' || '%'
            /*END*/
          /*END*/
        `;
        const bindEntity = {
          itemIds: [1, 2],
          name: 'test' // FORと関連のない値
        };
        const sql = builder.generateSQL(template, bindEntity);
        // 以下のSQLは実際には結果を返さないクエリになるが、生成する分には正しく生成できる
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
            AND item_id = 1
            AND item_name LIKE '%' || 'test' || '%'
            AND item_id = 2
            AND item_name LIKE '%' || 'test' || '%'
        `));
      });
      it('generateSQL.syntax.004', () => {
        // FORのコレクションが null の場合は何も展開されない
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*FOR name:projectNames*/AND project_name LIKE '%' || /*name*/'aaa' || '%'/*END*/
          /*END*/
        `;
        const bindEntity = {
          projectNames: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
        `));
      });
      it('generateSQL.syntax.005', () => {
        // FORのコレクションが undefined の場合は何も展開されない
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*FOR name:projectNames*/AND project_name LIKE '%' || /*name*/'aaa' || '%'/*END*/
            /*IF status != null*/AND status = /*status*/1/*END*/
          /*END*/
        `;
        const bindEntity = {
          status: 10
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND status = 10
        `));
      });
      it('generateSQL.syntax.101', () => {
        // 条件の後にバインドパラメータなし
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF status === 1*/AND NOW() - INTERVAL 1 days <= modified_at/*END*/
        `;
        const bindEntity = {
          status: 1
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND NOW() - INTERVAL 1 days <= modified_at
        `));
      });
      it('generateSQL.syntax.102', () => {
        // 未定義のタグ記載時 => 構文不正とみなしてエラーを返す
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            AND name = /*UNKNOWN_TAG*/
        `;
        const bindEntity = {};
        expect(() => {
          builder.generateSQL(template, bindEntity);
        }).toThrow(`[SQLBuilder] The property "UNKNOWN_TAG" is not found in the bind entity. (Template index: 91)`);
      });
      it('generateSQL.syntax.103', () => {
        // バインドパラメータがSQL関数内に存在するケース
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            AND status = 1
            AND data_key = 'Name'
            AND CAST(/*since*/'2025-06-17T15:00:00.000+00:00' AS timestamp with time zone) <= modified_at
            AND modified_at < CAST(/*until*/'2025-06-18T15:00:00.000+00:00' AS timestamp with time zone)
        `;
        const bindEntity = {
          since: '2024-12-31T15:00:00.000+00:00',
          until: '2025-01-01T15:00:00.000+00:00'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND status = 1
            AND data_key = 'Name'
            AND CAST('2024-12-31T15:00:00.000+00:00' AS timestamp with time zone) <= modified_at
            AND modified_at < CAST('2025-01-01T15:00:00.000+00:00' AS timestamp with time zone)
        `));
      });
      it('generateSQL.syntax.104', () => {
        // バインド変数の前後にスペースを含む書き方の場合(問題なくサポートできる)
        // /*IF projectNames.length */
        // /* projectNames */
        const builder = new SQLBuilder();
        const template = `
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            /*IF projectNames.length */ AND project_name IN /* projectNames */('project1') /*END*/
            /*IF nodeNames.length */ AND node_name IN /* nodeNames */('node1') /*END*/
            /*IF jobNames.length */ AND job_name IN /* jobNames */('job1') /*END*/
            /*IF statuses.length */ AND status IN /* statuses */(1) /*END*/
        `;
        const bindEntity = {
          projectNames: ['pj1', 'pj2'],
          nodeNames: ['node1', 'node2'],
          jobNames: ['job1', 'job2'],
          statuses: [1, 2]
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT COUNT(*) AS cnt FROM activity
          WHERE
            1 = 1
            AND project_name IN ('pj1','pj2')
            AND node_name IN ('node1','node2')
            AND job_name IN ('job1','job2')
            AND status IN (1,2)
        `));
      });
      it('generateSQL.syntax.105', () => {
        // IFの単純なネストを含む構文
        const countSqlTemplate = `
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
            /*IF status == 10*/
              /*IF jobNames != null && jobNames.length*/AND job_names IN /*jobNames*/('jobname')/*END*/
            /*END*/
        `;
        const bindEntity = {
          status: 10,
          jobNames: ['job1', 'job2']
        };
        const builder = new SQLBuilder('postgres');
        const sql = builder.generateSQL(countSqlTemplate, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
            AND job_names IN ('job1','job2')
        `));
      });
      it('generateSQL.syntax.106', () => {
        // IFの単純なネストを含む構文(上位のIFでfalse判定)
        const countSqlTemplate = `
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
            /*IF status == 10*/
              /*IF jobNames != null && jobNames.length*/AND job_names IN /*jobNames*/('jobname')/*END*/
            /*END*/
        `;
        const bindEntity = {
          status: 9,
          jobNames: ['job1', 'job2']
        };
        const builder = new SQLBuilder('postgres');
        const sql = builder.generateSQL(countSqlTemplate, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.syntax.107', () => {
        // IFの単純なネストを含む構文(下位のIFでfalse判定)
        const countSqlTemplate = `
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
            /*IF status == 10*/
              /*IF jobNames != null && jobNames.length*/AND job_names IN /*jobNames*/('jobname')/*END*/
            /*END*/
        `;
        const bindEntity = {
          status: 10,
          jobNames: []
        };
        const builder = new SQLBuilder('postgres');
        const sql = builder.generateSQL(countSqlTemplate, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            COUNT(*) AS "cnt"
          FROM activity
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.syntax.108', () => {
        // BEGEIN・IFのネストを含む構文
        const countSqlTemplate = `
          SELECT
            COUNT(*) AS "cnt"
          FROM judgement
          /*BEGIN*/WHERE
            1 = 1
            /*IF userIds?.length*/AND user_id IN /*userIds*/(123)/*END*/
            /*IF targetDate*/AND target_date = /*targetDate*/'2025-07-05'/*END*/
            /*IF notProcessed != null && modified != null && misjudged != null*/AND (
              /*BEGIN*/
                /*IF notProcessed*/misjudge IS NULL/*END*/
                /*IF notProcessed && (modified || misjudged)*/OR/*END*/
                /*IF modified*/misjudge = false/*END*/
                /*IF modified && misjudged*/OR/*END*/
                /*IF misjudged*/misjudge = true/*END*/
              /*END*/
            )/*END*/
          /*END*/
        `;
        const bindEntity = {
          userIds: [12345],
          targetDate: '2025-08-01',
          notProcessed: true,
          modified: true,
          misjudged: true,
          limit: 0,
          offset: 100
        };
        const builder = new SQLBuilder('postgres');
        const sql = builder.generateSQL(countSqlTemplate, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            COUNT(*) AS "cnt"
          FROM judgement
          WHERE
            1 = 1
            AND user_id IN (12345)
            AND target_date = '2025-08-01'
            AND (
              misjudge IS NULL
              OR
              misjudge = false
              OR
              misjudge = true
            )
        `));
      });
      it('generateSQL.syntax.109', () => {
        // ダミーパラメータを含まない場合(推奨はしない書き方)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM table
          WHERE
            user_id = /*userId*/,
            AND remarks = /*remarks*/,
            AND verified IS TRUE,
            AND /*verifiedAt*/ < verified_at
        `;
        const bindEntity = {
          userId: 12345,
          remarks: 'aaa,bbb,ccc',
          verifiedAt: '2025-07-05'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM table
          WHERE
            user_id = 12345,
            AND remarks = 'aaa,bbb,ccc',
            AND verified IS TRUE,
            AND '2025-07-05' < verified_at
        `));
      });
      it('generateSQL.syntax.110', () => {
        // ANY/CAST構文 => generateSQLでは未サポート
        const builder = new SQLBuilder();
        const template = `
          SELECT
            id
          FROM users
          WHERE
            status = /*status*/1
            AND name = ANY (/*names*/ARRAY['John']::text[])
        `;
        const bindEntity = {
          status: 10,
          names: ['Bob', 'Alice']
        };
        expect(() => builder.generateSQL(template, bindEntity)).toThrow('PostgreSQL array bind (::type[]) is not supported in generateSQL.');
      });
    });

    describe('Operator Test Cases', () => {
      it('generateSQL.operator.001', () => {
        // IFに'!= null'を含む(全不一致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*IF projectNames != null && projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames != null && nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames != null && jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses != null && statuses.length*/AND status IN /*statuses*/(1)/*END*/
            /*END*/
          ORDER BY started_at DESC NULLS LAST
          /*IF limit != null*/LIMIT /*limit*/100/*END*/
          /*IF offset != null*/OFFSET /*offset*/0/*END*/
        `;
        const bindEntity = {};
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          ORDER BY started_at DESC NULLS LAST
        `));
      });
      it('generateSQL.operator.002', () => {
        // IFに'!= null'を含む(一部一致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          /*BEGIN*/WHERE
            1 = 1
            /*IF projectNames != null && projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
            /*IF nodeNames != null && nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
            /*IF jobNames != null && jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
            /*IF statuses != null && statuses.length*/AND status IN /*statuses*/(1)/*END*/
          /*END*/
          ORDER BY started_at DESC NULLS LAST
          /*IF limit != null*/LIMIT /*limit*/100/*END*/
          /*IF offset != null*/OFFSET /*offset*/0/*END*/
        `;
        const bindEntity = {
          jobNames: ['job1', 'job2'],
          limit: 50
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND job_name IN ('job1','job2')
          ORDER BY started_at DESC NULLS LAST
          LIMIT 50
        `));
      });
      it('generateSQL.operator.003', () => {
        // 数値の大小比較
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF 100 <= timeout && timeout <= 200*/AND timeout <= /*timeout*/ /*END*/
        `;
        const bindEntity = {
          timeout: 150
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND timeout <= 150
        `));
      });
      it('generateSQL.operator.004', () => {
        // 数値の大小比較
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF 100 <= timeout && timeout <= 200*/AND timeout <= /*timeout*/ /*END*/
        `;
        const bindEntity = {
          timeout: 250
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.operator.005', () => {
        // !!演算子(合致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF !!itemName*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: 'itemname'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
            AND name = 'itemname'
        `));
      });
      it('generateSQL.operator.006', () => {
        // !!演算子(非合致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF !!itemName*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: ''
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.operator.007', () => {
        // !演算子(合致:空文字)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF !itemName*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: ''
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
            AND name = ''
        `));
      });
      it('generateSQL.operator.008', () => {
        // !演算子(合致:null) => NULLが設定されるが、本来IS NULLになるようにテンプレートを作成すべきもの
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF !itemName*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
            AND name = NULL
        `));
      });
      it('generateSQL.operator.009', () => {
        // !演算子(非合致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF !itemName*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: 'itemname'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.operator.010', () => {
        // ?演算子(optional chaining)(合致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF itemName?.length*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: 'itemname'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
            AND name = 'itemname'
        `));
      });
      it('generateSQL.operator.011', () => {
        // ?演算子(optional chaining)(非合致)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM items
          WHERE
            1 = 1
            /*IF itemName?.length*/AND name = /*itemName*/'name'/*END*/
        `;
        const bindEntity = {
          itemName: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM items
          WHERE
            1 = 1
        `));
      });
      it('generateSQL.operator.012', () => {
        // || (OR条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 'a' || id === 'b'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'b'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = 'b'
        `));
      });
      it('generateSQL.operator.013', () => {
        // || (OR条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 'a' || id === 'b'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'c'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.014', () => {
        // && (AND条件 -- 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF 1 <= id.length && id.length <= 3*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'ab'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = 'ab'
        `));
      });
      it('generateSQL.operator.015', () => {
        // && (AND条件 -- 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF 1 <= id.length && id.length <= 3*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'abcd'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.016', () => {
        // == (等価条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id == 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'x'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = 'x'
        `));
      });
      it('generateSQL.operator.017', () => {
        // == (等価条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id == 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'y'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.018', () => {
        // != (不等価条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id != 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'y'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = 'y'
        `));
      });
      it('generateSQL.operator.019', () => {
        // != (不等価条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id != 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'x'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.020', () => {
        // === (厳密等価条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'x'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = 'x'
        `));
      });
      it('generateSQL.operator.021', () => {
        // === (厳密等価条件 - 不成立, 型違い)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 1*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: '1' // 文字列の'1'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.022', () => {
        // !== (厳密不等価条件 - 成立, 型違い)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id !== 1*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: '1' // 文字列の'1'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            id = '1'
        `));
      });
      it('generateSQL.operator.023', () => {
        // !== (厳密不等価条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id !== 'x'*/id = /*id*/'a'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'x'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.024', () => {
        // === (厳密等価条件:nullに対する判定 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            1 = 1
            /*IF id === null*/AND id = 'x'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            1 = 1
            AND id = 'x'
        `));
      });
      it('generateSQL.operator.025', () => {
        // === (厳密等価条件:nullに対する判定 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            1 = 1
            /*IF id === null*/AND id = 'x'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: undefined
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.026', () => {
        // === (厳密等価条件:undefinedに対する判定 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            1 = 1
            /*IF id === undefined*/AND id = 'x'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: undefined
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            1 = 1
            AND id = 'x'
        `));
      });
      it('generateSQL.operator.027', () => {
        // === (厳密等価条件:undefinedに対する判定 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            1 = 1
            /*IF id === undefined*/AND id = 'x'/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 'a'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.028', () => {
        // < (未満条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age < 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 25
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            age = 25
        `));
      });
      it('generateSQL.operator.029', () => {
        // < (未満条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age < 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 30
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.030', () => {
        // <= (以下条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age <= 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 30
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            age = 30
        `));
      });
      it('generateSQL.operator.031', () => {
        // <= (以下条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age <= 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 31
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.032', () => {
        // > (より大条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age > 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 31
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            age = 31
        `));
      });
      it('generateSQL.operator.033', () => {
        // > (より大条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age > 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 30
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.034', () => {
        // >= (以上条件 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age >= 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 30
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            age = 30
        `));
      });
      it('generateSQL.operator.035', () => {
        // >= (以上条件 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF age >= 30*/age = /*age*/0/*END*/
          /*END*/
        `;
        const bindEntity = {
          age: 29
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operator.036', () => {
        // ! (NOT演算子 - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF !isAdmin*/status = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isAdmin: false
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            status = 0
        `));
      });
      it('generateSQL.operator.037', () => {
        // ! (NOT演算子 - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF !isAdmin*/status = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isAdmin: true
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
    });

    describe('Multiple Operator Test Cases', () => {
      it('generateSQL.multiple-operator.001', () => {
        // 複合条件: ORとANDの組み合わせと括弧
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (role === 'admin' || role === 'super_user') && status === 'active'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          role: 'admin',
          status: 'active'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.multiple-operator.002', () => {
        // 複合条件: ORとANDの組み合わせと括弧 (不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (role === 'admin' || role === 'super_user') && status === 'active'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          role: 'user',
          status: 'active'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
    });

    describe('Operand Test Cases', () => {
      it('generateSQL.operand.001', () => {
        // NULLとの比較 (== null) - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF username == null*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          username: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.002', () => {
        // NULLとの比較 (== null) - 不成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF username == null*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          username: 'test'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.003', () => {
        // UNDEFINEDとの比較 (=== undefined) - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF username === undefined*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          // username: undefined, // undefinedなプロパティはオブジェクトに存在しない
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.004', () => {
        // UNDEFINEDとの比較 (=== undefined) - 不成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF username === undefined*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          username: 'test'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.005', () => {
        // 文字列リテラルとの比較 (=== 'abc') - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF status === 'active'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          status: 'active'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.006', () => {
        // 文字列リテラルとの比較 (=== 'abc') - 不成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF status === 'active'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          status: 'inactive'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.007', () => {
        // 数値リテラルとの比較 (=== 123) - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 123*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 123
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.008', () => {
        // 数値リテラルとの比較 (=== 123) - 不成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF id === 123*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          id: 456
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.009', () => {
        // プロパティが存在しない場合の評価 (false)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF nonExistentProp*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          // nonExistentProp は存在しない
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.010', () => {
        // プロパティがundefinedの場合の評価 (false)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF undefinedProp*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          undefinedProp: undefined
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.011', () => {
        // プロパティがnullの場合の評価 (false)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF nullProp*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          nullProp: null
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.operand.012', () => {
        // Booleanリテラルとの比較 (true) - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF isActive === true*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isActive: true
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.013', () => {
        // Booleanリテラルとの比較 (false) - 成立
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF isActive === false*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isActive: false
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.operand.014', () => {
        // バインドパラメータ中にカンマを含む場合
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM table
          WHERE
            user_id = /*userId*/0,
            AND remarks = /*remarks*/'a,b,c',
            AND verified IS TRUE
        `;
        const bindEntity = {
          userId: 12345,
          remarks: 'aaa,bbb,ccc'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM table
          WHERE
            user_id = 12345,
            AND remarks = 'aaa,bbb,ccc',
            AND verified IS TRUE
        `));
      });
      it('generateSQL.operand.015', () => {
        // バインドパラメータ中にシングルクォートを含む場合
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM table
          WHERE
            user_id = /*userId*/0,
            AND remarks = /*remarks*/'a,b,c',
            AND verified IS TRUE
        `;
        const bindEntity = {
          userId: 12345,
          remarks: '\'aaa\',\'bbb\',\'ccc\''
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM table
          WHERE
            user_id = 12345,
            AND remarks = '''aaa'',''bbb'',''ccc''',
            AND verified IS TRUE
        `));
      });
    });

    describe('Grouping Test Cases', () => {
      it('generateSQL.grouping.001', () => {
        // 括弧によるグループ化 (成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (isAdmin || isEditor) && isActive*/status = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isAdmin: true,
          isEditor: false,
          isActive: true
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            status = 0
        `));
      });
      it('generateSQL.grouping.002', () => {
        // 括弧によるグループ化 (不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (isAdmin || isEditor) && isActive*/status = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          isAdmin: false,
          isEditor: false,
          isActive: true
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.grouping.003', () => {
        // 括弧の評価とオペレータースタックでの '(' の処理
        // shuntingYardの '(' 処理
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF a > 10 && (b < 20 || c === true)*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          a: 15,
          b: 15,
          c: false
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.grouping.004', () => {
        // 括弧外のNOT演算子
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF !(status === 'inactive')*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          status: 'active'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.grouping.005', () => {
        // 括弧内の演算優先順位 (aだけがtruthy - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (a || b && c)*/user_id = /*userId*/'abc'/*END*/
          /*END*/
        `;
        const bindEntity = {
          a: 'a',
          b: undefined,
          c: null,
          userId: '12345'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = '12345'
        `));
      });
      it('generateSQL.grouping.006', () => {
        // 括弧内の演算優先順位 (bだけがtruthy - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (a || b && c)*/user_id = /*userId*/'abc'/*END*/
          /*END*/
        `;
        const bindEntity = {
          a: undefined,
          b: 'b',
          c: null,
          userId: '12345'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.grouping.007', () => {
        // 括弧内の演算優先順位 (cだけがtruthy - 不成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (a || b && c)*/user_id = /*userId*/'abc'/*END*/
          /*END*/
        `;
        const bindEntity = {
          a: null,
          b: undefined,
          c: 'c',
          userId: '12345'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
        `));
      });
      it('generateSQL.grouping.008', () => {
        // 括弧内の演算優先順位 (bとcがtruthy - 成立)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF (a || b && c)*/user_id = /*userId*/'abc'/*END*/
          /*END*/
        `;
        const bindEntity = {
          a: null,
          b: 'b',
          c: 'c',
          userId: '12345'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = '12345'
        `));
      });
      it('generateSQL.grouping.009', () => {
        // IFで生成されるSQLに括弧を含むケース
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF region == 'JP' || region == 'JPTR'*/AND (region IS NOT NULL OR region = /*region*/'XX')/*END*/
            /*IF region == 'CA'*/AND region = /*region*/'XX'/*END*/
        `;
        const bindEntity = {
          region: 'JP'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND (region IS NOT NULL OR region = 'JP')
        `));
      });
      it('generateSQL.grouping.010', () => {
        // IFで生成されるSQLに括弧を含むケース
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF region == 'JP' || region == 'JPTR'*/AND (region IS NOT NULL OR region = /*region*/'XX')/*END*/
            /*IF region == 'CA'*/AND region = /*region*/'XX'/*END*/
        `;
        const bindEntity = {
          region: 'JPTR'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND (region IS NOT NULL OR region = 'JPTR')
        `));
      });
      it('generateSQL.grouping.011', () => {
        // IFで生成されるSQLに括弧を含むケース
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM activity
          WHERE
            1 = 1
            /*IF region == 'JP' || region == 'JPTR'*/AND (region IS NOT NULL OR region = /*region*/'XX')/*END*/
            /*IF region != 'JP' && region != 'JPTR'*/AND region = /*region*/'XX'/*END*/
        `;
        const bindEntity = {
          region: 'CA'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM activity
          WHERE
            1 = 1
            AND region = 'CA'
        `));
      });
    });

    describe('Special Chars Test Cases', () => {
      it('generateSQL.special-chars.001', () => {
        // シングルクォートのエスケープ
        const builder = new SQLBuilder();
        const template = `
          SELECT
            user_id
          FROM user
          WHERE
            data_key = /*param*/'Name'
        `;
        const bindEntity = {
          param: 'a\'b\'c'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            user_id
          FROM user
          WHERE
            data_key = 'a\'\'b\'\'c'
        `));
      });
      it('generateSQL.special-chars.002', () => {
        // バックスラッシュのエスケープ
        const builder = new SQLBuilder();
        const template = `
          SELECT
            user_id
          FROM user
          WHERE
            data_key = /*param*/'Name'
        `;
        const bindEntity = {
          param: 'a\\b\\c'
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            user_id
          FROM user
          WHERE
            data_key = 'a\\\\b\\\\c'
        `));
      });
      it('generateSQL.special-chars.003', () => {
        // 配列内のエスケープ
        const builder = new SQLBuilder();
        const template = `
          SELECT
            user_id
          FROM user
          WHERE
            data_key IN /*params*/('Name')
        `;
        const bindEntity = {
          params: [
            'a\'b\'c',
            'd\\e\\f'
          ]
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            user_id
          FROM user
          WHERE
            data_key IN ('a\'\'b\'\'c','d\\\\e\\\\f')
        `));
      });
      it('generateSQL.special-chars.004', () => {
        // 文字列内のシングルクォートエスケープ (バックスラッシュ)
        // ASTのtokenizeで '\' が処理されることを確認
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF name === 'O\\'Reilly'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          name: "O'Reilly" // 実際の値はエスケープされていない文字列
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.special-chars.005', () => {
        // 文字列内のバックスラッシュエスケープ (バックスラッシュ自身)
        // ASTのtokenizeで '\\' が処理されることを確認
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF path === 'C:\\\\Program Files'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          path: "C:\\Program Files" // 実際の値はエスケープされていない文字列
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
      it('generateSQL.special-chars.006', () => {
        // 文字列内のバックスラッシュと他の文字の組み合わせ (不正でないことの確認)
        // ASTのtokenizeで \' や \\ が処理されることを確認
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF desc === 'a\\\'b\\\\c'*/user_id = 0/*END*/
          /*END*/
        `;
        const bindEntity = {
          desc: "a'b\\c"
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT * FROM user
          WHERE
            user_id = 0
        `));
      });
    });

    describe('Special SQL Syntax Test Cases', () => {
      it('generateSQL.special-sql-syntax.001', () => {
        // INTERVALを使ったクエリ_1
        const builder = new SQLBuilder();
        const template = `
          SELECT
            wallet_id
          FROM check_identification_result
          WHERE
            verify_result IS TRUE
            /*IF verifyExcludeDays !== -1*/AND NOW() - INTERVAL /*verifyExcludeDays*/30 days <= verified_at/*END*/
        `;
        const bindEntity = {
          verifyExcludeDays: -1
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            wallet_id
          FROM check_identification_result
          WHERE
            verify_result IS TRUE
        `));
      });
      it('generateSQL.special-sql-syntax.002', () => {
        // INTERVALを使ったクエリ_2
        const builder = new SQLBuilder();
        const template = `
          SELECT
            wallet_id
          FROM check_identification_result
          WHERE
            verify_result IS TRUE
            /*IF verifyExcludeDays !== -1*/AND NOW() - INTERVAL '/*verifyExcludeDays*/30 days 12 hours' <= verified_at/*END*/
        `;
        const bindEntity = {
          verifyExcludeDays: 7
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          SELECT
            wallet_id
          FROM check_identification_result
          WHERE
            verify_result IS TRUE
            AND NOW() - INTERVAL '7 days 12 hours' <= verified_at
        `));
      });
      it('generateSQL.special-sql-syntax.003', () => {
        // MERGE文を使ったクエリ
        const builder = new SQLBuilder();
        const template = `
          INSERT INTO check_result (
            user_id,
            given_name,
            middle_name,
            sur_name,
            nationality,
            created_at,
            updated_at
          ) VALUES (
            /*user_id*/12345,
            /*given_name*/'XXX',
            /*middle_name*/'XXX',
            /*sur_name*/'XXX',
            /*nationality*/'XXX',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id) DO UPDATE
          SET
            given_name = EXCLUDED.given_name,
            middle_name = EXCLUDED.middle_name,
            sur_name = EXCLUDED.sur_name,
            nationality = EXCLUDED.nationality,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            check_result.updated_at <= NOW() - (/*exclude_days*/10 * INTERVAL '1 days')
        `;
        const bindEntity = {
          user_id: 99999,
          given_name: 'ELIZABETH',
          middle_name: '',
          sur_name: 'TURNER',
          nationality: 'USA',
          exclude_days: 30
        };
        const sql = builder.generateSQL(template, bindEntity);
        expect(formatSQL(sql)).toBe(formatSQL(`
          INSERT INTO check_result (
            user_id,
            given_name,
            middle_name,
            sur_name,
            nationality,
            created_at,
            updated_at
          ) VALUES (
            99999,
            'ELIZABETH',
            '',
            'TURNER',
            'USA',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id) DO UPDATE
          SET
            given_name = EXCLUDED.given_name,
            middle_name = EXCLUDED.middle_name,
            sur_name = EXCLUDED.sur_name,
            nationality = EXCLUDED.nationality,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            check_result.updated_at <= NOW() - (30 * INTERVAL '1 days')
        `));
      });
    });

    describe('Negative Test Cases', () => {
      it('generateSQL.negative.001', () => {
        // IF構文エラー (evaluating condition)
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF userId == 123 '12345'*/user_id = /*userId*/'x'/*END*/
          /*END*/
        `;
        const entity = {
          userId: '12345'
        };
        expect(() => builder.generateSQL(template, entity)).toThrow('Invalid expression:');
      });
      it('generateSQL.negative.002', () => {
        // 許容されない演算子
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM user
          /*BEGIN*/WHERE
            /*IF userId = 123*/user_id = /*userId*/'x'/*END*/
          /*END*/
        `;
        const entity = {
          userId: '12345'
        };
        expect(() => builder.generateSQL(template, entity)).toThrow('Unknown operator: =');
      });
    });
  });

  describe('generateParameterizedSQL', () => {
    describe('Typical Test Cases', () => {
      describe('PostgreSQL', () => {
        it('generateParameterizedSQL.typical.postgresql.001', () => {
          // [postgresql] シンプルなパラメータの展開
          const builder = new SQLBuilder('postgres');
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = /*projectName*/'project1'
              AND node_name = /*nodeName*/'node1'
              AND verified = /*verified*/false
              AND status = /*status*/0
          `;
          const bindEntity = {
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity);
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = $1
              AND node_name = $2
              AND verified = $3
              AND status = $4
          `));
          expect(bindParams).toEqual([
            'pj1',
            'node1',
            true,
            1
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.002', () => {
          // [postgresql] IN句の展開
          const builder = new SQLBuilder();
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            /*BEGIN*/WHERE
              1 = 1
              /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
              /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
              /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
              /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
            /*END*/
          `;
          const bindEntity = {
            projectNames: ['pj1', 'pj2'],
            nodeNames: ['node1', 'node2'],
            jobNames: [],
            statuses: [1, 2]
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              1 = 1
              AND project_name IN ($1,$2)
              AND node_name IN ($3,$4)
              AND status IN ($5,$6)
          `));
          expect(bindParams).toEqual([
            'pj1', 'pj2',
            'node1', 'node2',
            1, 2
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.003', () => {
          // NULL値のバインド
          const builder = new SQLBuilder();
          const template = `
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
          `;
          const bindEntity = {
            userId: 1001,
            userName: 'Alice',
            email: undefined,
            age: null
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
          expect(formatSQL(sql)).toBe(formatSQL(`
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
          `));
          expect(bindParams).toEqual([
            1001, 'Alice',
            null, null
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.004', () => {
          // ANY/CAST構文
          const builder = new SQLBuilder();
          const template = `
            SELECT
              id
            FROM users
            WHERE
              status = /*status*/1
              AND name = ANY (/*names*/array['John']::text[])
          `;
          const bindEntity = {
            status: 10,
            names: ['Bob', 'Alice']
          };
          const [sql, params] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT
              id
            FROM users
            WHERE
              status = $1
              AND name = ANY ($2::text[])
          `));
          expect(params).toEqual([
            10,
            ['Bob', 'Alice']
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.005', () => {
          // NOT ANY/CAST構文
          const builder = new SQLBuilder();
          const template = `
            SELECT
              id
            FROM users
            WHERE
              status = /*status*/1
              AND NOT (name = ANY (/*names*/ARRAY['John']::text[]))
          `;
          const bindEntity = {
            status: 10,
            names: ['Bob', 'Alice']
          };
          const [sql, params] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT
              id
            FROM users
            WHERE
              status = $1
              AND NOT (name = ANY ($2::text[]))
          `));
          expect(params).toEqual([
            10,
            ['Bob', 'Alice']
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.006', () => {
          // ANY/CAST構文でバインドパラメータが空配列の場合
          const builder = new SQLBuilder();
          const template = `
            SELECT
              id
            FROM users
            WHERE
              status = /*status*/1
              AND name = ANY (/*names*/ARRAY['John']::text[])
          `;
          const bindEntity = {
            status: 10,
            names: []
          };
          const [sql, params] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT
              id
            FROM users
            WHERE
              status = $1
              AND name = ANY ($2::text[])
          `));
          expect(params).toEqual([
            10,
            []
          ]);
        });
        it('generateParameterizedSQL.typical.postgresql.007', () => {
          // ANY/CAST構文で記述が不正な場合(::text[]であるべきところ:text[])
          const builder = new SQLBuilder();
          const template = `
            SELECT
              id
            FROM users
            WHERE
              status = /*status*/1
              AND name = ANY (/*names*/ARRAY['John']:text[])
          `;
          const bindEntity = {
            status: 10,
            names: ['Bob', 'Alice']
          };
          expect(() => builder.generateParameterizedSQL(template, bindEntity, 'postgres')).toThrow('[SQLBuilder] PostgreSQL ARRAY bind requires explicit cast (e.g. ARRAY[...]::text[]).');
        });
      });

      describe('MySQL', () => {
        it('generateParameterizedSQL.typical.mysql.001', () => {
          // [mysql] シンプルなパラメータの展開
          const builder = new SQLBuilder('mysql');
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = /*projectName*/'project1'
              AND node_name = /*nodeName*/'node1'
              AND verified = /*verified*/false
              AND status = /*status*/0
          `;
          const bindEntity = {
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity);
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = ?
              AND node_name = ?
              AND verified = ?
              AND status = ?
          `));
          expect(bindParams).toEqual([
            'pj1',
            'node1',
            true,
            1
          ]);
        });
        it('generateParameterizedSQL.typical.mysql.002', () => {
          // [mysql] IN句の展開
          const builder = new SQLBuilder();
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            /*BEGIN*/WHERE
              1 = 1
              /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
              /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
              /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
              /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
            /*END*/
          `;
          const bindEntity = {
            projectNames: ['pj1', 'pj2'],
            nodeNames: ['node1', 'node2'],
            jobNames: [],
            statuses: [1, 2]
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'mysql');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              1 = 1
              AND project_name IN (?,?)
              AND node_name IN (?,?)
              AND status IN (?,?)
          `));
          expect(bindParams).toEqual([
            'pj1', 'pj2',
            'node1', 'node2',
            1, 2
          ]);
        });
      });

      describe('Oracle', () => {
        it('generateParameterizedSQL.typical.oracle.001', () => {
          // [oracle] シンプルなパラメータの展開
          const builder = new SQLBuilder('oracle');
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = /*projectName*/'project1'
              AND node_name = /*nodeName*/'node1'
              AND verified = /*verified*/false
              AND status = /*status*/0
          `;
          const bindEntity = {
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity);
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = :projectName
              AND node_name = :nodeName
              AND verified = :verified
              AND status = :status
          `));
          expect(bindParams).toEqual({
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          });
        });
        it('generateParameterizedSQL.typical.oracle.002', () => {
          // [oracle] IN句の展開
          const builder = new SQLBuilder();
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            /*BEGIN*/WHERE
              1 = 1
              /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
              /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
              /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
              /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
            /*END*/
          `;
          const bindEntity = {
            projectNames: ['pj1', 'pj2'],
            nodeNames: ['node1', 'node2'],
            jobNames: [],
            statuses: [1, 2]
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'oracle');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              1 = 1
              AND project_name IN (:projectNames_0,:projectNames_1)
              AND node_name IN (:nodeNames_0,:nodeNames_1)
              AND status IN (:statuses_0,:statuses_1)
          `));
          expect(bindParams).toEqual({
            projectNames_0: 'pj1',
            projectNames_1: 'pj2',
            nodeNames_0: 'node1',
            nodeNames_1: 'node2',
            statuses_0: 1,
            statuses_1: 2
          });
        });
      });

      describe('MSSQL', () => {
        it('generateParameterizedSQL.typical.mssql.001', () => {
          // [mssql] シンプルなパラメータの展開
          const builder = new SQLBuilder('mssql');
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = /*projectName*/'project1'
              AND node_name = /*nodeName*/'node1'
              AND verified = /*verified*/false
              AND status = /*status*/0
          `;
          const bindEntity = {
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity);
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              project_name = @projectName
              AND node_name = @nodeName
              AND verified = @verified
              AND status = @status
          `));
          expect(bindParams).toEqual({
            projectName: 'pj1',
            nodeName: 'node1',
            verified: true,
            status: 1
          });
        });
        it('generateParameterizedSQL.typical.mssql.002', () => {
          // [mssql] IN句の展開
          const builder = new SQLBuilder();
          const template = `
            SELECT COUNT(*) AS cnt FROM activity
            /*BEGIN*/WHERE
              1 = 1
              /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
              /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
              /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
              /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
            /*END*/
          `;
          const bindEntity = {
            projectNames: ['pj1', 'pj2'],
            nodeNames: ['node1', 'node2'],
            jobNames: [],
            statuses: [1, 2]
          };
          const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'mssql');
          expect(formatSQL(sql)).toBe(formatSQL(`
            SELECT COUNT(*) AS cnt FROM activity
            WHERE
              1 = 1
              AND project_name IN (@projectNames_0,@projectNames_1)
              AND node_name IN (@nodeNames_0,@nodeNames_1)
              AND status IN (@statuses_0,@statuses_1)
          `));
          expect(bindParams).toEqual({
            projectNames_0: 'pj1',
            projectNames_1: 'pj2',
            nodeNames_0: 'node1',
            nodeNames_1: 'node2',
            statuses_0: 1,
            statuses_1: 2
          });
        });
      });
    });

    describe('Negative Test Cases', () => {
      it('generateParameterizedSQL.negative.001', () => {
        // コンストラクター、SQL生成時のいずれにもbindTypeを指定しない場合
        const builder = new SQLBuilder();
        const template = `
          SELECT * FROM table
          WHERE
            user_id = /*userId*/0
        `;
        const bindEntity = {
          userId: 12345
        };
        expect(() => builder.generateParameterizedSQL(template, bindEntity)).toThrow('The bindType parameter is mandatory if bindType is not provided in the constructor.');
      });
    });
  });
});
