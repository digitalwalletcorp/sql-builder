/**
 * entityで指定したオブジェクトからドットで連結されたプロパティキーに該当する値を取得する
 *
 * @param {Record<string, any>} entity
 * @param {string} property
 * @returns {any}
 */
export function getProperty(entity: Record<string, any>, property: string): any {
  // `?.` または `.` でパスを分割
  const propertyPath = property.split(/(\?\.)|\./).filter(Boolean);

  // 再帰呼び出し用のヘルパー関数
  const get = (obj: Record<string, any>, keys: string[]): any => {
    if (keys.length === 0) {
      return obj;
    }
    // オプショナルチェイニングのチェック
    if (obj == null) {
      return undefined;
    }

    const currentKey = keys[0];
    const remainingKeys = keys.slice(1);

    // `?.` のトークンはスキップ
    if (currentKey === '?.') {
      return get(obj, remainingKeys);
    }
    // プロパティが存在しない場合は undefined を返す
    if (!obj.hasOwnProperty(currentKey)) {
      return undefined;
    }
    return get(obj[currentKey], remainingKeys);
  };
  return get(entity, propertyPath);
}
