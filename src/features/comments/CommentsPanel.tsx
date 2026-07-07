import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import {
  createComment,
  softDeleteComment,
  updateCommentBody,
  type CommentRow,
} from "@/features/comments/api";
import { commentsQueryOptions } from "@/features/comments/queries";
import { useCurrentUser } from "@/features/auth/queries";
import { isClubManagerRole } from "@/features/clubs/api";
import { membersQueryOptions } from "@/features/clubs/queries";
import { ProfileLink } from "@/features/profile/components/ProfileLink";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { KatexText } from "@/components/katex-text";

export function CommentsPanel({
  scheduleId,
  clubId,
}: {
  scheduleId: string;
  clubId: string;
}) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const comments = useQuery(commentsQueryOptions(scheduleId));
  const members = useQuery(membersQueryOptions(clubId));
  const currentMembership = members.data?.find(
    (member) => member.user_id === user.data?.id,
  );
  const isManager = isClubManagerRole(currentMembership?.role);
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () => {
      if (!user.data) {
        throw new Error("Sign in required.");
      }

      return createComment({
        scheduleId,
        body: body.trim(),
      });
    },
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(scheduleId),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Comments</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Discussion is scoped to this scheduled paper.
        </p>
      </div>
      <div className="space-y-3">
        {(comments.data ?? []).map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canEdit={comment.author_id === user.data?.id}
            canDelete={comment.author_id === user.data?.id || isManager}
            scheduleId={scheduleId}
          />
        ))}
        {comments.data?.length === 0 ? (
          <p className="rounded-lg border p-3 text-sm text-muted-foreground">
            No comments yet.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Textarea
          rows={4}
          value={body}
          placeholder="Add a comment"
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={create.isPending || !body.trim()}
            onClick={() => create.mutate()}
          >
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  scheduleId,
}: {
  comment: CommentRow;
  canEdit: boolean;
  canDelete: boolean;
  scheduleId: string;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const update = useMutation({
    mutationFn: () => updateCommentBody(comment.id, draft.trim()),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(scheduleId),
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => softDeleteComment(comment.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.comments.list(scheduleId),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <article className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <ProfileLink
          userId={comment.author_id}
          className="flex min-w-0 items-center gap-2 rounded-md hover:underline"
        >
          <PixelAvatar
            avatarId={comment.profiles?.avatar_id}
            color={comment.profiles?.avatar_color}
            label={comment.profiles?.display_name}
            className="size-7"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {comment.profiles?.display_name ?? "Reader"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(comment.created_at).toLocaleString()}
            </p>
          </div>
        </ProfileLink>
        {canEdit || canDelete ? (
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={update.isPending || !draft.trim()}
                  onClick={() => update.mutate()}
                >
                  <CheckIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(false);
                  }}
                >
                  <XIcon className="size-4" />
                </Button>
              </>
            ) : (
              <>
                {canEdit ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate()}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
      {editing ? (
        <Textarea
          className="mt-3"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <KatexText text={comment.body} className="mt-3 text-sm leading-6" />
      )}
    </article>
  );
}
