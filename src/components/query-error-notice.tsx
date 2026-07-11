import { toUserMessage, type UserFacingErrorOperation } from "@/lib/user-facing-error";

export function QueryErrorNotice({
  error,
  operation = "generic",
  fallbackMessage,
}: {
  error: unknown;
  operation?: UserFacingErrorOperation;
  fallbackMessage: string;
}) {
  return (
    <div role="alert" className="rounded-md border border-destructive/30 p-4">
      <p className="text-sm text-destructive">
        {toUserMessage(error, operation, fallbackMessage)}
      </p>
    </div>
  );
}
