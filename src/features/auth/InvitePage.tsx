import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/features/auth/queries";
import { acceptInvite } from "@/features/clubs/api";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function InvitePage({ token }: { token: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const accept = useMutation({
    mutationFn: () => acceptInvite(supabase, token),
    onSuccess: async (membership) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all });
      toast.success("Joined club");
      await navigate({
        to: "/app/clubs/$clubId/schedule",
        params: { clubId: membership.club_id },
        replace: true,
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const { isError, isPending, isSuccess, mutate } = accept;

  useEffect(() => {
    if (currentUser.data && !isPending && !isSuccess && !isError) {
      mutate();
    }
  }, [currentUser.data, isError, isPending, isSuccess, mutate]);

  if (currentUser.isLoading) {
    return <InviteShell title="Checking session" body="Loading invite..." />;
  }

  if (!currentUser.data) {
    return (
      <InviteShell
        title="Join club"
        body="Sign in to accept this private club invite."
      >
        <Button asChild>
          <a href={`/sign-in?redirect=${encodeURIComponent(`/invites/${token}`)}`}>
            Sign in to accept
          </a>
        </Button>
      </InviteShell>
    );
  }

  return (
    <InviteShell
      title={accept.isError ? "Invite error" : "Joining club"}
      body={accept.isError ? accept.error.message : "Accepting invite..."}
    >
      {accept.isError ? (
        <Button
          type="button"
          variant="outline"
          disabled={accept.isPending}
          onClick={() => accept.mutate()}
        >
          Try again
        </Button>
      ) : null}
    </InviteShell>
  );
}

function InviteShell({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center p-6">
      <p className="text-sm font-medium text-muted-foreground">Invite</p>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </main>
  );
}
