export const MAX_PROFILE_BIO_LENGTH = 150;

export function normalizeProfileBio(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_PROFILE_BIO_LENGTH).trimEnd() || null;
}

export function truncateProfileBio(value: string | null | undefined) {
  const normalized = normalizeProfileBio(value);

  if (!normalized) {
    return null;
  }

  if (value && value.trim().length > MAX_PROFILE_BIO_LENGTH) {
    return `${normalized.slice(0, MAX_PROFILE_BIO_LENGTH - 3).trimEnd()}...`;
  }

  return normalized;
}
