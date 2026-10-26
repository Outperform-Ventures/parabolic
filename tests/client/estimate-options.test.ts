import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateOptions } from '../../src/shared/estimates';

test('unconfigured imports infer an unambiguous exponential scale without changing settings', () => {
  const config = {};
  assert.deepEqual(estimateOptions(config, [1, 2, 4, 8, 16, 32]).map(option => option.id), [null, 0, 1, 2, 4, 8, 16, 32, 64]);
  assert.deepEqual(config, {});
});
test('explicit scales take precedence while historical values remain available', () => {
  assert.deepEqual(estimateOptions({ estimateScale: 'Fibonacci' }, [4, 16]).map(option => option.id), [null, 0, 1, 2, 3, 4, 5, 8, 16]);
  assert.deepEqual(estimateOptions({ estimateScale: 'None' }, [16]), [{ id: null, name: 'No estimate' }]);
});
test('ambiguous values keep the default scale and ignore invalid values', () => {
  assert.deepEqual(estimateOptions({}, [3, 4, null, undefined, NaN, Infinity, -2]).map(option => option.id), [null, 0, 1, 2, 3, 4, 5, 8]);
  assert.deepEqual(estimateOptions().map(option => option.id), [null, 0, 1, 2, 3, 5, 8]);
});
test('t-shirt labels are retained when a historical extended value is present', () => {
  assert.equal(estimateOptions({ estimateScale: 'T-shirt' }, [21]).find(option => option.id === 21)?.name, 'XXXL');
});
