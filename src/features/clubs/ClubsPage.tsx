import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";

import { clubsQueryOptions } from "@/features/clubs/queries";
import { Button } from "@/components/ui/button";

export function ClubsPage() {
  const clubs = useQuery(clubsQueryOptions);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Private clubs
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Clubs</h1>
        </div>
        <Button asChild size="sm">
          <Link to="/app/clubs/new">
            <PlusIcon className="size-4" />
            New club
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        {(clubs.data ?? []).map((club) => (
          <Link
            key={club.id}
            to="/app/clubs/$clubId/schedule"
            params={{ clubId: club.id }}
            className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-muted/35"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{club.name}</p>
            </div>
            {club.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {club.description}
              </p>
            ) : null}
          </Link>
        ))}
        {clubs.data?.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No private clubs yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
