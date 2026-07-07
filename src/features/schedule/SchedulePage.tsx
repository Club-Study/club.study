import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquareIcon } from "lucide-react";

import { useCurrentUser } from "@/features/auth/queries";
import { isClubManagerRole } from "@/features/clubs/api";
import { membersQueryOptions } from "@/features/clubs/queries";
import { ProfileLink } from "@/features/profile/components/ProfileLink";
import { AddPaperDialog } from "@/features/schedule/components/AddPaperDialog";
import { SchedulePaperActions } from "@/features/schedule/components/SchedulePaperActions";
import {
  scheduleListQueryOptions,
  scheduleProgressQueryOptions,
} from "@/features/schedule/queries";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatOptionalDateLabel } from "@/lib/dates/week";

export function SchedulePage({ clubId }: { clubId: string }) {
  const currentUser = useCurrentUser();
  const members = useQuery(membersQueryOptions(clubId));
  const schedule = useQuery(scheduleListQueryOptions(clubId));
  const progress = useQuery(scheduleProgressQueryOptions(clubId));
  const currentMembership = members.data?.find(
    (member) => member.user_id === currentUser.data?.id,
  );
  const isManager = isClubManagerRole(currentMembership?.role);
  const progressBySchedule = new Map(
    (progress.data ?? []).map((row) => [row.schedule_id, row]),
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Papers in this club. Deadlines are optional.
          </p>
        </div>
        <AddPaperDialog clubId={clubId} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deadline</TableHead>
            <TableHead>Paper</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(schedule.data ?? []).map((row) => {
            const rowProgress = progressBySchedule.get(row.id);
            return (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {formatOptionalDateLabel(row.week_start)}
                </TableCell>
                <TableCell className="max-w-[420px]">
                  <Link
                    to="/app/papers/$scheduleId"
                    params={{ scheduleId: row.id }}
                    className="font-medium hover:underline"
                  >
                    {row.papers?.title ?? "Untitled paper"}
                  </Link>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="outline">{row.papers?.source_type}</Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      Suggested by{" "}
                      <ProfileLink
                        userId={row.suggested_by?.id}
                        className="hover:underline"
                      >
                        {row.suggested_by?.display_name ?? "Unknown"}
                      </ProfileLink>
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {rowProgress ? (
                    <span className="text-sm text-muted-foreground">
                      {rowProgress.read_count}/{rowProgress.total_members} read
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {isManager ? (
                      <SchedulePaperActions schedule={row} />
                    ) : (
                      <MessageSquareIcon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {schedule.data?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                No papers scheduled yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  );
}
