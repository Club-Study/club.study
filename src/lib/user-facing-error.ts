export type UserFacingErrorKind =
  | "club-name-conflict"
  | "duplicate-schedule"
  | "duplicate-personal-paper"
  | "conflict"
  | "invalid-input"
  | "forbidden"
  | "unauthenticated"
  | "not-found"
  | "network"
  | "unknown";

export type UserFacingErrorOperation =
  | "generic"
  | "auth"
  | "create-club"
  | "update-club"
  | "invite"
  | "club-application"
  | "club-application-review"
  | "member-management"
  | "schedule-paper"
  | "add-personal-paper"
  | "lookup-paper"
  | "reading-progress"
  | "profile"
  | "comment"
  | "annotation";

export type UserFacingError = {
  kind: UserFacingErrorKind;
  message: string;
};

export class SafeUserError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SafeUserError";
  }
}

export function getUserFacingError(
  error: unknown,
  operation: UserFacingErrorOperation = "generic",
  fallbackMessage = "Something went wrong. Please try again.",
): UserFacingError {
  if (error instanceof SafeUserError) {
    return { kind: "invalid-input", message: error.message };
  }

  const record = errorRecord(error);
  const code = stringValue(record?.code).toUpperCase();
  const name = stringValue(record?.name).toLowerCase();
  const message = stringValue(record?.message).toLowerCase();
  const status = numberValue(record?.status);

  if (
    error instanceof TypeError &&
    /fetch|network|offline|connection/.test(message)
  ) {
    return {
      kind: "network",
      message: "Could not reach the server. Check your connection and try again.",
    };
  }

  if (
    status === 401 ||
    ["BAD_JWT", "INVALID_JWT", "REFRESH_TOKEN_NOT_FOUND", "SESSION_NOT_FOUND"].includes(
      code,
    ) ||
    /jwt.*expired|not authenticated|sign in required|session.*expired/.test(message)
  ) {
    return {
      kind: "unauthenticated",
      message: "Your session has expired. Sign in and try again.",
    };
  }

  if (
    status === 403 ||
    code === "42501" ||
    /row-level security|permission denied|not authorized|only club (?:owners|admins|members)/.test(
      message,
    )
  ) {
    return {
      kind: "forbidden",
      message: "You do not have permission to do that.",
    };
  }

  if (
    status === 404 ||
    code === "PGRST116" ||
    /\bnot found\b/.test(message)
  ) {
    return { kind: "not-found", message: "That item could not be found." };
  }

  if (
    operation === "club-application" &&
    /application already pending/.test(message)
  ) {
    return conflictForOperation(operation);
  }

  if (
    operation === "club-application-review" &&
    /request is no longer pending/.test(message)
  ) {
    return conflictForOperation(operation);
  }

  if (code === "23505" || /already (?:exists|a member)/.test(message)) {
    return conflictForOperation(operation);
  }

  if (
    ["22001", "22007", "22P02", "23502", "23503", "23514", "PGRST100", "PGRST102"].includes(
      code,
    ) ||
    name === "zoderror"
  ) {
    return {
      kind: "invalid-input",
      message: "Check the entered values and try again.",
    };
  }

  return { kind: "unknown", message: fallbackMessage };
}

export function toUserMessage(
  error: unknown,
  operation: UserFacingErrorOperation = "generic",
  fallbackMessage?: string,
) {
  return getUserFacingError(error, operation, fallbackMessage).message;
}

function conflictForOperation(
  operation: UserFacingErrorOperation,
): UserFacingError {
  if (operation === "create-club" || operation === "update-club") {
    return {
      kind: "club-name-conflict",
      message: "A club with this name already exists.",
    };
  }

  if (operation === "schedule-paper") {
    return {
      kind: "duplicate-schedule",
      message: "This paper is already scheduled for that deadline.",
    };
  }

  if (operation === "add-personal-paper") {
    return {
      kind: "duplicate-personal-paper",
      message: "This paper is already in your papers.",
    };
  }

  if (operation === "club-application") {
    return {
      kind: "conflict",
      message: "You already have a pending application for this club.",
    };
  }

  if (operation === "club-application-review") {
    return {
      kind: "conflict",
      message: "This application has already been reviewed.",
    };
  }

  return { kind: "conflict", message: "That item already exists." };
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && /^\d{3}$/.test(value)) {
    return Number(value);
  }

  return null;
}
