import test from 'node:test';
import assert from 'node:assert/strict';
import { restoredWindowBounds } from '../../src/desktop/window-bounds';

test('restoration preserves usable placement and recenters stranded or barely visible windows', () => {
  const displays = [{ x: 0, y: 25, width: 1512, height: 957 }, { x: -1920, y: 0, width: 1920, height: 1080 }];
  const retained = { x: -1800, y: 90, width: 1280, height: 800 };
  assert.deepEqual(restoredWindowBounds(retained, displays), retained);
  assert.deepEqual(restoredWindowBounds(retained, displays.slice(0, 1)), { width: 1280, height: 800 });
  assert.deepEqual(restoredWindowBounds({ x: 1413, y: 25, width: 500, height: 520 }, displays), { width: 500, height: 520 });
  assert.deepEqual(restoredWindowBounds({ x: 1412, y: 25, width: 500, height: 520 }, displays), { x: 1412, y: 25, width: 500, height: 520 });
  assert.deepEqual(restoredWindowBounds({ x: 20, y: 883, width: 500, height: 520 }, displays), { width: 500, height: 520 });
  assert.deepEqual(restoredWindowBounds({ x: 20, y: 882, width: 500, height: 520 }, displays), { x: 20, y: 882, width: 500, height: 520 });
});
