import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  CopyIcon,
  CrownIcon,
  LinkIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import { QueryErrorNotice } from "@/components/query-error-notice";
import { useCurrentUser } from "@/features/auth/queries";
import { ProfileLink } from "@/features/profile/components/ProfileLink";
import {
  createInviteLink,
  isClubManagerRole,
  leaveClub,
  reviewClubJoinRequest,
  revokeInviteLink,
  setClubMemberRole,
  transferClubOwnership,
  type ClubMember,
  type ClubJoinRequestDecision,
  type ClubJoinRequestListItem,
  type ClubRole,
} from "@/features/clubs/api";
import {
  invitesQueryOptions,
  joinRequestsQueryOptions,
  membersQueryOptions,
} from "@/features/clubs/queries";
import { buildAppUrl } from "@/lib/appUrl";
import { queryKeys } from "@/lib/queryKeys";
import { toUserMessage } from "@/lib/user-facing-error";
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
  const applications = useQuery({
    ...joinRequestsQueryOptions(clubId),
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
    onError: (error) =>
      toast.error(
        toUserMessage(error, "invite", "Could not create an invite link."),
      ),
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
    onError: (error) =>
      toast.error(
        toUserMessage(error, "invite", "Could not revoke the invite link."),
      ),
  });
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Exclude<ClubRole, "owner"> }) =>
      setClubMemberRole({ clubId, userId, role }),
    onSuccess: async () => {
      await invalidateMemberState(queryClient, clubId);
      toast.success("Role updated");
    },
    onError: (error) =>
      toast.error(
        toUserMessage(error, "member-management", "Could not update the role."),
      ),
  });
  const transferOwnership = useMutation({
    mutationFn: (newOwnerId: string) =>
      transferClubOwnership({ clubId, newOwnerId }),
    onSuccess: async () => {
      await invalidateMemberState(queryClient, clubId);
      toast.success("Ownership transferred");
    },
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          "member-management",
          "Could not transfer ownership.",
        ),
      ),
  });
  const reviewApplication = useMutation({
    mutationFn: ({
      requestId,
      decision,
    }: {
      requestId: string;
      decision: ClubJoinRequestDecision;
    }) => reviewClubJoinRequest({ requestId, decision }),
    onSuccess: async (request) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.clubs.applications(clubId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.clubs.members(clubId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clubs.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.progress(clubId),
        }),
      ]);
      toast.success(
        request.status === "approved"
          ? "Application approved"
          : "Application rejected",
      );
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clubs.applications(clubId),
      });
      toast.error(
        toUserMessage(
          error,
          "club-application-review",
          "Could not review the application.",
        ),
      );
    },
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
    onError: (error) =>
      toast.error(
        toUserMessage(error, "member-management", "Could not leave the club."),
      ),
  });

  const queryError =
    members.error ?? currentUser.error ?? invites.error ?? applications.error;
  if (queryError) {
    return (
      <QueryErrorNotice
        error={queryError}
        fallbackMessage="Could not load club members. Please try again."
      />
    );
  }

  return (
    <section className="min-w-0 space-y-6">
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

      {isManager ? (
        <JoinApplicationsSection
          applications={applications.data ?? []}
          isPending={reviewApplication.isPending}
          onReview={(requestId, decision) =>
            reviewApplication.mutate({ requestId, decision })
          }
        />
      ) : null}

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead className="w-20 overflow-hidden text-ellipsis">
              Role
            </TableHead>
            <TableHead className="w-24 overflow-hidden text-ellipsis">
              Joined
            </TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(members.data ?? []).map((member) => (
            <TableRow key={`${member.club_id}-${member.user_id}`}>
              <TableCell className="min-w-0 overflow-hidden">
                <ProfileLink
                  userId={member.user_id}
                  className="flex min-w-0 max-w-full items-center gap-2 rounded-md hover:underline"
                >
                  <PixelAvatar
                    avatarId={member.profiles?.avatar_id}
                    color={member.profiles?.avatar_color}
                    label={member.profiles?.display_name}
                    className="size-7 shrink-0"
                  />
                  <span
                    className="min-w-0 truncate font-medium"
                    title={member.profiles?.display_name ?? "Member"}
                  >
                    {member.profiles?.display_name ?? "Member"}
                  </span>
                </ProfileLink>
              </TableCell>
              <TableCell className="w-20 overflow-hidden text-ellipsis">
                <Badge variant={roleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
              </TableCell>
              <TableCell className="w-24 overflow-hidden text-ellipsis text-muted-foreground">
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

function JoinApplicationsSection({
  applications,
  isPending,
  onReview,
}: {
  applications: ClubJoinRequestListItem[];
  isPending: boolean;
  onReview: (requestId: string, decision: ClubJoinRequestDecision) => void;
}) {
  return (
    <section className="min-w-0 space-y-3" aria-labelledby="applications-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="applications-title" className="text-sm font-medium">
            Applications
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve people before they can access club content.
          </p>
        </div>
        {applications.length ? (
          <Badge variant="secondary">
            {applications.length} pending
          </Badge>
        ) : null}
      </div>

      {applications.length ? (
        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
          {applications.map((application) => (
            <article
              key={application.request_id}
              className="flex min-w-0 flex-col rounded-lg border bg-muted/15 p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <PixelAvatar
                  avatarId={application.avatar_id}
                  color={application.avatar_color}
                  label={application.display_name}
                  className="size-9 shrink-0"
                />
                <div className="min-w-0">
                  <h3
                    className="truncate text-sm font-medium"
                    title={application.display_name}
                  >
                    {application.display_name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Applied {new Date(application.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <p className="mt-3 line-clamp-3 min-h-10 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                {application.bio?.trim() || "No bio provided."}
              </p>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  aria-label={`Reject ${application.display_name}`}
                  onClick={() => onReview(application.request_id, "rejected")}
                >
                  <XIcon aria-hidden="true" className="size-4" />
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  aria-label={`Approve ${application.display_name}`}
                  onClick={() => onReview(application.request_id, "approved")}
                >
                  <CheckIcon aria-hidden="true" className="size-4" />
                  Approve
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
          No pending applications.
        </p>
      )}
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
