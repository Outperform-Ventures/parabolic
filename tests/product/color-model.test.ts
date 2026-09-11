import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hexToHsv,
  hsvToHex,
  isEmojiIcon,
} from "../../src/client/features/color-model.ts";
test("HSV control roundtrips RGB gamut samples, wraps hue and identifies compound emoji", () => {
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17) {
        const hex =
          "#" +
          [r, g, b]
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
        assert.equal(hsvToHex(hexToHsv(hex)), hex);
      }
  assert.equal(hsvToHex({ h: 360, s: 1, v: 1 }), "#ff0000");
  assert.equal(hsvToHex({ h: -120, s: 1, v: 1 }), "#0000ff");
  assert.equal(hsvToHex({ h: 150, s: 1, v: 0 }), "#000000");
  for (const icon of ["🇺🇸", "👩🏽‍💻", "1️⃣", "🚀"]) assert.ok(isEmojiIcon(icon));
  for (const icon of ["Triangle", "GitBranch", "Box"])
    assert.ok(!isEmojiIcon(icon));
});
