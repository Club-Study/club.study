import { SafeUserError } from "@/lib/user-facing-error";

type FunctionHttpErrorLike = Error & {
  context?: unknown;
};

export async function functionInvocationError(
  error: unknown,
  fallbackMessage: string,
) {
  const response = responseContext(error);

  if (response) {
    const message = await responseErrorMessage(response);
    return new SafeUserError(message ?? fallbackMessage, { cause: error });
  }

  return new Error(fallbackMessage, { cause: error });
}

function responseContext(error: unknown) {
  if (!(error instanceof Error) || !("context" in error)) {
    return null;
  }

  const context = (error as FunctionHttpErrorLike).context;
  return context instanceof Response ? context : null;
}

async function responseErrorMessage(response: Response) {
  switch (response.status) {
    case 400:
      return "Check the arXiv URL or request and try again.";
    case 401:
      return "Sign in and try again.";
    case 403:
      return "This request is not allowed.";
    case 408:
      return "The request timed out. Try again.";
    case 404:
      return "No arXiv paper was found for that ID.";
    case 409:
      return "That paper already exists.";
    case 413:
      return "The request is too large.";
    case 415:
      return "The request format is not supported.";
    case 429:
      return "Too many arXiv requests. Try again in a few minutes.";
    default:
      return null;
  }
}
