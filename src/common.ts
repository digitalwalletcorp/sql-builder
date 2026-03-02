type PropertyResult = {
  exists: boolean;
  value: any;
}

/**
 * entityで指定したオブジェクトからドットで連結されたプロパティキーに該当する値を取得する
 *
 * @param {Record<string, any>} entity
 * @param {string} property
 * @returns {any}
 */
export function getProperty(entity: Record<string, any>, property: string): any {
  return getPropertyResult(entity, property).value;
}

/**
 * entityで指定したオブジェクトからドットで連結されたプロパティキーに該当する値が存在するかチェックする
 *
 * @param {Record<string, any>} entity
 * @param {string} property
 * @returns {boolean}
 */
export function hasProperty(entity: Record<string, any>, property: string): boolean {
  return getPropertyResult(entity, property).exists;
}

/**
 * entityで指定したオブジェクトからドットで連結されたプロパティキーに該当する値を取得する
 *
 * @param {Record<string, any>} entity
 * @param {string} property
 * @returns {PropertyResult}
 */
export function getPropertyResult(entity: Record<string, any>, property: string): PropertyResult {
  // `?.` または `.` でパスを分割
  const propertyPath = property.split(/(\?\.)|\./).filter(Boolean);

  // 再帰呼び出し用のヘルパー関数
  const get = (obj: Record<string, any>, keys: string[]): any => {
    if (keys.length === 0) {
      return {
        exists: true,
        value: obj
      } as PropertyResult;
    }
    // オプショナルチェイニングのチェック
    if (obj == null) {
      return {
        exists: false,
        value: undefined
      } as PropertyResult;
    }

    const currentKey = keys[0];
    const remainingKeys = keys.slice(1);

    // `?.` のトークンはスキップ
    if (currentKey === '?.') {
      return get(obj, remainingKeys);
    }
    // プロパティが存在しない場合は undefined を返す
    if (!Object.prototype.hasOwnProperty.call(obj, currentKey)) {
      return {
        exists: false,
        value: undefined
      } as PropertyResult;
    }
    return get(obj[currentKey], remainingKeys);
  };
  return get(entity, propertyPath);
}
