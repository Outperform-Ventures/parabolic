import importedData from "@emoji-mart/data";
import supplement from "./emoji-supplement.json";
export type EmojiEntry = {
  id: string;
  name: string;
  keywords: string[];
  skins: { native: string }[];
  version?: number;
  url?: string;
};
export type EmojiData = {
  emojis: Record<string, EmojiEntry>;
  aliases: Record<string, string>;
  categories: { id: string; emojis: string[] }[];
};
const base = importedData as unknown as EmojiData;
export const emojiCatalog: EmojiData = {
  emojis: { ...base.emojis, ...supplement.emojis },
  aliases: base.aliases,
  categories: base.categories.map((category) => ({
    ...category,
    emojis: [
      ...category.emojis,
      ...(supplement.categories.find((group) => group.id === category.id)
        ?.emojis ?? []),
    ],
  })),
};
export function findEmoji(name: string) {
  const key = name.toLowerCase();
  return (
    emojiCatalog.emojis[key] ??
    emojiCatalog.emojis[emojiCatalog.aliases[key]] ??
    Object.values(emojiCatalog.emojis).find(
      (emoji) =>
        emoji.name
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "_")
          .replace(/^_|_$/g, "") === key,
    )
  );
}
