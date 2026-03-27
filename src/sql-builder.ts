import * as common from './common';
import { AbstractSyntaxTree } from './abstract-syntax-tree';

type TagType = 'BEGIN' | 'IF' | 'ELSEIF' | 'ELSE' | 'FOR' | 'BIND' | 'TEXT' | 'END';
type ExtractValueType<T extends 'string' | 'array' | 'object'>
  = T extends 'string'
    ? string | undefined
    : T extends 'array'
      ? any[] | undefined
      : Record<string, any> | undefined;

/**
 * PostgreSQL: $1, $2... 配列
 * MySQL: ? 配列
 * SQLite: ?, $name, :name 配列またはオブジェクト
 * Oracle: :name オブジェクト
 * SQL Server: `@name` 配列またはオブジェクト
 *
 * 以下をサポートする
 * ・$1, $2 (postgres)
 * ・? (mysql) SQLite, SQL Serverもこれで代替可能
 * ・:name (oracle) SQLiteもこれで代替可能
 * ・`@name` (mssql)
 */
const dbTypes = [
  'postgres',
  'mysql',
  'oracle',
  'mssql'
] as const;

type BindType = typeof dbTypes[number];

type BindParameterType<T extends BindType>
  = T extends 'postgres' ? any[]
  : T extends 'mysql' ? any[]
  : T extends 'oracle' ? Record<string, any>
  : T extends 'mssql' ? Record<string, any>
  : undefined;

// すべてのタグの基底
interface BaseTagContext {
  startIndex: number;
  endIndex: number;
  parent: ParentTagContext | null;
  match: string;
}

// 子要素を持つ「親」になれるタグの共通定義
interface ParentTagContext extends BaseTagContext {
  type: 'BEGIN' | 'IF' | 'ELSEIF' | 'ELSE' | 'FOR';
  contents: string;
  sub: TagContext[];
  conditionMatched: boolean; // この要素自体の条件が成立したか
  childConditionMatched: boolean; // 子要素のいずれかの条件が成立したか(BEGIN/IF用)
}

interface ContainerTagContext extends ParentTagContext {
  type: 'BEGIN' | 'FOR';
}

interface BranchTagContext extends ParentTagContext {
  type: 'IF' | 'ELSEIF' | 'ELSE';
}

interface BindTagContext extends BaseTagContext {
  type: 'BIND';
  contents: string;
  isPgArray?: boolean;
  pgArrayCast?: string;
}

interface TextTagContext extends BaseTagContext {
  type: 'TEXT';
  contents: string;
}

interface EndTagContext extends BaseTagContext {
  type: 'END';
}

type TagContext
  = ContainerTagContext
  | BranchTagContext
  | TextTagContext
  | BindTagContext
  | EndTagContext;

interface SharedIndex {
  index: number;
}

/**
 * 動的SQLを生成する
 *
 * このクラスは、S2Daoが提供していた機能を模したもので、SQLテンプレートとバインドエンティティを渡すことで動的にSQLを生成する。
 *
 * 例)
 * テンプレート
 * ```
 * SELECT COUNT(*) AS cnt FROM activity
 * \/*BEGIN*\/WHERE
 * 1 = 1
 * \/*IF projectNames.length*\/AND project_name IN \/*projectNames*\/('project1')\/*END*\/
 * \/*IF nodeNames.length*\/AND node_name IN \/*nodeNames*\/('node1')\/*END*\/
 * \/*IF jobNames.length*\/AND job_name IN \/*jobNames*\/('job1')\/*END*\/
 * \/*IF statuses.length*\/AND status IN \/*statuses*\/(1)\/*END*\/
 * \/*END*\/
 * ```
 *
 * 呼び出し
 * ```
 * const bindEntity = {
 *   projectNames: ['pj1', 'pj2'],
 *   nodeNames: ['node1', 'node2'],
 *   jobNames: ['job1', 'job2'],
 *   statuses: [1, 2]
 * };
 * const sql = builder.generateSQL(template, bindEntity);
 * ```
 *
 * 結果
 * ```
 * SELECT COUNT(*) AS cnt FROM activity
 * WHERE
 *   1 = 1
 *   AND project_name IN ('pj1','pj2')
 *   AND node_name IN ('node1','node2')
 *   AND job_name IN ('job1','job2')
 *   AND status IN (1,2)
 * ```
 */
export class SQLBuilder {

  // `/*xxx*/`の部分を抽出するパターン
  private REGEX_TAG_PATTERN = /\/\*(.*?)\*\//g;

  // `ANY (/*bindParam*/ARRAY['John']::text[])`の`ARRAY[...]::...[]`部分を抽出するパターン
  // `array [100, 200] :: numeric(10, 2) []` のようなパターンも存在する
  private PGSQL_ARRAY_CAST_PATTERN = /^ARRAY\s*\[.*?\]\s*::\s*([a-zA-Z_]\w*(?:\([^\)]*\))?)\s*\[\]/i;

  private bindType?: BindType;

  constructor(bindType?: BindType) {
    this.bindType = bindType;
  }

  /**
   * 指定したテンプレートにエンティティの値をバインドしたSQLを生成する
   *
   * @param {string} template
   * @param {Record<string, any>} entity
   * @returns {string}
   */
  public generateSQL(template: string, entity: Record<string, any>): string {
    /**
     * 「\/* *\/」で囲まれたすべての箇所を抽出
     */
    const allMatchers = template.match(this.REGEX_TAG_PATTERN);
    if (!allMatchers) {
      return template;
    }

    const tagContexts = this.createTagContexts(template);
    const pos: SharedIndex = { index: 0 };
    const result = this.parse(pos, template, entity, tagContexts);
    return result;
  }

  /**
   * 指定したテンプレートにエンティティの値をバインド可能なプレースホルダー付きSQLを生成し、
   * バインドパラメータと共にタプル型で返却する
   *
   * @param {string} template
   * @param {Record<string, any>} entity
   * @param {BindType} [bindType]
   * @returns {[string, BindParameterType<T>]}
   */
  public generateParameterizedSQL<T extends BindType>(template: string, entity: Record<string, any>, bindType?: T): [string, BindParameterType<T>] {

    const bt = bindType || this.bindType;

    if (!bt) {
      throw new Error('[SQLBuilder] The bindType parameter is mandatory if bindType is not provided in the constructor.');
    }

    let bindParams: BindParameterType<T>;
    switch (bt) {
      case 'postgres':
      case 'mysql':
        bindParams = [] as unknown as BindParameterType<T>;
        break;
      case 'oracle':
      case 'mssql':
        bindParams = {} as BindParameterType<T>;
        break;
      default:
        throw new Error(`[SQLBuilder] Unsupported bind type: ${bt}`);
    }

    /**
     * 「\/* *\/」で囲まれたすべての箇所を抽出
     */
    const allMatchers = template.match(this.REGEX_TAG_PATTERN);
    if (!allMatchers) {
      return [template, bindParams];
    }

    const tagContexts = this.createTagContexts(template);
    const pos: SharedIndex = { index: 0 };
    const result = this.parse(pos, template, entity, tagContexts, {
      bindType: bt,
      bindIndex: 1,
      bindParams: bindParams
    });
    return [result, bindParams];
  }

  /**
   * テンプレートに含まれるタグ構成を解析してコンテキストを返す
   *
   * @param {string} template
   * @returns {TagContext[]}
   */
  private createTagContexts(template: string): TagContext[] {
    // マッチした箇所の開始インデックス、終了インデックス、および階層構造を保持するオブジェクトを構築する
    /**
     * 「\/* *\/」で囲まれたすべての箇所を抽出
     */
    const matches = template.matchAll(this.REGEX_TAG_PATTERN);

    // まず最初にREGEX_TAG_PATTERNで解析した情報をそのままフラットにTagContextの配列に格納
    let lastIndex = 0;
    const tagContexts: TagContext[] = [];
    for (const match of matches) {
      const matchContent = match[0];
      const index = match.index;

      if (lastIndex < index) {
        tagContexts.push({
          type: 'TEXT',
          match: '',
          contents: template.substring(lastIndex, index),
          startIndex: lastIndex,
          endIndex: index,
          parent: null
        });
      }

      let tagContext: TagContext = {
        type: 'BIND', // ダミーの初期値。後続処理で適切なタイプに変更する。
        contents: '',
        startIndex: index,
        endIndex: index + matchContent.length,
        parent: null,
        match: matchContent
      };
      switch (true) {
        case matchContent === '/*BEGIN*/': {
          tagContext = {
            ...tagContext,
            type: 'BEGIN',
            sub: [],
            conditionMatched: false,
            childConditionMatched: false
          } as ContainerTagContext;
          break;
        }
        case matchContent.startsWith('/*IF'): {
          tagContext = {
            ...tagContext,
            type: 'IF',
            sub: [],
            conditionMatched: false,
            childConditionMatched: false
          } as BranchTagContext;
          const contentMatcher = matchContent.match(/^\/\*IF\s+(.*?)\*\/$/);
          tagContext.contents = contentMatcher && contentMatcher[1] || '';
          break;
        }
        case matchContent.startsWith('/*ELSEIF'): {
          tagContext = {
            ...tagContext,
            type: 'ELSEIF',
            sub: [],
            conditionMatched: false,
            childConditionMatched: false
          } as BranchTagContext;
          const contentMatcher = matchContent.match(/^\/\*ELSEIF\s+(.*?)\*\/$/);
          tagContext.contents = contentMatcher && contentMatcher[1] || '';
          break;
        }
        case matchContent.startsWith('/*ELSE*/'): {
          tagContext = {
            ...tagContext,
            type: 'ELSE',
            sub: [],
            conditionMatched: false,
            childConditionMatched: false
          } as BranchTagContext;
          break;
        }
        case matchContent.startsWith('/*FOR'): {
          tagContext = {
            ...tagContext,
            type: 'FOR',
            sub: [],
            conditionMatched: false,
            childConditionMatched: false
          } as ContainerTagContext;
          const contentMatcher = matchContent.match(/^\/\*FOR\s+(.*?)\*\/$/);
          tagContext.contents = contentMatcher && contentMatcher[1] || '';
          break;
        }
        case matchContent === '/*END*/': {
          tagContext = {
            ...tagContext,
            type: 'END'
          } as EndTagContext;
          break;
        }
        default: {
          tagContext = {
            ...tagContext,
            type: 'BIND'
          } as BindTagContext;
          const contentMatcher = matchContent.match(/\/\*(.*?)\*\//);
          tagContext.contents = contentMatcher && contentMatcher[1]?.trim() || '';
          // ダミー値の終了位置をendIndexに設定
          const dummyEndIndex = this.getDummyParamEndIndex(template, tagContext);
          tagContext.endIndex = dummyEndIndex;

          // PostgreSQL ANY/CAST構文判定
          // 例) AND name = ANY (/*names*/ARRAY['Bob']::text[]) => AND name = ANY ($1::text[])
          if (/ARRAY\s*\[/i.test(template.substring(tagContext.startIndex, dummyEndIndex))) {
            tagContext.isPgArray = true;
            // CAST部分の抽出
            const dummySql = template.substring(tagContext.startIndex, dummyEndIndex);
            const castMatch = dummySql.match(/(::\s*\w+\s*\[\s*\])/);
            if (castMatch) {
              tagContext.pgArrayCast = castMatch[1];
            }
          }
        }
      }

      tagContexts.push(tagContext);

      lastIndex = tagContext.endIndex;
    }

    // ループを抜けた後に残った部分をTEXTタグとして追加
    if (lastIndex < template.length) {
      tagContexts.push({
        type: 'TEXT',
        match: '',
        contents: template.substring(lastIndex),
        startIndex: lastIndex,
        endIndex: template.length,
        parent: null
      });
    }

    // できあがったTagContextの配列から、
    // BEGENの場合は対応するENDが出てくるまで、
    // IFの場合は次の対応するENDが出てくるまでをsubに入れ直して構造化し、
    // 以下のような構造に変更する
    /**
     * ```
     * BEGIN
     *   ├ IF
     *     ├ BIND(無いこともある)
     *     ├ ELSEIF
     *       ├ BIND(無いこともある)
     *     ├ ELSE
     *       ├ BIND(無いこともある)
     *     ├ END
     *   ├ BIND
     * END
     * ```
     */
    const parentTagContexts: ParentTagContext[] = [];
    const newTagContexts: TagContext[] = [];
    for (const tagContext of tagContexts) {
      switch (tagContext.type) {
        case 'TEXT':
        case 'BIND': {
          const parentTagContext = parentTagContexts[parentTagContexts.length - 1];
          if (parentTagContext) {
            // 親タグがある
            tagContext.parent = parentTagContext;
            parentTagContext.sub.push(tagContext);
          } else {
            // 親タグがない(最上位)
            newTagContexts.push(tagContext);
          }
          break;
        }
        case 'BEGIN':
        case 'IF':
        case 'FOR': {
          const parentTagContext = parentTagContexts[parentTagContexts.length - 1];
          if (parentTagContext) {
            // 親タグがある
            tagContext.parent = parentTagContext;
            parentTagContext.sub.push(tagContext);
          } else {
            // 親タグがない(最上位)
            newTagContexts.push(tagContext);
          }
          // 後続処理で自身が親になるので自身を追加
          parentTagContexts.push(tagContext);
          break;
        }
        case 'ELSEIF':
        case 'ELSE': {
          const ifTagContext = this.findParentTagContext(parentTagContexts[parentTagContexts.length - 1], 'IF');
          if (ifTagContext) {
            // 親タグ(IF)がある
            tagContext.parent = ifTagContext;
            ifTagContext.sub.push(tagContext);
          } else {
            throw new Error(`[SQLBuilder] ${tagContext.type} must be inside IF.`);
          }
          // 後続処理で自身が親になるので自身を追加
          parentTagContexts.push(tagContext); // これは暫定的なものなのでENDで削除する必要がある
          break;
        }
        case 'END': {
          let parentTagContext = parentTagContexts[parentTagContexts.length - 1];
          if (!parentTagContext) {
            throw new Error(`[SQLBuilder] 'END' tag without corresponding parent.`);
          }

          if (parentTagContext.type === 'ELSEIF' || parentTagContext.type === 'ELSE') {
            // 暫定追加されたELSEIF/ELSEを除去
            while(parentTagContexts.length && ['ELSEIF', 'ELSE'].includes(parentTagContexts[parentTagContexts.length - 1].type)) {
              parentTagContexts.pop();
            }
            parentTagContext = parentTagContexts[parentTagContexts.length - 1];
          }
          tagContext.parent = parentTagContext;
          parentTagContext.sub.push(tagContext);

          parentTagContexts.pop();
          break;
        }
        default: {
          // 型定義にない型という扱いになるのでanyキャストする(到達不可能？)
          throw new Error(`[SQLBuilder] Unknown TagType '${(tagContext as any).type}`);
        }
      }
    }

    return newTagContexts;
  }

  /**
   * テンプレートを分析して生成したSQLを返す
   *
   * @param {SharedIndex} pos 現在処理している文字列の先頭インデックス
   * @param {string} template
   * @param {Record<string, any>} entity
   * @param {(TagContext | ParentTagContext)[]} tagContexts
   * @param {*} [options]
   *   ├ bindType BindType
   *   ├ bindIndex number
   *   ├ bindParams BindParameterType<T>
   * @returns {string}
   */
  private parse<T extends BindType>(pos: SharedIndex, template: string, entity: Record<string, any>, tagContexts: (TagContext | ParentTagContext)[], options?: {
    bindType: T,
    bindIndex: number,
    bindParams: BindParameterType<T>
  }): string {
    let result = '';
    for (const tagContext of tagContexts) {
      switch (tagContext.type) {
        case 'TEXT': {
          // テキストは無条件に書き出し
          // 改行だけなど、trimすると空になる文字列もあるが、
          // どの部分がスキップされたのかわかるようにあえて残すことにする
          result += tagContext.contents;
          pos.index = tagContext.endIndex;
          break;
        }
        case 'BEGIN': {
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          // BEGINのときは無条件にsubに対して再帰呼び出し
          const beginBlockResult = this.parse(pos, template, entity, tagContext.sub, options);
          // BEGIN内のIF、FORのいずれかで成立したものがあった場合は結果を出力
          if (tagContext.sub.some(sub =>
            (sub.type === 'IF' || sub.type === 'FOR') && sub.conditionMatched
          )) {
            result += beginBlockResult;
          }
          break;
        }
        case 'IF': {
          const conditionMatched = this.evaluateCondition(tagContext.contents, entity);
          if (conditionMatched) {
            tagContext.conditionMatched = true; // 自身の評価結果
            pos.index = tagContext.endIndex;
            // 条件が成立したので、自身のsubにある条件タグを排除する
            const children = tagContext.sub.filter(a => a.type !== 'ELSEIF' && a.type !== 'ELSE');
            result += this.parse(pos, template, entity, children, options);

            // IFタグからENDを探すときは、自身のsubの最後の要素
            const endTagContext = tagContext.sub[tagContext.sub.length - 1];
            pos.index = endTagContext.endIndex;
          } else {
            // 条件不成立
            const nextBranch = tagContext.sub.find(a => a.type === 'ELSEIF' || a.type === 'ELSE');
            if (nextBranch) {
              pos.index = nextBranch.startIndex;
              result += this.parse(pos, template, entity, [nextBranch], options);
            } else {
              // 次の条件がない場合はENDの後ろまでポインタを飛ばす
              const endTagContext = tagContext.sub[tagContext.sub.length - 1];
              pos.index = endTagContext.endIndex;
            }
          }
          break;
        }
        case 'ELSEIF':
        case 'ELSE': {
          const conditionMatched = tagContext.type === 'ELSE' || this.evaluateCondition(tagContext.contents, entity);
          if (conditionMatched) {
            tagContext.conditionMatched = true; // 自身の評価結果
            pos.index = tagContext.endIndex;
            // 条件が成立したので、自身のsubにある条件タグを排除する
            const children = tagContext.sub.filter(a => a.type !== 'ELSEIF' && a.type !== 'ELSE');
            result += this.parse(pos, template, entity, children, options);

            // ELSEIF/ELSEからIFを探すときは自身の親そのもの
            const ifTagContext = tagContext.parent!;
            ifTagContext.childConditionMatched = true; // 親が持っている評価結果にtrueを設定

            // ELSEIF/ELSEからENDを探すときは、自身の兄弟の最後の要素
            const endTagContext = this.seekSiblingTagContext(tagContext, 'END', 'next')!;
            pos.index = endTagContext.endIndex;
          } else {
            // 条件不成立
            const nextBranch = this.seekSiblingTagContext(tagContext, ['ELSEIF', 'ELSE'], 'next');
            if (nextBranch) {
              pos.index = nextBranch.startIndex;
              result += this.parse(pos, template, entity, [nextBranch], options);
            } else {
              // 次の条件がない場合はENDの後ろまでポインタを飛ばす
              const endTagContext = tagContext.sub[tagContext.sub.length - 1];
              pos.index = endTagContext.endIndex;
            }
          }
          break;
        }
        case 'FOR': {
          const [bindName, collectionName] = tagContext.contents.split(':').map(a => a.trim());
          const array = common.getProperty(entity, collectionName);
          if (Array.isArray(array) && array.length) {
            tagContext.conditionMatched = true;
            let index = 0;
            for (const value of array) {
              const children = tagContext.sub.filter(a => a.type !== 'END');
              result += this.parse(
                pos,
                template,
                {
                  ...entity,
                  [bindName]: value,
                  index: index,
                  count: index + 1
                },
                children,
                options
              );
              result += '\n';
              index++;
            }

            // FORのENDまでポインタを進める
            const endTag = tagContext.sub[tagContext.sub.length - 1];
            pos.index = endTag.endIndex;
          } else {
            // FORブロックを丸ごとスキップ
            const endTagContext = tagContext.sub[tagContext.sub.length - 1];
            pos.index = endTagContext.endIndex;
          }
          break;
        }
        case 'END': {
          const parent = tagContext.parent;
          if (parent) {
            switch (true) {
              // BEGIN/IF/FORに対応するENDは、それぞれの処理で考慮すると複雑化するので
              // すべてENDタグでどういう状態になったのは判定して動きを制御する
              case parent.type === 'BEGIN'
                  && parent.sub.some(a => a.type === 'IF' || a.type === 'FOR')
                  && !parent.sub.some(a => a.type === 'IF' || a.type === 'FOR' && a.conditionMatched):
                // BEGINに対応するENDの場合
                // ・子要素にIFまたはFORが存在する
                // ・子要素のIFまたはFORにstatus=10(成功)を示すものが1つもない
              case parent.type === 'IF' && !parent.conditionMatched:
                // IFに対応するENDの場合、IFのstatusがstatus=10(成功)になっていない
              case parent.type === 'IF' && parent.sub.some(a => a.type === 'ELSEIF' || a.type === 'ELSE'):
              case parent.type === 'FOR' && !parent.conditionMatched:
                // FORに対応するENDの場合、FORのstatusがstatus=10(成功)になっていない
                pos.index = tagContext.endIndex;
                return result;
              default:
            }
          }
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          return result;
        }
        case 'BIND': {
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          const propertyResult = common.getPropertyResult(entity, tagContext.contents);
          // ★ UNKNOWN_TAG 判定
          if (!propertyResult.exists) {
            // UNKNOWN_TAG → エラーを発行
            throw new Error(`[SQLBuilder] The property '${tagContext.contents}' is not found in the bind entity. (Template index: ${tagContext.startIndex})`);
          }
          const value = propertyResult.value === undefined ? null : propertyResult.value;
          switch (options?.bindType) {
            case 'postgres': {
              // PostgreSQL形式の場合、$Nでバインドパラメータを展開
              if (tagContext.isPgArray) {
                if (!tagContext.pgArrayCast) {
                  throw new Error(
                    `[SQLBuilder] PostgreSQL ARRAY bind requires explicit cast (e.g. ARRAY[...]::text[]). ` +
                    `Property: ${tagContext.contents}, index: ${tagContext.startIndex}`
                  );
                }
                (options.bindParams as any[]).push(value);
                const cast = tagContext.pgArrayCast ?? ''; // ::text[] などのCAST部分がついている場合は書き戻す
                result += `$${options.bindIndex++}${cast}`;
              } else if (Array.isArray(value)) {
                // IN句の場合
                const placeholders: string[] = [];
                for (const item of value) {
                  placeholders.push(`$${options.bindIndex++}`);
                  (options.bindParams as any[]).push(item);
                }
                result += placeholders.join(','); // IN ($1,$2,$3)
              } else {
                (options.bindParams as any[]).push(value);
                result += `$${options.bindIndex++}`;
              }
              break;
            }
            case 'mysql': {
              // MySQL形式の場合、?でバインドパラメータを展開
              if (Array.isArray(value)) {
                const placeholders: string[] = [];
                for (const item of value) {
                  placeholders.push('?');
                  (options.bindParams as any[]).push(item);
                }
                result += placeholders.join(','); // IN (?,?,?)
              } else {
                (options.bindParams as any[]).push(value);
                result += '?';
              }
              break;
            }
            case 'oracle': {
              // Oracle形式の場合、名前付きバインドでバインドパラメータを展開
              if (Array.isArray(value)) {
                const placeholders: string[] = [];
                for (let i = 0; i < value.length; i++) {
                  // 名前付きバインドで配列の場合は名前が重複する可能性があるので枝番を付与
                  const paramName = `${tagContext.contents}_${i}`; // :projectNames_0, :projectNames_1
                  placeholders.push(`:${paramName}`);
                  (options.bindParams as Record<string, any>)[paramName] = value[i];
                }
                result += placeholders.join(','); // IN (:p_0,:p_1,:p3)
              } else {
                (options.bindParams as Record<string, any>)[tagContext.contents] = value;
                result += `:${tagContext.contents}`;
              }
              break;
            }
            case 'mssql': {
              // SQL Server形式の場合、名前付きバインドでバインドパラメータを展開
              if (Array.isArray(value)) {
                const placeholders: string[] = [];
                for (let i = 0; i < value.length; i++) {
                  // 名前付きバインドで配列の場合は名前が重複する可能性があるので枝番を付与
                  const paramName = `${tagContext.contents}_${i}`; // @projectNames_0, @projectNames_1
                  placeholders.push(`@${paramName}`);
                  (options.bindParams as Record<string, any>)[paramName] = value[i];
                }
                result += placeholders.join(','); // IN (:p_0,:p_1,:p3)
              } else {
                (options.bindParams as Record<string, any>)[tagContext.contents] = value;
                result += `@${tagContext.contents}`;
              }
              break;
            }
            default: {
              // generateSQLの場合
              if (tagContext.isPgArray) {
                // PostgreSQLのANY/CAST構文が検出された場合
                throw new Error(`[SQLBuilder] PostgreSQL array bind (::type[]) is not supported in generateSQL. Use generateParameterizedSQL instead. (Property: ${tagContext.contents}, index: ${tagContext.startIndex})`);
              }
              const escapedValue = this.extractValue(tagContext.contents, entity);
              result += escapedValue ?? '';
            }
          }
          break;
        }
        default:
      }
    }

    if (tagContexts.length && tagContexts[0].parent) {
      // IFタグ解析中のELSEIF/ELSEなどが残っている場合は以降の文字列を連結せず、IFの解析結果のみ返す
      return result;
    }

    // 最後に余った部分を追加する
    result += template.substring(pos.index);
    return result;
  }

  /**
   * 指定したタグから親を遡り、指定したタグタイプのタグコンテキストを返す
   * 見つからない場合はundefinedを返す
   *
   * @param {TagContext | ParentTagContext | null} tagContext
   * @param {T} tagType
   * @returns {(TagContext & { type: T }) | undefined}
   */
  private findParentTagContext<T extends TagType>(tagContext: TagContext | ParentTagContext | null, tagType: T): (TagContext & { type: T }) | undefined {
    let targetTagContext = tagContext;
    while (targetTagContext != null) {
      if (targetTagContext.type === tagType) {
        return targetTagContext as Extract<TagContext, { type: T }>;
      }
      targetTagContext = targetTagContext.parent;
    }
    return undefined;
  }

  /**
   * 指定したタグの兄弟をたどり、指定したタグタイプのタグコンテキストを返す
   * 見つからない場合はundefinedを返す
   * ユースケースとしては、ELSEIF/ELSEから同じIFに属するENDを探す
   *
   * @param {TagContext} tagContext
   * @param {TagType | TagType[]} tagType
   * @param {'previous' | 'next'} direction
   * @returns {TagContext | undefined}
   */
  private seekSiblingTagContext(tagContext: TagContext, tagType: TagType | TagType[], direction: 'previous' | 'next' = 'next'): TagContext | undefined {
    const parent = tagContext.parent;
    if (parent) {
      // 自身が所属するインデックスを取得
      const startIndex = parent.sub.indexOf(tagContext);
      if (startIndex < 0) {
        return undefined;
      }
      const tagTypes = Array.isArray(tagType) ? tagType : [tagType];
      switch (direction) {
        case 'previous':
          for (let i = startIndex - 1; 0 <= i; i--) {
            if (tagTypes.some(a => a === parent.sub[i].type)) {
              return parent.sub[i];
            }
          }
          break;
        case 'next':
          for (let i = startIndex + 1; i < parent.sub.length; i++) {
            if (tagTypes.some(a => a === parent.sub[i].type)) {
              return parent.sub[i];
            }
          }
          break;
        default:
      }
    }
    return undefined;
  }

  /**
   * ダミーパラメータの終了インデックスを返す
   *
   * @param {string} template
   * @param {TagContext} tagContext
   * @returns {number}
   */
  private getDummyParamEndIndex(template: string, tagContext: TagContext): number {
    if (tagContext.type !== 'BIND') {
      throw new Error(`[SQLBuilder] ${tagContext.type} に対してgetDummyParamEndIndexが呼び出されました`);
    }
    let quoted = false;
    let bracket = false;
    const chars: string[] = Array.from(template);
    for (let i = tagContext.endIndex; i < template.length; i++) {
      const c = chars[i];
      if (bracket) {
        // 丸括弧解析中
        switch (true) {
          case c === ')':
            // 丸括弧終了
            return i + 1;
          case c === '\n':
            throw new Error(`[SQLBuilder] 括弧が閉じられていません [index: ${i}, subsequence: '${template.substring(Math.max(i - 20, 0), i + 20)}']`);
          default:
        }
      } else if (quoted) {
        // クォート解析中
        switch (true) {
          case c === '\'':
            // クォート終了
            return i + 1;
          case c === '\n':
            throw new Error(`[SQLBuilder] クォートが閉じられていません [index: ${i}, subsequence: '${template.substring(Math.max(i - 20, 0), i + 20)}']`);
          default:
        }
      } else {
        switch (true) {
          case c === '\'':
            // クォート開始
            quoted = true;
            break;
          case c === '(':
            // 丸括弧開始
            // bracket = true;
            // break;
            return i;
          case c === ')':
            // throw new Error(`[SQLBuilder] 括弧が開始されていません [index: ${i}, subsequence: '${template.substring(Math.max(i - 20, 0), i + 20)}']`);
            return i;
          case c === '*' && 1 < i && chars[i - 1] === '/':
            // 次ノード開始
            return i - 1;
          case c === '-' && 1 < i && chars[i - 1] === '-':
            // 行コメント
            return i - 1;
          case c === '\n':
            if (1 < i && chars[i - 1] === '\r') {
              // \r\n
              return i - 1;
            }
            // \n
            return i;
          case c === ' ' || c === '\t':
            // 空白文字
            return i;
          case c === ',':
            return i;
          case c === 'A' || c === 'a':
            // PostgreSQLの`ANY (/*bindParam*/ARRAY['John']::text[])`を解析するパターン
            const target = template.substring(i);
            const match = target.match(this.PGSQL_ARRAY_CAST_PATTERN);
            if (match) {
              return i + match[0].length;
            }
          default:
        }
      }
    }
    return template.length;
  }

  /**
   * IF条件が成立するか判定する
   *
   * @param {string} condition `params.length`や`param === 'a'`などの条件式
   * @param {Record<string, any>} entity
   * @returns {boolean}
   */
  private evaluateCondition(condition: string, entity: Record<string, any>): boolean {
    const ast = new AbstractSyntaxTree();
    const result = ast.evaluateCondition(condition, entity);
    return result;
  }

  /**
   * entityからparamで指定した値を文字列で取得する
   * entityの値がstringの場合、SQLインジェクションの危険のある文字はエスケープする
   *
   * * 返却する値が配列の場合は丸括弧で括り、各項目をカンマで区切る
   *   ('a', 'b', 'c')
   *   (1, 2, 3)
   * * 返却する値がstring型の場合はシングルクォートで括る
   *   'abc'
   * * 返却する値がnumber型の場合はそのまま返す
   *   1234
   * * 返却する値がboolean型の場合はそのまま返す
   *   true
   *   false
   * * null/undefinedの場合は'NULL'を返す
   *
   * NULLの扱いを含むため、この関数はgenerateSQLのみで利用する
   *
   * @param {string} property `obj.param1.param2`などのドットで繋いだプロパティ
   * @param {Record<string, any>} entity
   * @param {*} [options]
   *   ├ responseType 'string' | 'array' | 'object'
   * @returns {string}
   */
  private extractValue<T extends 'string' | 'array' | 'object' = 'string'>(property: string, entity: Record<string, any>, options?: {
    responseType?: T
  }): ExtractValueType<T> {
    const propertyResult = common.getPropertyResult(entity, property);
    if (!propertyResult.exists) {
      throw new Error(`[SQLBuilder] The property '${property}' is not found in the entity: ${JSON.stringify(entity)}`);
    }
    const value = propertyResult.value;
    if (value == null) {
      return 'NULL' as ExtractValueType<T>;
    }
    let result = '';
    switch (options?.responseType) {
      case 'array':
      case 'object':
        return value as ExtractValueType<T>;
      default:
        // string
        if (Array.isArray(value)) {
          result = value.map(v => typeof v === 'string' ? `'${this.escape(v)}'` : v).join(',');
        } else {
          result = typeof value === 'string' ? `'${this.escape(value)}'` : value;
        }
        return result as ExtractValueType<T>;
    }
  }

  /**
   * SQLインジェクション対策
   * * シングルクォートのエスケープ
   * * バックスラッシュのエスケープ
   *
   * @param {string} str
   * @returns {string}
   */
  private escape(str: string): string {
    let escapedString = str;
    escapedString = escapedString.replace(/'/g, '\'\'');
    escapedString = escapedString.replace(/\\/g, '\\\\');
    return escapedString;
  }
}
