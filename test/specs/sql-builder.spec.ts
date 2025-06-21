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
