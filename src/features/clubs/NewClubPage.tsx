import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createClub } from "@/features/clubs/api";
import { clubFormSchema, type ClubFormValues } from "@/features/clubs/schemas";
import { queryKeys } from "@/lib/queryKeys";
import { getUserFacingError } from "@/lib/user-facing-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewClubPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<ClubFormValues>({
    resolver: zodResolver(clubFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });
  const create = useMutation({
    mutationFn: (values: ClubFormValues) =>
      createClub({
        name: values.name,
        description: values.description?.trim() || null,
      }),
    onSuccess: async (club) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all });
      toast.success("Club created");
      await navigate({
        to: "/app/clubs/$clubId/schedule",
        params: { clubId: club.id },
      });
    },
    onError: (error) => {
      const userError = getUserFacingError(
        error,
        "create-club",
        "Could not create the club. Please try again.",
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
    <section className="max-w-xl">
      <p className="text-sm font-medium text-muted-foreground">Create</p>
      <h1 className="mt-2 text-2xl font-semibold">New club</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={form.handleSubmit((values) => create.mutate(values))}
      >
        <div className="space-y-2">
          <Label htmlFor="club-name">Name</Label>
          <Input id="club-name" {...form.register("name")} />
          <FieldError message={form.formState.errors.name?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="club-description">Description</Label>
          <Textarea id="club-description" rows={4} {...form.register("description")} />
          <FieldError message={form.formState.errors.description?.message} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            Create club
          </Button>
        </div>
      </form>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}
