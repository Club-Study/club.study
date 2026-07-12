import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailIcon } from "lucide-react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setClubEmailSubscription } from "@/features/clubs/api";
import { clubEmailSubscriptionQueryOptions } from "@/features/clubs/queries";
import { queryKeys } from "@/lib/queryKeys";
import { toUserMessage } from "@/lib/user-facing-error";

export function ClubEmailSubscriptionControl({
  clubId,
  userId,
}: {
  clubId: string;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.clubs.emailSubscription(clubId, userId);
  const subscription = useQuery(
    clubEmailSubscriptionQueryOptions(clubId, userId),
  );
  const updateSubscription = useMutation({
    mutationFn: (enabled: boolean) =>
      setClubEmailSubscription({ clubId, userId, enabled }),
    onSuccess: async (enabled) => {
      queryClient.setQueryData(queryKey, enabled);
      await queryClient.invalidateQueries({ queryKey });
      toast.success(enabled ? "Email updates enabled" : "Email updates disabled");
    },
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          "club-email-subscription",
          "Could not update email notifications.",
        ),
      ),
  });
  const controlId = `club-email-updates-${clubId}`;
  const isDisabled = subscription.isPending || updateSubscription.isPending;

  if (subscription.error) {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Email updates unavailable
      </p>
    );
  }

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 rounded-md border bg-background/40 px-2.5">
      <MailIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <Label htmlFor={controlId} className="text-xs font-normal">
        Email updates
      </Label>
      <Switch
        id={controlId}
        size="sm"
        checked={subscription.data ?? false}
        disabled={isDisabled}
        aria-label="Email updates"
        onCheckedChange={(enabled) => updateSubscription.mutate(enabled)}
      />
    </div>
  );
}
