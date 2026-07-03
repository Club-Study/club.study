import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilIcon, SaveIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
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
import { updateProfile, type Profile } from "@/features/profile/api";
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

export function ProfileEditDialog({
  open,
  onOpenChange,
  profile,
  userEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  userEmail: string | undefined;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ProfileFormValues>({
    values: {
      display_name: profile.display_name,
      avatar_id: profile.avatar_id,
      avatar_color: profile.avatar_color,
      bio: profile.bio ?? "",
    },
  });
  const avatarId = useWatch({ control: form.control, name: "avatar_id" });
  const avatarColor = useWatch({ control: form.control, name: "avatar_color" });
  const displayName = useWatch({ control: form.control, name: "display_name" });
  const update = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      const nextDisplayName = values.display_name.trim();

      if (!nextDisplayName) {
        throw new Error("Display name is required.");
      }

      return updateProfile(supabase, profile.id, {
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
      onOpenChange(false);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PencilIcon className="size-4" />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription className="sr-only">
            Update your display name, avatar, color, and bio.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
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
              <p className="text-sm text-muted-foreground">{userEmail}</p>
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
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              <SaveIcon className="size-4" />
              Save profile
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
