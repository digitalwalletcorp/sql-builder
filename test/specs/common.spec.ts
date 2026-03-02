import * as common from '@/common';

describe('@/common.ts', () => {
  describe('hasProperty', () => {
    it('hasProperty.001', () => {
      const entity = {
        user_id: 9999,
        name: 'abc'
      };
      const result = common.hasProperty(entity, 'user_id');
      expect(result).toBe(true);
    });
    it('hasProperty.002', () => {
      const entity = {
        user_id: 9999,
        given_name: 'ELIZABETH',
        middle_name: '',
        sur_name: 'TURNER',
        nationality: 'USA',
        exclude_days: 30
      };
      const result = common.hasProperty(entity, 'user_id');
      expect(result).toBe(true);
    });
  });

  describe('getProperty', () => {
    it('getPeroperty.001', () => {
      const entity = {
        user_id: 9999,
        name: 'abc'
      };
      const result = common.getProperty(entity, 'user_id');
      expect(result).toBe(9999);
    });
    it('getproperty.002', () => {
      const entity = {
        user_id: 9999,
        given_name: 'ELIZABETH',
        middle_name: '',
        sur_name: 'TURNER',
        nationality: 'USA',
        exclude_days: 30
      };
      const result = common.getProperty(entity, 'user_id');
      expect(result).toBe(9999);
    });
  })
});
