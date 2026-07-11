import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LogReadingSessionDialog } from "@/components/log-reading-session-dialog";

describe("LogReadingSessionDialog", () => {
  it("blocks logged pages while the paper is still planned", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <LogReadingSessionDialog
        currentPagesRead={0}
        totalPages={10}
        status="planned"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log pages" }));
    fireEvent.change(screen.getByLabelText("Current page"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));

    expect(
      await screen.findByText(
        "Planned papers cannot have logged pages. Choose Reading or set current page to 0.",
      ),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("explains the database page-count limit before submitting", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <LogReadingSessionDialog
        currentPagesRead={0}
        totalPages={null}
        status="reading"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log pages" }));
    fireEvent.change(screen.getByLabelText("Current page"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Total pages"), {
      target: { value: "100001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));

    expect(
      await screen.findByText("Total pages cannot exceed 100,000."),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });
});
