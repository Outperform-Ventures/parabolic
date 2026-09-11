export const FONT_SIZE_OPTIONS = ["Smaller", "Small", "Default", "Large", "Larger"];

// These are root text sizes; controls and icons keep their layout dimensions.
export function fontSizePixels(value: unknown): number {
  switch (typeof value === "string" ? value.toLowerCase() : "") {
    case "smaller": return 14;
    case "small": return 15;
    case "large": return 18;
    case "larger": return 20;
    default: return 16;
  }
}
