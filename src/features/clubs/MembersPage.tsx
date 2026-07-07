import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CopyIcon,
  CrownIcon,
  LinkIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import { useCurrentUser } from "@/features/auth/queries";
import {
  createInviteLink,
  isClubManagerRole,
  leaveClub,
  revokeInviteLink,
  setClubMemberRole,
  transferClubOwnership,
  type ClubMember,
  type ClubRole,
} from "@/features/clubs/api";
import {
  invitesQueryOptions,
  membersQueryOptions,
} from "@/features/clubs/queries";
import { buildAppUrl } from "@/lib/appUrl";
import { queryKeys } from "@/lib/queryKeys";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const members = useQuery(membersQueryOptions(clubId));
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const currentMembership = members.data?.find(
    (member) => member.user_id === currentUser.data?.id,
  );
  const isOwner = currentMembership?.role === "owner";
  const isManager = isClubManagerRole(currentMembership?.role);
  const isLastMember = members.data?.length === 1;
  const invites = useQuery({
    ...invitesQueryOptions(clubId),
    enabled: isManager,
  });
  const pendingInvite = invites.data?.find((invite) => invite.status === "pending");
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
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<ClubRole, "owner"> }) =>
      setClubMemberRole({ clubId, userId, role }),
    onSuccess: async () => {
      await invalidateMemberState(queryClient, clubId);
      toast.success("Role updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const transferOwnership = useMutation({
    mutationFn: (newOwnerId: string) =>
      transferClubOwnership({ clubId, newOwnerId }),
    onSuccess: async () => {
      await invalidateMemberState(queryClient, clubId);
      toast.success("Ownership transferred");
    },
    onError: (error) => toast.error(error.message),
  });
  const leave = useMutation({
    mutationFn: () => leaveClub(clubId),
    onSuccess: async (result) => {
      setLeaveOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.clubs.detail(result.club_id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.clubs.members(result.club_id),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.root,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.dashboardRoot,
        }),
      ]);
      toast.success(result.deleted_club ? "Club deleted" : "Club left");
      await navigate({ to: "/app/clubs" });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Owners and admins can manage club access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && pendingInvite ? (
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
          {isManager ? (
            <Button
              type="button"
              size="sm"
              disabled={createInvite.isPending}
              onClick={() => createInvite.mutate()}
            >
              <LinkIcon className="size-4" />
              Create invite
            </Button>
          ) : null}
          {currentMembership ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOutIcon className="size-4" />
              Leave club
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isLastMember ? "Delete this club?" : "Leave this club?"}
            </DialogTitle>
            <DialogDescription>
              {isLastMember
                ? "You are the last member. Leaving will delete the club."
                : isOwner
                  ? "Transfer ownership before leaving this club."
                  : "You will lose access to this club."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isLastMember ? "destructive" : "default"}
              disabled={leave.isPending || (isOwner && !isLastMember)}
              onClick={() => leave.mutate()}
            >
              <LogOutIcon aria-hidden="true" />
              {isLastMember ? "Delete club" : "Leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isManager && pendingInvite ? (
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
            <TableHead className="w-10"></TableHead>
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
                <Badge variant={roleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  {isManager && member.role !== "owner" ? (
                    <MemberRoleActions
                      member={member}
                      canTransferOwnership={
                        isOwner && member.user_id !== currentUser.data?.id
                      }
                      isPending={updateRole.isPending || transferOwnership.isPending}
                      onSetRole={(role) =>
                        updateRole.mutate({ userId: member.user_id, role })
                      }
                      onTransferOwnership={() =>
                        transferOwnership.mutate(member.user_id)
                      }
                    />
                  ) : null}
                </div>
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

function MemberRoleActions({
  member,
  canTransferOwnership,
  isPending,
  onSetRole,
  onTransferOwnership,
}: {
  member: ClubMember;
  canTransferOwnership: boolean;
  isPending: boolean;
  onSetRole: (role: Exclude<ClubRole, "owner">) => void;
  onTransferOwnership: () => void;
}) {
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" disabled={isPending}>
            <MoreHorizontalIcon aria-hidden="true" />
            <span className="sr-only">Member actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {member.role !== "admin" ? (
            <DropdownMenuItem onSelect={() => onSetRole("admin")}>
              <ShieldCheckIcon aria-hidden="true" />
              Make admin
            </DropdownMenuItem>
          ) : null}
          {member.role !== "member" ? (
            <DropdownMenuItem onSelect={() => onSetRole("member")}>
              <UserIcon aria-hidden="true" />
              Make member
            </DropdownMenuItem>
          ) : null}
          {canTransferOwnership ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setTransferOpen(true);
                }}
              >
                <CrownIcon aria-hidden="true" />
                Transfer ownership
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer ownership?</DialogTitle>
            <DialogDescription>
              This member becomes the club owner and you become an admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => {
                onTransferOwnership();
                setTransferOpen(false);
              }}
            >
              <CrownIcon aria-hidden="true" />
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function roleBadgeVariant(role: ClubRole) {
  if (role === "owner") {
    return "default";
  }

  if (role === "admin") {
    return "outline";
  }

  return "secondary";
}

async function invalidateMemberState(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.clubs.members(clubId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.profile.root,
    }),
  ]);
}
