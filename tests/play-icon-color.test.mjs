import assert from 'node:assert/strict';
import { colord } from 'colord';
import { getThemedPlayIconColor } from '../src/theme/playIconColor.ts';

const palette = ['#C04200', '#0759D4', '#16864A', '#D7B900', '#7B2CBF', '#13AFC2'];

for (const color of palette) {
  const source = colord(color).toHsl();
  const darkHex = getThemedPlayIconColor(color, true);
  const lightHex = getThemedPlayIconColor(color, false);
  assert.ok(darkHex, `dark tint should be returned for ${color}`);
  assert.ok(lightHex, `light tint should be returned for ${color}`);

  const dark = colord(darkHex).toHsl();
  const light = colord(lightHex).toHsl();
  assert.ok(dark.l < source.l, `${color}: dark theme tint must be darker`);
  assert.ok(light.l > source.l, `${color}: light theme tint must be lighter`);
  assert.ok(Math.abs(dark.s - source.s) <= 2, `${color}: dark tint should preserve saturation`);
  assert.ok(Math.abs(light.s - source.s) <= 2, `${color}: light tint should preserve saturation`);
  if (source.s > 0.1) {
    assert.ok(Math.abs(dark.h - source.h) <= 2, `${color}: dark tint should preserve hue`);
    assert.ok(Math.abs(light.h - source.h) <= 2, `${color}: light tint should preserve hue`);
  }
}

assert.equal(getThemedPlayIconColor('#C04200', true), '#441800');
assert.notEqual(getThemedPlayIconColor('#C04200', true), '#ffffff');
assert.notEqual(getThemedPlayIconColor('#C04200', false), '#000000');
assert.equal(getThemedPlayIconColor(undefined, true), undefined);
assert.equal(getThemedPlayIconColor('default', false), undefined);
assert.equal(getThemedPlayIconColor('not-a-color', true), undefined);

console.log('Theme-directed play icon color tests passed.');
