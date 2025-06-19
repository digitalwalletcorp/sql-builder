type TagType = 'BEGIN' | 'IF' | 'FOR' | 'END' | 'BIND';
type ExtractValueType<T extends 'string' | 'array' | 'object'>
  = T extends 'string'
    ? string | undefined
    : T extends 'array'
      ? any[] | undefined
      : Record<string, any> | undefined;

interface TagContext {
  type: TagType;
  match: string;
  contents: string;
  startIndex: number;
  endIndex: number;
  sub: TagContext[];
  parent: TagContext | null;
  status: number; // 0: 初期、10: 成立 IFで条件が成立したかを判断するもの
}

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

  private REGEX_TAG_PATTERN = /\/\*(.*?)\*\//g;

  constructor() {
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
    const rootMatcher = template.match(this.REGEX_TAG_PATTERN);

    // まず最初にREGEX_TAG_PATTERNで解析した情報をそのままフラットにTagContextの配列に格納
    let pos = 0;
    const tagContexts: TagContext[] = [];
    if (rootMatcher) {
      for (const matchContent of rootMatcher) {
        const index = template.indexOf(matchContent, pos);
        pos = index + 1;
        const tagContext: TagContext = {
          type: null as unknown as TagType,
          match: matchContent,
          contents: '',
          startIndex: index,
          endIndex: index + matchContent.length,
          sub: [],
          parent: null,
          status: 0
        };
        switch (true) {
          case matchContent === '/*BEGIN*/': {
            tagContext.type = 'BEGIN';
            break;
          }
          case matchContent.startsWith('/*IF'): {
            tagContext.type = 'IF';
            const contentMatcher = matchContent.match(/^\/\*IF\s+(.*?)\*\/$/);
            tagContext.contents = contentMatcher && contentMatcher[1] || '';
            break;
          }
          case matchContent.startsWith('/*FOR'): {
            tagContext.type = 'FOR';
            const contentMatcher = matchContent.match(/^\/\*FOR\s+(.*?)\*\/$/);
            tagContext.contents = contentMatcher && contentMatcher[1] || '';
            break;
          }
          case matchContent === '/*END*/': {
            tagContext.type = 'END';
            break;
          }
          default: {
            tagContext.type = 'BIND';
            const contentMatcher = matchContent.match(/\/\*(.*?)\*\//);
            tagContext.contents = contentMatcher && contentMatcher[1] || '';
            // ダミー値の終了位置をendIndexに設定
            const dummyEndIndex = this.getDummyParamEndIndex(template, tagContext);
            tagContext.endIndex = dummyEndIndex;
          }
        }
        tagContexts.push(tagContext);
      }
    }

    // できあがったTagContextの配列から、BEGEN、IFの場合は次の対応するENDが出てくるまでをsubに入れ直して構造化し、
    // 以下のような構造の変更する
    /**
     * ```
     * BEGIN
     *   ├ IF
     *     ├ BIND
     *     ├ BIND
     *     ├ END
     *   ├ BIND
     * END
     * ```
     */
    const parentTagContexts: TagContext[] = [];
    const newTagContexts: TagContext[] = [];
    for (const tagContext of tagContexts) {
      switch (tagContext.type) {
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
        case 'END': {
          const parentTagContext = parentTagContexts.pop()!;
          // ENDのときは必ず対応するIF/BEGINがあるので、親のsubに追加
          tagContext.parent = parentTagContext;
          parentTagContext.sub.push(tagContext);
          break;
        }
        default: {
          const parentTagContext = parentTagContexts[parentTagContexts.length - 1];
          if (parentTagContext) {
            // 親タグがある
            tagContext.parent = parentTagContext;
            parentTagContext.sub.push(tagContext);
          } else {
            // 親タグがない(最上位)
            newTagContexts.push(tagContext);
          }
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
   * @param {TagContext[]} tagContexts
   * @returns {string}
   */
  private parse(pos: SharedIndex, template: string, entity: Record<string, any>, tagContexts: TagContext[]): string {
    let result = '';
    for (const tagContext of tagContexts) {
      switch (tagContext.type) {
        case 'BEGIN': {
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          // BEGINのときは無条件にsubに対して再帰呼び出し
          result += this.parse(pos, template, entity, tagContext.sub);
          break;
        }
        case 'IF': {
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          if (this.evaluateCondition(tagContext.contents, entity)) {
            // IF条件が成立する場合はsubに対して再帰呼び出し
            tagContext.status = 10;
            result += this.parse(pos, template, entity, tagContext.sub);
          } else {
            // IF条件が成立しない場合は再帰呼び出しせず、subのENDタグのendIndexをposに設定
            const endTagContext = tagContext.sub[tagContext.sub.length - 1];
            pos.index = endTagContext.endIndex;
          }
          break;
        }
        case 'FOR': {
          const [bindName, collectionName] = tagContext.contents.split(':').map(a => a.trim());
          const array = this.extractValue(collectionName, entity, {
            responseType: 'array'
          });
          if (array) {
            result += template.substring(pos.index, tagContext.startIndex);
            for (const value of array) {
              // 再帰呼び出しによりposが進むので、ループのたびにposを戻す必要がある
              pos.index = tagContext.endIndex;
              result += this.parse(pos, template, { [bindName]: value }, tagContext.sub);
              // FORループするときは各行で改行する
              result += '\n';
            }
          }
          break;
        }
        case 'END': {
          // 2025-04-13 現時点ではBEGINやIFがネストされた場合について期待通りに動作しない
          switch (true) {
            // BEGINの場合、subにIFタグが1つ以上あり、いずれもstatus=10(成功)になっていない
            case tagContext.parent?.type === 'BEGIN'
              && !!tagContext.parent.sub.find(a => a.type === 'IF')
              && !tagContext.parent.sub.find(a => a.type === 'IF' && a.status === 10):
            // IFの場合、IFのstatusがstatus=10(成功)になっていない
            case tagContext.parent?.type === 'IF' && tagContext.parent.status !== 10:
              pos.index = tagContext.endIndex;
              return '';
            default:
          }
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          return result;
        }
        case 'BIND': {
          result += template.substring(pos.index, tagContext.startIndex);
          pos.index = tagContext.endIndex;
          const value = this.extractValue(tagContext.contents, entity);
          result += value == null ? '' : String(value);
          break;
        }
        default:
      }
    }

    // 最後に余った部分を追加する
    result += template.substring(pos.index);
    return result;
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
      throw new Error(`${tagContext.type} に対してgetDummyParamEndIndexが呼び出されました`);
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
            throw new Error(`括弧が閉じられていません [${i}]`);
          default:
        }
      } else if (quoted) {
        // クォート解析中
        switch (true) {
          case c === '\'':
            // クォート終了
            return i + 1;
          case c === '\n':
            throw new Error(`クォートが閉じられていません [${i}]`);
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
            bracket = true;
            break;
          case c === ')':
            throw new Error(`括弧が開始されていません [${i}]`);
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
    try {
      const evaluate = new Function('entity', `
        with (entity) {
          try {
            return ${condition};
          } catch(error) {
            return false;
          }
        }`
      );
      return !!evaluate(entity);
    } catch (error) {
      console.warn('Error evaluating condition:', condition, entity, error);
      return false;
    }
  }

  /**
   * entityからparamで指定した値を文字列で取得する
   *
   * * 返却する値が配列の場合は丸括弧で括り、各項目をカンマで区切る
   *   ('a', 'b', 'c')
   *   (1, 2, 3)
   * * 返却する値がstring型の場合はシングルクォートで括る
   *   'abc'
   * * 返却する値がnumber型の場合はそのまま返す
   *   1234
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
    try {
      const propertyPath = property.split('.');
      let value: any = entity;
      for (const prop of propertyPath) {
        if (value && value.hasOwnProperty(prop)) {
          value = value[prop];
        } else {
          return undefined as ExtractValueType<T>;
        }
      }
      let result = '';
      switch (options?.responseType) {
        case 'array':
        case 'object':
          return value as ExtractValueType<T>;
        default:
          // string
          if (Array.isArray(value)) {
            result = `(${value.map(v => typeof v === 'string' ? `'${v}'` : v).join(',')})`;
          } else {
            result = typeof value === 'string' ? `'${this.escape(value)}'` : value;
          }
          return result as ExtractValueType<T>;
      }
    } catch (error) {
      console.warn('Error extracting value', property, entity, error);
      return undefined as ExtractValueType<T>;
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
