import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileActivityPanel } from "@/features/profile/components/ProfileActivityPanel";
import type { ProfileActivity } from "@/features/profile/profileActivity";

const activity: ProfileActivity = {
  contributionCells: Array.from({ length: 52 * 7 }, () => 0),
  plannedCount: 0,
  readCount: 0,
  readingCount: 0,
};

describe("ProfileActivityPanel", () => {
  it("renders an unframed 52-week graph without resizing its cells", () => {
    render(<ProfileActivityPanel activity={activity} />);

    const heading = screen.getByRole("heading", { name: "Reading activity" });
    const graph = screen.getByRole("region", {
      name: "Reading activity over the past 52 weeks",
    });
    const grid = graph.querySelector('[data-slot="contribution-grid"]');
    const graphContent = grid?.parentElement;

    expect(graph.parentElement).toBe(heading.parentElement);
    expect(graphContent).toHaveClass("w-max", "min-w-full");
    expect(grid).toHaveClass(
      "justify-between",
      "[grid-template-columns:repeat(52,var(--activity-cell,0.875rem))]",
    );
    expect(graph).toHaveClass(
      "[--activity-cell:0.625rem]",
      "xl:[--activity-cell:0.6875rem]",
      "2xl:[--activity-cell:0.75rem]",
    );
  });
});
