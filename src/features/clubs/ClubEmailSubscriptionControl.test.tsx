import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClubEmailSubscriptionControl } from "@/features/clubs/ClubEmailSubscriptionControl";

const testState = vi.hoisted(() => ({
  data: false,
  error: null as Error | null,
  isPending: false,
  mutationPending: false,
  mutationOptions: null as {
    onSuccess?: (enabled: boolean) => Promise<void>;
    onError?: (error: unknown) => void;
  } | null,
  mutate: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (
    options: NonNullable<typeof testState.mutationOptions>,
  ) => {
    testState.mutationOptions = options;
    return {
      isPending: testState.mutationPending,
      mutate: testState.mutate,
    };
  },
  useQuery: () => ({
    data: testState.data,
    error: testState.error,
    isPending: testState.isPending,
  }),
  useQueryClient: () => ({
    invalidateQueries: testState.invalidateQueries,
    setQueryData: testState.setQueryData,
  }),
}));

vi.mock("@/features/clubs/queries", () => ({
  clubEmailSubscriptionQueryOptions: () => ({
    queryKey: ["clubs", "club-1", "email-subscription", "user-1"],
  }),
}));

vi.mock("@/features/clubs/api", () => ({
  setClubEmailSubscription: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: testState.toastSuccess,
    error: testState.toastError,
  },
}));

describe("ClubEmailSubscriptionControl", () => {
  beforeEach(() => {
    testState.data = false;
    testState.error = null;
    testState.isPending = false;
    testState.mutationPending = false;
    testState.mutationOptions = null;
    testState.mutate.mockReset();
    testState.invalidateQueries.mockReset();
    testState.setQueryData.mockReset();
    testState.toastSuccess.mockReset();
    testState.toastError.mockReset();
  });

  it("enables updates from the unchecked state", () => {
    render(
      <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
    );

    const control = screen.getByRole("switch", { name: "Email updates" });
    expect(control).not.toBeChecked();

    fireEvent.click(control);
    expect(testState.mutate).toHaveBeenCalledWith(true);
  });

  it("disables updates from the checked state", () => {
    testState.data = true;

    render(
      <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
    );

    const control = screen.getByRole("switch", { name: "Email updates" });
    expect(control).toBeChecked();

    fireEvent.click(control);
    expect(testState.mutate).toHaveBeenCalledWith(false);
  });

  it.each(["query", "mutation"] as const)(
    "disables the control while the %s is pending",
    (pendingState) => {
      testState.isPending = pendingState === "query";
      testState.mutationPending = pendingState === "mutation";

      render(
        <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
      );

      expect(
        screen.getByRole("switch", { name: "Email updates" }),
      ).toBeDisabled();
    },
  );

  it("shows a safe unavailable state when the query fails", () => {
    testState.error = new Error("sensitive database details");

    render(
      <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Email updates unavailable",
    );
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("stores and refreshes successful changes with user feedback", async () => {
    render(
      <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
    );

    await testState.mutationOptions?.onSuccess?.(true);

    const queryKey = [
      "clubs",
      "club-1",
      "email-subscription",
      "user-1",
    ];
    expect(testState.setQueryData).toHaveBeenCalledWith(queryKey, true);
    expect(testState.invalidateQueries).toHaveBeenCalledWith({ queryKey });
    expect(testState.toastSuccess).toHaveBeenCalledWith(
      "Email updates enabled",
    );
  });

  it("shows a safe error without exposing backend details", () => {
    render(
      <ClubEmailSubscriptionControl clubId="club-1" userId="user-1" />,
    );

    testState.mutationOptions?.onError?.(
      new Error("private subscription table details"),
    );

    expect(testState.toastError).toHaveBeenCalledWith(
      "Could not update email notifications.",
    );
  });
});
