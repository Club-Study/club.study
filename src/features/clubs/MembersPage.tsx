import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, LinkIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import { useCurrentUser } from "@/features/auth/queries";
import { createInviteLink, revokeInviteLink } from "@/features/clubs/api";
import {
  invitesQueryOptions,
  membersQueryOptions,
} from "@/features/clubs/queries";
import { buildAppUrl } from "@/lib/appUrl";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function MembersPage({ clubId }: { clubId: string }) {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const members = useQuery(membersQueryOptions(clubId));
  const invites = useQuery(invitesQueryOptions(clubId));
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const pendingInvite = invites.data?.find((invite) => invite.status === "pending");
  const currentMembership = members.data?.find(
    (member) => member.user_id === currentUser.data?.id,
  );
  const isOwner = currentMembership?.role === "owner";
  const createInvite = useMutation({
    mutationFn: () => createInviteLink(clubId),
    onSuccess: async (invite) => {
      const inviteUrl = buildInviteUrl(invite.token);
      setLastInviteUrl(inviteUrl);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clubs.invites(clubId),
      });
      try {
        await copyToClipboard(inviteUrl);
        toast.success("Invite link copied");
      } catch {
        toast.success("Invite link created");
        toast.info("Copy the link from the invite field.");
      }
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => revokeInviteLink(inviteId),
    onSuccess: async () => {
      setLastInviteUrl(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clubs.invites(clubId),
      });
      toast.success("Invite revoked");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Owner and member roles only for MVP.
          </p>
        </div>
        {isOwner ? (
          <div className="flex gap-2">
            {pendingInvite ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revokeInvite.isPending}
                onClick={() => revokeInvite.mutate(pendingInvite.id)}
              >
                <RotateCcwIcon className="size-4" />
                Revoke invite
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={createInvite.isPending}
              onClick={() => createInvite.mutate()}
            >
              <LinkIcon className="size-4" />
              Create invite
            </Button>
          </div>
        ) : null}
      </div>

      {isOwner && pendingInvite ? (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          {lastInviteUrl ? (
            <div className="flex gap-2">
              <Input readOnly value={lastInviteUrl} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  copyToClipboard(lastInviteUrl)
                    .then(() => toast.success("Invite link copied"))
                    .catch(() => toast.error("Could not copy invite link"))
                }
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Pending invite expires{" "}
              {pendingInvite.expires_at
                ? new Date(pendingInvite.expires_at).toLocaleDateString()
                : "never"}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info("Create a new invite to copy a fresh token.")
              }
            >
              <CopyIcon className="size-4" />
              Token hidden
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(members.data ?? []).map((member) => (
            <TableRow key={`${member.club_id}-${member.user_id}`}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <PixelAvatar
                    avatarId={member.profiles?.avatar_id}
                    color={member.profiles?.avatar_color}
                    label={member.profiles?.display_name}
                    className="size-7"
                  />
                  <span className="font-medium">
                    {member.profiles?.display_name ?? "Member"}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                  {member.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function buildInviteUrl(token: string) {
  return buildAppUrl(`/invites/${token}`);
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}
