import { describe, expect, it } from "vitest";

import {
  getPixelAvatarLabel,
  normalizePixelAvatarColor,
  normalizePixelAvatarId,
  pixelAvatarColors,
  pixelAvatarIds,
} from "@/lib/pixel-avatars";

describe("pixel avatars", () => {
  it("defaults to the bookworm avatar", () => {
    expect(normalizePixelAvatarId(null)).toBe("bookworm");
    expect(normalizePixelAvatarId("unknown")).toBe("bookworm");
    expect(getPixelAvatarLabel(undefined)).toBe("Bookworm");
  });

  it("accepts configured avatar ids and hex colors only", () => {
    expect(normalizePixelAvatarId(pixelAvatarIds[1])).toBe(pixelAvatarIds[1]);
    expect(normalizePixelAvatarColor(pixelAvatarColors[2])).toBe(pixelAvatarColors[2]);
    expect(normalizePixelAvatarColor("blue")).toBe("#65a30d");
    expect(normalizePixelAvatarColor("#123abz")).toBe("#65a30d");
  });
});
