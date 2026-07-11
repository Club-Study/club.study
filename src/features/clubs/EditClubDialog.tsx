import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateClub, type Club } from "@/features/clubs/api";
import { clubFormSchema, type ClubFormValues } from "@/features/clubs/schemas";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingError } from "@/lib/user-facing-error";

export function EditClubDialog({ club }: { club: Club }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<ClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    values: {
      name: club.name,
      description: club.description ?? "",
    },
  });
  const update = useMutation({
    mutationFn: (values: ClubFormValues) =>
      updateClub({
        clubId: club.id,
        name: values.name,
        description: values.description?.trim() || null,
      }),
    onSuccess: async (nextClub) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.clubs.detail(nextClub.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all }),
      ]);
      setOpen(false);
      toast.success("Club updated");
    },
    onError: (error) => {
      const userError = getUserFacingError(
        error,
        "update-club",
        "Could not update the club. Please try again.",
      );

      if (userError.kind === "club-name-conflict") {
        form.setError(
          "name",
          { type: "server", message: userError.message },
          { shouldFocus: true },
        );
        return;
      }

      toast.error(userError.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PencilIcon aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Club details</DialogTitle>
          <DialogDescription className="sr-only">
            Update the club name and description.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => update.mutate(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-club-name">Name</Label>
            <Input id="edit-club-name" {...form.register("name")} />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-club-description">Description</Label>
            <Textarea
              id="edit-club-description"
              rows={4}
              {...form.register("description")}
            />
            <FieldError message={form.formState.errors.description?.message} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              <SaveIcon aria-hidden="true" />
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
