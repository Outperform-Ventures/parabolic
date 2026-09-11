export type HSV = { h: number; s: number; v: number };
const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));
export function hexToHsv(hex: string): HSV {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { h: 240, s: 0.5, v: 0.8 };
  const [r, g, b] = [1, 3, 5].map(
      (index) => parseInt(hex.slice(index, index + 2), 16) / 255,
    ),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const hue =
    delta === 0
      ? 0
      : max === r
        ? ((g - b) / delta) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  return { h: (hue * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}
export function hsvToHex({ h, s, v }: HSV): string {
  h = ((h % 360) + 360) % 360;
  s = clamp(s);
  v = clamp(v);
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    [r, g, b]
      .map((value) =>
        Math.round((value + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export const isEmojiIcon = (icon?: string) =>
  !!icon &&
  /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(icon);
