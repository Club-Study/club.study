import { Link } from "@tanstack/react-router";

import { KatexText } from "@/components/katex-text";
import { Badge } from "@/components/ui/badge";
import type { Profile, ProfileOverview } from "@/features/profile/api";

export function ProfileSidebar({
  profile,
  overview,
}: {
  profile: Profile;
  overview: ProfileOverview;
}) {
  return (
    <aside className="space-y-6">
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Bio</h2>
        {profile.bio ? (
          <KatexText
            text={profile.bio}
            className="mt-3 text-sm leading-6 text-muted-foreground"
          />
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Clubs</h2>
        <div className="mt-3 space-y-2">
          {overview.memberships.length > 0 ? (
            overview.memberships.map((membership) => (
              <Link
                key={membership.club_id}
                to="/app/clubs/$clubId"
                params={{ clubId: membership.club_id }}
                className="block rounded-md border p-3 transition-colors hover:bg-muted/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {membership.clubs.name}
                  </span>
                  <Badge variant="secondary">{membership.role}</Badge>
                </div>
                {membership.clubs.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {membership.clubs.description}
                  </p>
                ) : null}
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No joined clubs.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
