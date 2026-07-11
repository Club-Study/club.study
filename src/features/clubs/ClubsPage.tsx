import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clock3Icon, PlusIcon, SendIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/queries";
import {
  applyToClub,
  type ClubDirectoryItem,
} from "@/features/clubs/api";
import { clubDirectoryQueryOptions } from "@/features/clubs/queries";
import { queryKeys } from "@/lib/queryKeys";
import { toUserMessage } from "@/lib/user-facing-error";

export function ClubsPage() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const userId = user.data?.id ?? "";
  const directory = useQuery({
    ...clubDirectoryQueryOptions(userId),
    enabled: Boolean(userId),
  });
  const apply = useMutation({
    mutationFn: applyToClub,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clubs.directory(userId),
      });
      toast.success("Application sent");
    },
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          "club-application",
          "Could not send your application.",
        ),
      ),
  });

  if (user.error) {
    throw user.error;
  }

  if (!user.isPending && !user.data) {
    throw new Error("Clubs route requires a signed-in user.");
  }

  if (directory.error) {
    throw directory.error;
  }

  const memberClubs = (directory.data ?? []).filter(
    (club) => club.viewerRole !== null,
  );
  const discoverableClubs = (directory.data ?? []).filter(
    (club) => club.viewerRole === null,
  );
  const isLoading = user.isPending || directory.isPending;

  return (
    <section className="mx-auto w-full min-w-0 max-w-5xl space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Reading communities
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
      ) : (
        <>
          <ClubSection
            title="Your clubs"
            description="Clubs where you can read papers and join the schedule."
          >
            {memberClubs.length ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                {memberClubs.map((club) => (
                  <MemberClubCard key={club.id} club={club} />
                ))}
              </div>
            ) : (
              <EmptyClubs
                title="No memberships yet"
                description="Create a club or apply to one from the directory below."
              />
            )}
          </ClubSection>

          <ClubSection
            title="Discover clubs"
            description="Browse every club. Papers, schedules, and member details stay private until you join."
          >
            {discoverableClubs.length ? (
              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                {discoverableClubs.map((club) => (
                  <DiscoverClubCard
                    key={club.id}
                    club={club}
                    isApplying={apply.isPending}
                    onApply={() => apply.mutate(club.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyClubs
                title="No other clubs to discover"
                description="You are already a member of every available club."
              />
            )}
          </ClubSection>
        </>
      )}
    </section>
  );
}

function ClubSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function MemberClubCard({ club }: { club: ClubDirectoryItem }) {
  return (
    <Link
      to="/app/clubs/$clubId/schedule"
      params={{ clubId: club.id }}
      className="group flex min-h-40 min-w-0 flex-col overflow-hidden rounded-lg border bg-card/20 p-5 transition-[background-color,border-color,box-shadow] hover:border-foreground/20 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <h3
          className="min-w-0 truncate text-base font-semibold text-foreground"
          title={club.name}
        >
          {club.name}
        </h3>
        <Badge
          variant="outline"
          className="shrink-0 bg-background/40 font-normal capitalize text-muted-foreground"
        >
          {club.viewerRole}
        </Badge>
      </div>

      <ClubDescription description={club.description} />
      <MemberCount count={club.memberCount} className="mt-auto pt-6" />
    </Link>
  );
}

function DiscoverClubCard({
  club,
  isApplying,
  onApply,
}: {
  club: ClubDirectoryItem;
  isApplying: boolean;
  onApply: () => void;
}) {
  const isPending = club.applicationStatus === "pending";
  const isRetry =
    club.applicationStatus === "rejected" ||
    club.applicationStatus === "approved";

  return (
    <article className="group flex min-h-44 min-w-0 flex-col overflow-hidden rounded-lg border bg-card/20 p-5 transition-[background-color,border-color] hover:border-foreground/20 hover:bg-muted/25">
      <h3
        className="min-w-0 truncate text-base font-semibold text-foreground"
        title={club.name}
      >
        {club.name}
      </h3>
      <ClubDescription description={club.description} />

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-6">
        <div className="min-w-0 space-y-1">
          <MemberCount count={club.memberCount} />
          {club.applicationStatus === "rejected" ? (
            <p className="text-xs text-muted-foreground">
              Previous application was not approved.
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || isApplying}
          aria-label={
            isPending
              ? `Application pending for ${club.name}`
              : `Apply to ${club.name}`
          }
          onClick={onApply}
        >
          {isPending ? (
            <Clock3Icon aria-hidden="true" className="size-4" />
          ) : (
            <SendIcon aria-hidden="true" className="size-4" />
          )}
          {isPending ? "Pending" : isRetry ? "Apply again" : "Apply"}
        </Button>
      </div>
    </article>
  );
}

function ClubDescription({ description }: { description: string | null }) {
  return (
    <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
      {description?.trim() || "No description provided."}
    </p>
  );
}

function MemberCount({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}
    >
      <UsersIcon aria-hidden="true" className="size-3.5" />
      <span>{formatMemberCount(count)}</span>
    </div>
  );
}

function EmptyClubs({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-8 text-center">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
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
