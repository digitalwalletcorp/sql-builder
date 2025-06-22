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
    it('generateSQL.001.001', () => {
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
    it('generateSQL.001.002', () => {
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
    it('generateSQL.001.003', () => {
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
    it('generateSQL.001.004', () => {
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
    it('generateSQL.002.001', () => {
      // IF条件のすべてが成立する(BEGINなし)
      const builder = new SQLBuilder();
      const template = `
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        WHERE
          1 = 1
          /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
          /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
          /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
          /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
        ORDER BY started_at DESC NULLS LAST
        LIMIT /*limit*/100
        OFFSET /*offset*/0
      `;
      const bindEntity = {
        projectNames: ['pj1', 'pj2'],
        nodeNames: ['node1', 'node2'],
        jobNames: ['job1', 'job2'],
        statuses: [1, 2],
        limit: 10,
        offset: 10
      };
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        WHERE
          1 = 1
          AND project_name IN ('pj1','pj2')
          AND node_name IN ('node1','node2')
          AND job_name IN ('job1','job2')
          AND status IN (1,2)
        ORDER BY started_at DESC NULLS LAST
        LIMIT 10
        OFFSET 10
      `));
    });
    it('generateSQL.002.002', () => {
      // IF条件のすべてが成立する(BEGINあり)
      const builder = new SQLBuilder();
      const template = `
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        /*BEGIN*/WHERE
          1 = 1
          /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
          /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
          /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
          /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
        /*END*/
        ORDER BY started_at DESC NULLS LAST
        LIMIT /*limit*/100
        OFFSET /*offset*/0
      `;
      const bindEntity = {
        projectNames: ['pj1', 'pj2'],
        nodeNames: ['node1', 'node2'],
        jobNames: ['job1', 'job2'],
        statuses: [1, 2],
        limit: 10,
        offset: 10
      };
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        WHERE
          1 = 1
          AND project_name IN ('pj1','pj2')
          AND node_name IN ('node1','node2')
          AND job_name IN ('job1','job2')
          AND status IN (1,2)
        ORDER BY started_at DESC NULLS LAST
        LIMIT 10
        OFFSET 10
      `));
    });
    it('generateSQL.002.003', () => {
      // IF条件のすべてが成立しない(BEGINなし)
      const builder = new SQLBuilder();
      const template = `
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        WHERE
          1 = 1
          /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
          /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
          /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
          /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
        ORDER BY started_at DESC NULLS LAST
        LIMIT /*limit*/100
        OFFSET /*offset*/0
      `;
      const bindEntity = {
        projectNames: [], // 長さ0の配列
        limit: 10,
        offset: 10
      };
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        WHERE
          1 = 1
        ORDER BY started_at DESC NULLS LAST
        LIMIT 10
        OFFSET 10
      `));
    });
    it('generateSQL.002.004', () => {
      // IF条件のすべてが成立する(BEGINあり)
      const builder = new SQLBuilder();
      const template = `
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        /*BEGIN*/WHERE
          1 = 1
          /*IF projectNames.length*/AND project_name IN /*projectNames*/('project1')/*END*/
          /*IF nodeNames.length*/AND node_name IN /*nodeNames*/('node1')/*END*/
          /*IF jobNames.length*/AND job_name IN /*jobNames*/('job1')/*END*/
          /*IF statuses.length*/AND status IN /*statuses*/(1)/*END*/
        /*END*/
        ORDER BY started_at DESC NULLS LAST
        LIMIT /*limit*/100
        OFFSET /*offset*/0
      `;
      const bindEntity = {
        limit: 10,
        offset: 10
      };
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT
          id,
          project_name as "projectName",
          node_name as "nodeName",
          job_name as "jobName",
          started_at as "startedAt",
          finished_at as "finishedAt",
          status,
          stdout,
          stderr
        FROM activity
        ORDER BY started_at DESC NULLS LAST
        LIMIT 10
        OFFSET 10
      `));
    });
    it('generateSQL.003.001', () => {
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
    it('generateSQL.003.002', () => {
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

    it('generateSQL.003.003', () => {
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
    it('generateSQL.004.001', () => {
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
    it('generateSQL.004.002', () => {
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
    it('generateSQL.004.003', () => {
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
    it('generateSQL.004.004', () => {
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
    it('generateSQL.004.005', () => {
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
    it('generateSQL.004.006', () => {
      // 未定義のタグ記載時 => /*variable*/とみなされる
      const builder = new SQLBuilder();
      const template = `
        SELECT * FROM activity
        WHERE
          1 = 1
          /*UNKNOWN_TAG*/
      `;
      const bindEntity = {};
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT * FROM activity
        WHERE
          1 = 1
      `));
    });
    it('generateSQL.005.001', () => {
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
    it('generateSQL.006.001', () => {
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
    it('generateSQL.006.002', () => {
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
    it('generateSQL.006.003', () => {
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
    it('generateSQL.006.004', () => {
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

    it('generateSQL.006.005', () => {
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

    it('generateSQL.006.006', () => {
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

    // IF構文で利用する演算子のパターン網羅
    it('generateSQL.010.001', () => {
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
    it('generateSQL.010.002', () => {
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
    it('generateSQL.010.003', () => {
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
    it('generateSQL.010.004', () => {
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
    it('generateSQL.010.005', () => {
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
    it('generateSQL.010.006', () => {
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
    it('generateSQL.010.007', () => {
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
    it('generateSQL.010.008', () => {
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
    it('generateSQL.010.009', () => {
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
    it('generateSQL.010.010', () => {
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
    it('generateSQL.010.011', () => {
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
    it('generateSQL.010.012', () => {
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
    it('generateSQL.010.013', () => {
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
    it('generateSQL.010.014', () => {
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
    it('generateSQL.010.015', () => {
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
    it('generateSQL.010.016', () => {
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
    it('generateSQL.010.017', () => {
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
    it('generateSQL.010.018', () => {
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
    it('generateSQL.010.019', () => {
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
    it('generateSQL.010.020', () => {
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
    it('generateSQL.010.021', () => {
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
    it('generateSQL.010.022', () => {
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
    it('generateSQL.010.023', () => {
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
    it('generateSQL.010.024', () => {
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
    it('generateSQL.010.025', () => {
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
    it('generateSQL.010.026', () => {
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
    it('generateSQL.010.027', () => {
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
    it('generateSQL.010.028', () => {
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
    it('generateSQL.010.029', () => {
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
    it('generateSQL.010.030', () => {
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
    it('generateSQL.010.031', () => {
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
    it('generateSQL.010.032', () => {
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
    it('generateSQL.010.033', () => {
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
    it('generateSQL.010.034', () => {
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
    it('generateSQL.010.035', () => {
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
    it('generateSQL.010.036', () => {
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
    it('generateSQL.010.037', () => {
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
    it('generateSQL.010.038', () => {
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
    it('generateSQL.010.039', () => {
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
    it('generateSQL.010.040', () => {
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
    it('generateSQL.010.041', () => {
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

    it('generateParameterizedSQL.001.001', () => {
      // [postgresql] シンプルなパラメータの展開
      const builder = new SQLBuilder();
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
      const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'postgres');
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
    it('generateParameterizedSQL.001.002', () => {
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
    it('generateParameterizedSQL.002.001', () => {
      // [mysql] シンプルなパラメータの展開
      const builder = new SQLBuilder();
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
      const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'mysql');
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
    it('generateParameterizedSQL.002.002', () => {
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
    it('generateParameterizedSQL.003.001', () => {
      // [oracle] シンプルなパラメータの展開
      const builder = new SQLBuilder();
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
      const [sql, bindParams] = builder.generateParameterizedSQL(template, bindEntity, 'oracle');
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
    it('generateParameterizedSQL.003.002', () => {
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
});
