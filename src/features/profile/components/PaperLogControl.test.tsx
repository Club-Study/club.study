import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PaperLogControl } from "@/features/profile/components/PaperLogControl";

const api = vi.hoisted(() => ({
  savePersonalReadingProgress: vi.fn(),
  saveScheduleReadingProgress: vi.fn(),
}));

vi.mock("@/components/log-reading-session-dialog", () => ({
  LogReadingSessionDialog: ({
    onSave,
  }: {
    onSave: (values: {
      currentPage: number;
      totalPages: number;
      status: "reading";
    }) => Promise<unknown>;
  }) => (
    <button
      type="button"
      onClick={() =>
        void onSave({ currentPage: 5, totalPages: 10, status: "reading" })
      }
    >
      Save progress
    </button>
  ),
}));

vi.mock("@/features/schedule/api", () => ({
  saveScheduleReadingProgress: api.saveScheduleReadingProgress,
}));

vi.mock("@/features/profile/api", () => ({
  savePersonalReadingProgress: api.savePersonalReadingProgress,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

describe("PaperLogControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.savePersonalReadingProgress.mockResolvedValue({});
    api.saveScheduleReadingProgress.mockResolvedValue({});
  });

  it("saves schedule progress through one atomic mutation", async () => {
    renderWithClient(
      <PaperLogControl
        pageCount={8}
        pagesRead={2}
        status="reading"
        target={{ kind: "schedule", scheduleId: "schedule-1", clubId: "club-1" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));

    await waitFor(() =>
      expect(api.saveScheduleReadingProgress).toHaveBeenCalledWith({
        scheduleId: "schedule-1",
        currentPage: 5,
        totalPages: 10,
        status: "reading",
      }),
    );
  });

  it("saves personal progress through one atomic mutation", async () => {
    renderWithClient(
      <PaperLogControl
        pageCount={8}
        pagesRead={2}
        status="reading"
        target={{ kind: "personal", personalPaperId: "personal-1" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));

    await waitFor(() =>
      expect(api.savePersonalReadingProgress).toHaveBeenCalledWith({
        personalPaperId: "personal-1",
        currentPage: 5,
        totalPages: 10,
        status: "reading",
      }),
    );
  });
});

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  );
}
