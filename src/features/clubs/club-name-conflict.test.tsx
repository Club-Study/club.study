import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditClubDialog } from "@/features/clubs/EditClubDialog";
import { NewClubPage } from "@/features/clubs/NewClubPage";

const mocks = vi.hoisted(() => ({
  createClub: vi.fn(),
  updateClub: vi.fn(),
  navigate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/features/clubs/api", () => ({
  createClub: mocks.createClub,
  updateClub: mocks.updateClub,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

describe("club name conflicts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClub.mockRejectedValue({
      code: "23505",
      message: "duplicate key value violates unique constraint clubs_name_key",
    });
    mocks.updateClub.mockRejectedValue({
      code: "23505",
      message: "duplicate key value violates unique constraint clubs_name_key",
    });
  });

  it("shows and focuses the inline name error when creating a club", async () => {
    renderWithClient(<NewClubPage />);

    const nameInput = screen.getByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Existing club" } });
    fireEvent.click(screen.getByRole("button", { name: "Create club" }));

    expect(
      await screen.findByText("A club with this name already exists."),
    ).toBeVisible();
    await waitFor(() => expect(nameInput).toHaveFocus());
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("shows and focuses the inline name error when editing a club", async () => {
    renderWithClient(
      <EditClubDialog
        club={{
          id: "club-1",
          created_at: "2026-07-10T00:00:00.000Z",
          created_by: "user-1",
          description: null,
          name: "Original club",
          slug: "original-club",
          updated_at: "2026-07-10T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Existing club" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText("A club with this name already exists."),
    ).toBeVisible();
    await waitFor(() => expect(nameInput).toHaveFocus());
    expect(mocks.toastError).not.toHaveBeenCalled();
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
