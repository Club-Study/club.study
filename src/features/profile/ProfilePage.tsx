import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import {
  getPixelAvatarLabel,
  pixelAvatarColors,
  pixelAvatarIds,
} from "@/lib/pixel-avatars";
import { useCurrentUser } from "@/features/auth/queries";
import { updateProfile, type Profile } from "@/features/profile/api";
import { profileQueryOptions } from "@/features/profile/queries";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProfileFormValues = Pick<
  Profile,
  "display_name" | "avatar_id" | "avatar_color" | "bio"
>;

export function ProfilePage() {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const profile = useQuery({
    ...profileQueryOptions(supabase, user.data?.id ?? ""),
    enabled: Boolean(user.data?.id),
  });
  const form = useForm<ProfileFormValues>({
    values: {
      display_name: profile.data?.display_name ?? "",
      avatar_id: profile.data?.avatar_id ?? "bookworm",
      avatar_color: profile.data?.avatar_color ?? "#65a30d",
      bio: profile.data?.bio ?? "",
    },
  });
  const avatarId = useWatch({ control: form.control, name: "avatar_id" });
  const avatarColor = useWatch({ control: form.control, name: "avatar_color" });
  const displayName = useWatch({ control: form.control, name: "display_name" });
  const update = useMutation({
    mutationFn: (values: ProfileFormValues) => {
      if (!user.data) {
        throw new Error("Sign in required.");
      }
      const displayName = values.display_name.trim();

      if (!displayName) {
        throw new Error("Display name is required.");
      }

      return updateProfile(supabase, user.data.id, {
        display_name: displayName,
        avatar_id: values.avatar_id,
        avatar_color: values.avatar_color,
        bio: values.bio?.trim() || null,
      });
    },
    onSuccess: async (nextProfile) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profile.current(nextProfile.id),
      });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="max-w-xl">
      <p className="text-sm font-medium text-muted-foreground">Account</p>
      <h1 className="mt-2 text-2xl font-semibold">Profile</h1>
      <div className="mt-6 flex items-center gap-3">
        <PixelAvatar
          avatarId={avatarId}
          color={avatarColor}
          label={displayName}
          className="size-12"
        />
        <div>
          <p className="text-sm font-medium">{profile.data?.display_name}</p>
          <p className="text-sm text-muted-foreground">{user.data?.email}</p>
        </div>
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={form.handleSubmit((values) => update.mutate(values))}
      >
        <div className="space-y-2">
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" {...form.register("display_name", { required: true })} />
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
                  avatarColor === color ? "ring-2 ring-foreground ring-offset-2" : ""
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
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
}
