import { beforeEach, describe, expect, it, vi } from "vitest";

import { softDeletePaperAnnotation } from "@/features/annotations/api";

const database = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: database.rpc },
}));

describe("softDeletePaperAnnotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.rpc.mockResolvedValue({ data: "annotation-1", error: null });
  });

  it("uses the narrow soft-delete RPC without returning hidden content", async () => {
    await softDeletePaperAnnotation("annotation-1");

    expect(database.rpc).toHaveBeenCalledWith(
      "soft_delete_paper_annotation",
      {
        p_annotation_id: "annotation-1",
      },
    );
  });
});
