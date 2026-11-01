import assert from 'node:assert/strict';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHexColor, rgbToHex } from '../src/utils/hexColor.ts';

assert.equal(normalizeHexColor('#8B5CF6'), '#8b5cf6');
assert.equal(normalizeHexColor('8b5cf6'), '#8b5cf6');
assert.equal(normalizeHexColor('#AbC'), '#aabbcc');
assert.equal(normalizeHexColor(' #abc '), '#aabbcc');
assert.equal(normalizeHexColor('#12'), null);
assert.equal(normalizeHexColor('rgb(1, 2, 3)'), null);
assert.equal(normalizeHexColor('red'), null);
assert.equal(hsvToHex(hexToHsv('#8b5cf6')), '#8b5cf6');
assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00ff00');
assert.equal(hsvToHex({ h: 0, s: 0, v: 0 }), '#000000');
assert.deepEqual(hexToRgb('#8b5cf6'), { r: 139, g: 92, b: 246 });
assert.equal(rgbToHex({ r: 139, g: 92, b: 246 }), '#8b5cf6');
assert.equal(rgbToHex({ r: 999, g: -8, b: 10.7 }), '#ff000b');

console.log('HEX, RGB, and HSV color tests passed.');
