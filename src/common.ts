/**
 * entityで指定したオブジェクトからドットで連結されたプロパティキーに該当する値を取得する
 *
 * @param {Record<string, any>} entity
 * @param {string} property
 * @returns {any}
 */
export function getProperty(entity: Record<string, any>, property: string): any {
  const propertyPath = property.split('.');
  let value = entity;
  for (const prop of propertyPath) {
    if (value && value.hasOwnProperty(prop)) {
      value = value[prop];
    } else {
      return undefined;
    }
  }
  return value;
}
