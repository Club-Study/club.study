export const pixelAvatarIds = [
  "bookworm",
  "cat",
  "dog",
  "wizard",
  "owl",
  "robot",
] as const;

export const pixelAvatarColors = [
  "#65a30d",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
  "#d97706",
  "#475569",
] as const;

export type PixelAvatarId = (typeof pixelAvatarIds)[number];
export type PixelAvatarColor = (typeof pixelAvatarColors)[number];

export const pixelAvatarLabels: Record<PixelAvatarId, string> = {
  bookworm: "Bookworm",
  cat: "Cat",
  dog: "Dog",
  wizard: "Wizard",
  owl: "Owl",
  robot: "Robot",
};

export function getPixelAvatarLabel(avatarId: string | null | undefined) {
  return pixelAvatarLabels[normalizePixelAvatarId(avatarId)];
}

export function normalizePixelAvatarId(value: string | null | undefined): PixelAvatarId {
  return pixelAvatarIds.includes(value as PixelAvatarId)
    ? (value as PixelAvatarId)
    : "bookworm";
}

export function normalizePixelAvatarColor(value: string | null | undefined): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value ?? "") ? value ?? "#65a30d" : "#65a30d";
}
