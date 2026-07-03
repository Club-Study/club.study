import { z } from "zod";

export const clubFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
});

export type ClubFormValues = z.infer<typeof clubFormSchema>;

export function slugFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function generatedClubSlug(name: string) {
  const base = slugFromName(name) || "club";
  const suffix = crypto.randomUUID().slice(0, 6);
  const maxBaseLength = 64 - suffix.length - 1;
  const trimmedBase = base.slice(0, maxBaseLength).replace(/-+$/g, "") || "club";

  return `${trimmedBase}-${suffix}`;
}
