import * as common from './common';

type Token =
  | { type: 'IDENTIFIER'; value: string } // 例: param, length
  | { type: 'OPERATOR'; value: string }   // 例: >, &&, ===, !=
  | { type: 'NUMBER'; value: number }     // 例: 100.123
  | { type: 'BOOLEAN'; value: boolean }   // 例: true, false
  | { type: 'NULL' }
  | { type: 'UNDEFINED' }
  | { type: 'STRING'; value: string }     // 例: 'abc'
  | { type: 'PARENTHESIS'; value: '(' | ')' };

type RpnToken = Token | { type: 'MEMBER_ACCESS_PART', value: string };

// 演算子の優先順位と結合性 (より長い演算子を先に定義)
const PRECEDENCE: {
  [op: string]: {
    precedence: number;
    associativity: 'left' | 'right'
  }
} = {
  '||': { precedence: 1, associativity: 'left' },
  '&&': { precedence: 2, associativity: 'left' },
  '==': { precedence: 3, associativity: 'left' },
  '!=': { precedence: 3, associativity: 'left' },
  '===': { precedence: 3, associativity: 'left' },
  '!==': { precedence: 3, associativity: 'left' },
  '<': { precedence: 4, associativity: 'left' },
  '<=': { precedence: 4, associativity: 'left' },
  '>': { precedence: 4, associativity: 'left' },
  '>=': { precedence: 4, associativity: 'left' },
  '!': { precedence: 5, associativity: 'right' } // 単項演算子は高優先度
};

/**
 * SQLBuilderの条件文(*IF*)で指定された条件文字列を解析するためのAST。
 * JavaScriptの文法をカバーするものではなく、SQLBuilderで利用可能な限定的な構文のみサポートする。
 */
export class AbstractSyntaxTree {

  /**
   * 与えられた条件文字列を構文解析し、entityに対する条件として成立するか評価する
   *
   * @param {string} condition "params != null && params.length > 10" のような条件
   * @param {Record<string, any>} entity
   * @returns {boolean}
   */
  public evaluateCondition(condition: string, entity: Record<string, any>): boolean {
    try {
      const tokens = this.tokenize(condition); // トークン化
      const rpnTokens = this.shuntingYard(tokens); // RPN変換
      const result = this.evaluateRpn(rpnTokens, entity); // 評価
      return result;
    } catch (error) {
      console.warn('Error evaluating condition:', condition, entity, error);
      throw error;
    }
  }

  /**
   * 与えられた条件文字列をトークンに分割する
   *
   * @param {string} condition
   * @returns {Token[]}
   */
  public tokenize(condition: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < condition.length) {
      const char = condition[i];
      // 空白をスキップ
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // 演算子 (長いものからチェック)
      // 3桁定義
      const chunk3 = condition.substring(i, i + 3);
      switch (chunk3) {
        case '===':
        case '!==':
          tokens.push({ type: 'OPERATOR', value: chunk3 });
          i += 3;
          continue;
        default:
      }
      // 2桁定義
      const chunk2 = condition.substring(i, i + 2);
      switch (chunk2) {
        case '==':
        case '!=':
        case '<=':
        case '>=':
        case '&&':
        case '||':
          tokens.push({ type: 'OPERATOR', value: chunk2 });
          i += 2;
          continue;
        default:
      }
      // 1桁定義
      const chunk1 = char;
      switch (chunk1) {
        case '>':
        case '<':
        case '!':
        case '=':
          tokens.push({ type: 'OPERATOR', value: chunk1 });
          i += 1;
          continue;
        // case '.':
        //   tokens.push({ type: 'IDENTIFIER', value: chunk1 }); // '.'も識別子の一部として扱う
        //   i += 1;
        //   continue;
        case '(':
        case ')':
          tokens.push({ type: 'PARENTHESIS', value: chunk1 });
          i += 1;
          continue;
        default:
      }

      const reststring = condition.substring(i); // 現在のインデックスから末尾までの文字列
      // 数値リテラル
      const numMatch = reststring.match(/^-?\d+(\.\d+)?/);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: parseFloat(numMatch[0]) });
        i += numMatch[0].length;
        continue;
      }

      // 文字列リテラル
      switch (chunk1) {
        case '\'':
        case '"':
          const quote = chunk1;
          let j = i + 1;
          let strValue = '';
          while (j < condition.length && condition[j] !== quote) {
            // エスケープ文字の処理 (\' や \\) は必要に応じて追加
            if (condition[j] === '\\' && j + 1 < condition.length) {
                strValue += condition[j+1];
                j += 2;
            } else {
                strValue += condition[j];
                j++;
            }
          }
          if (condition[j] === quote) {
            tokens.push({ type: 'STRING', value: strValue });
            i = j + 1;
            continue;
          } else {
            // クォートが閉じられていない
            throw new Error('Unterminated string literal');
          }
        default:
      }

      // 識別子 (変数名, true, false, null, undefined, length)
      const identMatch = reststring.match(/^[a-zA-Z_][a-zA-Z0-9_.]*/); // ドットを含む識別子
      if (identMatch) {
        const ident = identMatch[0];
        switch (ident) {
          case 'true':
            tokens.push({ type: 'BOOLEAN', value: true });
            break;
          case 'false':
            tokens.push({ type: 'BOOLEAN', value: false });
            break;
          case 'null':
            tokens.push({ type: 'NULL' });
            break;
          case 'undefined':
            tokens.push({ type: 'UNDEFINED' });
            break;
          default:
            tokens.push({ type: 'IDENTIFIER', value: ident }); // プロパティ名
        }
        i += ident.length;
        continue;
      }

      // 未知の文字
      throw new Error(`Unexpected character in condition: ${char} at index ${i}`);
    }
    return tokens;
  }

  /**
   * Shunting Yardアルゴリズムで構文を逆ポーランド記法(Reverse Polish Notation)に変換する
   *
   * @param {Token[]} tokens
   * @returns {RpnToken[]}
   */
  private shuntingYard(tokens: Token[]): RpnToken[] {
    const output: RpnToken[] = [];
    const operatorStack: Token[] = [];

    for (const token of tokens) {
      const type = token.type;
      switch (type) {
        case 'NUMBER':
        case 'BOOLEAN':
        case 'NULL':
        case 'UNDEFINED':
        case 'STRING':
          output.push(token);
          break;
        case 'IDENTIFIER':
          // 識別子（プロパティパスの可能性）をそのまま出力
          output.push(token);
          break;
        case 'OPERATOR':
          const op1 = token;
          while (operatorStack.length) {
            // TODO: 型キャストが必要になるので、Geniericsを強化する
            const op2 = operatorStack[operatorStack.length - 1] as { type: string, value: string };

            // 括弧内は処理しない
            if (op2.value === '(') {
              break;
            }

            // 優先順位のルールに従う
            if (
              (PRECEDENCE[op1.value].associativity === 'left' && PRECEDENCE[op1.value].precedence <= PRECEDENCE[op2.value].precedence)
              // ||
              // (PRECEDENCE[op1.value].associativity === 'right' && PRECEDENCE[op1.value].precedence < PRECEDENCE[op2.value].precedence)
            ) {
              output.push(operatorStack.pop()!);
            } else {
              break;
            }
          }
          operatorStack.push(op1);
          break;
        case 'PARENTHESIS':
          if (token.value === '(') {
            operatorStack.push(token);
          } else if (token.value === ')') {
            let foundLeftParen = false;
            while (operatorStack.length > 0) {
              const op = operatorStack.pop()!;
              if ('value' in op && op.value === '(') {
                foundLeftParen = true;
                break;
              }
              output.push(op);
            }
            if (!foundLeftParen) {
              throw new Error('Mismatched parentheses');
            }
          }
          break;
        default:
          throw new Error(`Unexpected token type: ${type}`);
      }
    }

    while (operatorStack.length) {
      const op = operatorStack.pop()!;
      if ('value' in op && (op.value === '(' || op.value === ')')) {
        throw new Error('Mismatched parentheses');
      }
      output.push(op);
    }

    return output;
  }

  /**
   * 逆ポーランド記法(Reverse Polish Notation)のトークンを評価する
   *
   * @param {RpnToken[]} rpnTokens
   * @param {Record<string, any>} entity
   * @returns {boolean}
   */
  private evaluateRpn(rpnTokens: RpnToken[], entity: Record<string, any>): boolean {
    const stack: any[] = [];

    for (const token of rpnTokens) {
      const type = token.type;
      switch (type) {
        case 'NUMBER':
        case 'BOOLEAN':
        case 'NULL':
        case 'UNDEFINED':
        case 'STRING':
          if ('value' in token) {
            stack.push(token.value);
          }
          break;
        case 'IDENTIFIER':
          stack.push(common.getProperty(entity, token.value));
          break;
        case 'OPERATOR':
          // 単項演算子 '!'
          if (token.value === '!') {
            const operand = stack.pop();
            stack.push(!operand);
            break;
          }

          // 二項演算子
          const right = stack.pop();
          const left = stack.pop();

          switch (token.value) {
            case '==': stack.push(left == right); break;
            case '!=': stack.push(left != right); break;
            case '===': stack.push(left === right); break;
            case '!==': stack.push(left !== right); break;
            case '<': stack.push(left < right); break;
            case '<=': stack.push(left <= right); break;
            case '>': stack.push(left > right); break;
            case '>=': stack.push(left >= right); break;
            case '&&': stack.push(left && right); break;
            case '||': stack.push(left || right); break;
            default: throw new Error(`Unknown operator: ${token.value}`);
          }
          break;
        default:
          throw new Error(`Unexpected token type in RPN: ${type}`);
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid expression');
    }
    return !!stack[0];
  }
}
