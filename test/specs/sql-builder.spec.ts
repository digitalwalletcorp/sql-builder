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
    it('generateSQL.001.001', async () => {
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
    it('generateSQL.001.002', async () => {
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
    it('generateSQL.001.003', async () => {
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
    it('generateSQL.001.004', async () => {
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
    it('generateSQL.002.001', async () => {
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
    it('generateSQL.002.002', async () => {
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
    it('generateSQL.002.003', async () => {
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
    it('generateSQL.002.004', async () => {
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
    it('generateSQL.003.001', async () => {
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
    it('generateSQL.003.002', async () => {
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
    it('generateSQL.004.001', async () => {
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
    it('generateSQL.004.002', async () => {
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
    it('generateSQL.005.001', async () => {
      const builder = new SQLBuilder();
      const template = `
        SELECT
          user_id
        FROM user
        WHERE
          data_key = 'Name'
          AND CAST(/*since*/'2025-06-17T15:00:00.000+00:00' AS timestamp with time zone) <= modified_at
          AND modified_at < CAST(/*until*/'2025-06-18T15:00:00.000+00:00' AS timestamp with time zone)
      `;
      const bindEntity = {
        since: '2024-12-31T15:00:00.000+00:00',
        until: '2025-01-01T15:00:00.000+00:00'
      };
      const sql = builder.generateSQL(template, bindEntity);
      expect(formatSQL(sql)).toBe(formatSQL(`
        SELECT
          user_id
        FROM user
        WHERE
          data_key = 'Name'
          AND CAST('2024-12-31T15:00:00.000+00:00' AS timestamp with time zone) <= modified_at
          AND modified_at < CAST('2025-01-01T15:00:00.000+00:00' AS timestamp with time zone)
      `));
    });
    it('generateSQL.006.001', async () => {
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
    it('generateSQL.006.002', async () => {
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
    it('generateSQL.006.003', async () => {
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
  });
});
