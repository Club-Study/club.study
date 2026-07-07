import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  MoreHorizontalIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteScheduledPaper,
  updateScheduledPaperDeadline,
  type ScheduleWithPaper,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";

export function SchedulePaperActions({
  schedule,
  onDeleted,
}: {
  schedule: ScheduleWithPaper;
  onDeleted?: (clubId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deadline, setDeadline] = useState(schedule.week_start ?? "");
  const updateDeadline = useMutation({
    mutationFn: () =>
      updateScheduledPaperDeadline({
        scheduleId: schedule.id,
        deadline: deadline || null,
      }),
    onSuccess: async (nextSchedule) => {
      await invalidateScheduleQueries(queryClient, nextSchedule.club_id, nextSchedule.id);
      setEditOpen(false);
      toast.success("Deadline updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteScheduledPaper(schedule.id),
    onSuccess: async (deletedSchedule) => {
      await invalidateScheduleQueries(
        queryClient,
        deletedSchedule.club_id,
        deletedSchedule.id,
      );
      setDeleteOpen(false);
      toast.success("Paper removed");
      onDeleted?.(deletedSchedule.club_id);
    },
    onError: (error) => toast.error(error.message),
  });

  function openEditDialog(nextOpen: boolean) {
    setEditOpen(nextOpen);
    if (nextOpen) {
      setDeadline(schedule.week_start ?? "");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm">
            <MoreHorizontalIcon aria-hidden="true" />
            <span className="sr-only">Schedule actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              openEditDialog(true);
            }}
          >
            <CalendarIcon aria-hidden="true" />
            Edit deadline
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2Icon aria-hidden="true" />
            Delete paper
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={openEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deadline</DialogTitle>
            <DialogDescription className="sr-only">
              Update or clear this scheduled paper deadline.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              updateDeadline.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor={`schedule-deadline-${schedule.id}`}>Deadline</Label>
              <Input
                id={`schedule-deadline-${schedule.id}`}
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeadline("")}
              >
                Clear
              </Button>
              <Button type="submit" disabled={updateDeadline.isPending}>
                <SaveIcon aria-hidden="true" />
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete paper?</DialogTitle>
            <DialogDescription>
              This removes the paper from the club schedule.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              <Trash2Icon aria-hidden="true" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function invalidateScheduleQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string,
  scheduleId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.list(clubId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.detail(clubId, scheduleId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.detailById(scheduleId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.progress(clubId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.dashboardRoot,
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.profile.root,
    }),
  ]);
}
