import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/queries";
import { clubsQueryOptions } from "@/features/clubs/queries";

export function ClubsPage() {
  const user = useCurrentUser();
  const userId = user.data?.id ?? "";
  const clubs = useQuery({
    ...clubsQueryOptions(userId),
    enabled: Boolean(userId),
  });

  if (user.error) {
    throw user.error;
  }

  if (!user.isPending && !user.data) {
    throw new Error("Clubs route requires a signed-in user.");
  }

  if (clubs.error) {
    throw clubs.error;
  }

  const isLoading = user.isPending || clubs.isPending;

  return (
    <section className="mx-auto w-full min-w-0 max-w-5xl space-y-8">
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

      {isLoading ? (
        <ClubGridSkeleton />
      ) : clubs.data?.length ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {clubs.data.map((club) => (
            <Link
              key={club.id}
              to="/app/clubs/$clubId/schedule"
              params={{ clubId: club.id }}
              className="group flex min-h-40 min-w-0 flex-col overflow-hidden rounded-lg border bg-card/20 p-5 transition-[background-color,border-color,box-shadow] hover:border-foreground/20 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h2
                  className="min-w-0 truncate text-base font-semibold text-foreground"
                  title={club.name}
                >
                  {club.name}
                </h2>
                <Badge
                  variant="outline"
                  className="shrink-0 bg-background/40 font-normal capitalize text-muted-foreground"
                >
                  {club.viewerRole}
                </Badge>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                {club.description?.trim() || "No description provided."}
              </p>

              <div className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-muted-foreground">
                <UsersIcon aria-hidden="true" className="size-3.5" />
                <span>{formatMemberCount(club.memberCount)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-6 py-10 text-center">
          <h2 className="text-sm font-medium text-foreground">
            No private clubs yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create a private club to start reading papers together.
          </p>
        </div>
      )}
    </section>
  );
}

function ClubGridSkeleton() {
  return (
    <div
      className="grid gap-4 xl:grid-cols-2"
      role="status"
      aria-label="Loading clubs"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-40 flex-col rounded-lg border p-5"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="mt-auto h-3.5 w-20" />
        </div>
      ))}
      <span className="sr-only">Loading clubs...</span>
    </div>
  );
}

function formatMemberCount(memberCount: number) {
  return `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
}
