import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfilePaperRows } from "@/features/profile/components/ProfilePaperRows";
import type { ProfilePaperBuckets } from "@/features/profile/profileActivity";

const testState = vi.hoisted(() => ({
  author: "author-name-without-break-opportunities-that-must-truncate",
  title: "paper-title-without-break-opportunities-that-must-truncate-on-mobile",
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, title }: {
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <a href="#paper" className={className} title={title}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/profile/components/PaperLogControl", () => ({
  PaperLogControl: () => <button type="button">Log</button>,
  PaperProgress: () => null,
}));

const buckets: ProfilePaperBuckets = {
  droppedPersonalPapers: [],
  droppedSchedules: [],
  onHoldPersonalPapers: [],
  onHoldSchedules: [],
  pagesReadByPersonalPaperId: {},
  pagesReadByScheduleId: {},
  plannedPersonalPapers: [],
  plannedSchedules: [],
  readLogs: [],
  readPersonalPapers: [],
  readingPersonalPapers: [
    {
      id: "personal-1",
      paper_id: "paper-1",
      read_at: null,
      deadline: null,
      status: "reading",
      created_at: "2026-07-10T00:00:00.000Z",
      papers: {
        id: "paper-1",
        source_type: "manual",
        title: testState.title,
        authors: [testState.author],
        abstract: null,
        doi: null,
        license: null,
        arxiv_id: null,
        abstract_url: null,
        pdf_url: null,
        external_url: "https://example.com/paper",
        manual_scope: "user:00000000-0000-0000-0000-000000000001",
        page_count: null,
        published_at: null,
        source_updated_at: null,
        created_at: "2026-07-10T00:00:00.000Z",
        updated_at: "2026-07-10T00:00:00.000Z",
      },
    },
  ],
  readingSchedules: [],
};

describe("ProfilePaperRows", () => {
  it("truncates editable paper titles and author metadata", () => {
    render(
      <ProfilePaperRows
        view="reading"
        buckets={buckets}
        empty="No papers"
      />,
    );

    const title = screen.getByRole("link", { name: testState.title });
    const author = screen.getByText(testState.author);

    expect(title).toHaveClass("block", "max-w-full", "truncate");
    expect(title).toHaveAttribute("title", testState.title);
    expect(author).toHaveClass("min-w-0", "max-w-full", "truncate");
  });
});
