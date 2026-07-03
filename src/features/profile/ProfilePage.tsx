import type { Json } from "@/lib/supabase/database.types";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheckIcon,
  CalendarClockIcon,
  PencilIcon,
  SaveIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/queries";
import {
  updateProfile,
  type Profile,
  type ProfileOverview,
  type ProfileReadingLog,
} from "@/features/profile/api";
import {
  profileOverviewQueryOptions,
  profileQueryOptions,
} from "@/features/profile/queries";
import { formatWeekLabel, getCurrentWeekStart, toDateInputValue } from "@/lib/dates/week";
import {
  getPixelAvatarLabel,
  pixelAvatarColors,
  pixelAvatarIds,
} from "@/lib/pixel-avatars";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";

type ProfileFormValues = Pick<
  Profile,
  "display_name" | "avatar_id" | "avatar_color"
> & {
  bio: string;
};

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const user = useCurrentUser();
  const userId = user.data?.id;
  const profile = useQuery({
    ...profileQueryOptions(supabase, userId ?? ""),
    enabled: Boolean(userId),
  });
  const overview = useQuery({
    ...profileOverviewQueryOptions(supabase, userId ?? ""),
    enabled: Boolean(userId),
  });
  const formValues = profile.data
    ? {
        display_name: profile.data.display_name,
        avatar_id: profile.data.avatar_id,
        avatar_color: profile.data.avatar_color,
        bio: profile.data.bio ?? "",
      }
    : undefined;
  const form = useForm<ProfileFormValues>({
    values: formValues,
  });
  const avatarId = useWatch({ control: form.control, name: "avatar_id" });
  const avatarColor = useWatch({ control: form.control, name: "avatar_color" });
  const displayName = useWatch({ control: form.control, name: "display_name" });
  const activity = useMemo(() => {
    if (!overview.data) {
      return null;
    }

    return buildProfileActivity(overview.data);
  }, [overview.data]);
  const update = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      if (!user.data) {
        throw new Error("Sign in required.");
      }

      const nextDisplayName = values.display_name.trim();

      if (!nextDisplayName) {
        throw new Error("Display name is required.");
      }

      return updateProfile(supabase, user.data.id, {
        display_name: nextDisplayName,
        avatar_id: values.avatar_id,
        avatar_color: values.avatar_color,
        bio: values.bio?.trim() || null,
      });
    },
    onSuccess: async (nextProfile) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.current(nextProfile.id),
      });
      setIsEditing(false);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error.message),
  });

  if (user.error) {
    throw user.error;
  }

  if (profile.error) {
    throw profile.error;
  }

  if (overview.error) {
    throw overview.error;
  }

  if (user.isPending || profile.isPending || overview.isPending) {
    return <ProfileLoading />;
  }

  if (!user.data) {
    throw new Error("Profile route requires a signed-in user.");
  }

  if (!profile.data) {
    throw new Error("Profile query completed without profile data.");
  }

  if (!overview.data || !activity) {
    throw new Error("Profile overview query completed without overview data.");
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Profile</p>
          <h1 className="mt-2 text-2xl font-semibold">{profile.data.display_name}</h1>
        </div>
        <Button
          type="button"
          variant={isEditing ? "secondary" : "outline"}
          onClick={() => setIsEditing((current) => !current)}
        >
          <PencilIcon className="size-4" />
          {isEditing ? "Close editor" : "Edit profile"}
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid min-w-0 gap-5 p-4 sm:grid-cols-[104px_minmax(0,1fr)] sm:p-5 lg:grid-cols-[148px_minmax(0,1fr)]">
          <PixelAvatar
            avatarId={profile.data.avatar_id}
            color={profile.data.avatar_color}
            label={profile.data.display_name}
            className="size-24 rounded-xl sm:size-26 lg:size-32"
          />
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="truncate text-xl font-semibold">
                    {profile.data.display_name}
                  </h2>
                  {user.data.email ? (
                    <p className="text-sm text-muted-foreground">{user.data.email}</p>
                  ) : null}
                </div>
                {profile.data.bio ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {profile.data.bio}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <ProfileStat label="Reading" value={activity.readingCount} />
                <ProfileStat label="Planned" value={activity.plannedCount} />
                <ProfileStat label="Read" value={activity.readCount} />
              </div>
            </div>
            <ContributionGraph
              cells={activity.contributionCells}
              label="Reading activity over the past 49 weeks"
            />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Reading Stats</h2>
            <div className="mt-4 grid gap-3">
              <ProfileMetric
                icon={BookOpenCheckIcon}
                label="Papers read"
                value={activity.readCount}
              />
              <ProfileMetric
                icon={CalendarClockIcon}
                label="Scheduled papers"
                value={overview.data.scheduledPapers.length}
              />
              <ProfileMetric
                icon={UsersIcon}
                label="Joined clubs"
                value={overview.data.memberships.length}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Clubs</h2>
            <div className="mt-3 space-y-2">
              {overview.data.memberships.length > 0 ? (
                overview.data.memberships.map((membership) => (
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

        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium">Recent Reads</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Papers marked read across your clubs.
                </p>
              </div>
              <Badge variant="outline">{activity.readCount} total</Badge>
            </div>
            <div className="mt-3 divide-y">
              {overview.data.readingLogs.length > 0 ? (
                overview.data.readingLogs.slice(0, 8).map((log) => (
                  <ReadingLogRow key={log.id} log={log} />
                ))
              ) : (
                <p className="py-3 text-sm text-muted-foreground">
                  No papers read yet.
                </p>
              )}
            </div>
          </section>

          {isEditing ? (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-medium">Account</h2>
              <form
                className="mt-4 space-y-4"
                onSubmit={form.handleSubmit((values) => update.mutate(values))}
              >
                <div className="flex items-center gap-3">
                  <PixelAvatar
                    avatarId={avatarId}
                    color={avatarColor}
                    label={displayName}
                    className="size-12"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.data.email}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    {...form.register("display_name", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Avatar</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {pixelAvatarIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={`flex flex-col items-center gap-2 rounded-md border p-2 text-xs transition-colors hover:bg-muted ${
                          avatarId === id ? "border-foreground bg-muted" : ""
                        }`}
                        onClick={() =>
                          form.setValue("avatar_id", id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      >
                        <PixelAvatar
                          avatarId={id}
                          color={avatarColor}
                          className="size-10"
                        />
                        <span>{getPixelAvatarLabel(id)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {pixelAvatarColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`size-8 rounded-md border shadow-xs outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring ${
                          avatarColor === color
                            ? "ring-2 ring-foreground ring-offset-2"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          form.setValue("avatar_color", color, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      >
                        <span className="sr-only">Use color {color}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" rows={4} {...form.register("bio")} />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={update.isPending}>
                    <SaveIcon className="size-4" />
                    Save profile
                  </Button>
                </div>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProfileLoading() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="h-8 w-44 rounded-md bg-muted" />
      <div className="h-48 rounded-lg border bg-muted/20" />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="h-64 rounded-lg border bg-muted/20" />
        <div className="h-64 rounded-lg border bg-muted/20" />
      </div>
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-16 rounded-md bg-muted/45 px-3 py-2 text-center">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpenCheckIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <Icon className="size-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ReadingLogRow({ log }: { log: ProfileReadingLog }) {
  const schedule = log.club_paper_schedule;

  return (
    <Link
      to="/app/papers/$scheduleId"
      params={{ scheduleId: schedule.id }}
      className="block py-3 transition-colors hover:bg-muted/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{schedule.papers.title}</p>
        <span className="text-xs text-muted-foreground">
          {new Date(log.read_at).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{schedule.clubs.name}</span>
        <span>{formatWeekLabel(schedule.week_start)}</span>
        <PaperAuthors authors={schedule.papers.authors} />
      </div>
    </Link>
  );
}

function PaperAuthors({ authors }: { authors: Json | null }) {
  const label = formatAuthors(authors);

  if (!label) {
    return null;
  }

  return <span>{label}</span>;
}

function ContributionGraph({ cells, label }: { cells: number[]; label: string }) {
  return (
    <div className="max-w-full overflow-hidden rounded-md bg-muted/35 p-2.5 sm:p-3">
      <div
        className="grid w-full gap-px [grid-template-columns:repeat(49,minmax(0,1fr))] sm:gap-[3px]"
        aria-label={label}
      >
        {cells.map((level, index) => (
          <span
            key={index}
            className="aspect-square rounded-[2px]"
            style={{ backgroundColor: contributionColor(level) }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 overflow-hidden text-[11px] leading-3 text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: contributionColor(level) }}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function buildProfileActivity(overview: ProfileOverview) {
  const currentWeekStart = getCurrentWeekStart();
  const readScheduleIds = new Set(overview.readingLogs.map((log) => log.schedule_id));
  const unreadSchedules = overview.scheduledPapers.filter(
    (schedule) => !readScheduleIds.has(schedule.id),
  );
  const readingCount = unreadSchedules.filter(
    (schedule) => schedule.week_start <= currentWeekStart,
  ).length;
  const plannedCount = unreadSchedules.length - readingCount;

  return {
    readCount: overview.readingLogs.length,
    readingCount,
    plannedCount,
    contributionCells: buildContributionCells(overview.readingLogs),
  };
}

function buildContributionCells(logs: ProfileReadingLog[]) {
  const days = 49 * 7;
  const end = startOfUtcDay(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const readsByDay = new Map<string, number>();

  for (const log of logs) {
    const date = new Date(log.read_at);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid read timestamp "${log.read_at}".`);
    }

    const key = toDateInputValue(date);
    readsByDay.set(key, (readsByDay.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const week = index % 49;
    const day = Math.floor(index / 49);
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * 7 + day);

    return contributionLevel(readsByDay.get(toDateInputValue(date)) ?? 0);
  });
}

function contributionLevel(count: number) {
  if (count >= 4) {
    return 4;
  }

  return count;
}

function contributionColor(level: number) {
  if (level === 0) {
    return "var(--muted)";
  }

  if (level === 1) {
    return "oklch(0.82 0.12 145)";
  }

  if (level === 2) {
    return "oklch(0.68 0.16 145)";
  }

  if (level === 3) {
    return "oklch(0.54 0.17 145)";
  }

  return "oklch(0.42 0.15 145)";
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatAuthors(authors: Json | null) {
  if (!authors) {
    return null;
  }

  if (!Array.isArray(authors)) {
    throw new Error("Paper authors must be an array.");
  }

  const names = authors.map((author) => {
    if (typeof author !== "string") {
      throw new Error("Paper authors must be strings.");
    }

    return author;
  });

  return names.slice(0, 3).join(", ");
}
