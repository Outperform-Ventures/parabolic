import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  emojiCatalog,
  findEmoji,
} from "../../src/client/features/emoji-data.ts";
const unicodeFixture = "reference/unicode/emoji-test-17.0.txt";
test("picker represents every fully-qualified Unicode 17 emoji and keeps searchable aliases", { skip: !existsSync(unicodeFixture) }, () => {
  const normalize = (value: string) => value.replaceAll("\ufe0f", "");
  const available = new Set(
    Object.values(emojiCatalog.emojis).flatMap((emoji) =>
      emoji.skins.map((skin) => normalize(skin.native)),
    ),
  );
  const snapshot = readFileSync(
    unicodeFixture,
    "utf8",
  );
  let total = 0;
  for (const line of snapshot.split("\n")) {
    const match =
      /^([0-9A-F ]+)\s*;\s*(fully-qualified|component)\s*#\s*(\S+)\s+E([\d.]+)\s+(.+)$/.exec(
        line,
      );
    if (match) {
      total++;
      assert.ok(available.has(normalize(match[3])), `Missing ${match[5]}`);
    }
  }
  assert.equal(total, 3953);
  assert.equal(findEmoji("+1")?.skins[0].native, "👍");
  assert.equal(findEmoji("rocket")?.skins[0].native, "🚀");
  assert.ok(findEmoji("distorted_face"));
});
