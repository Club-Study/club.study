import { beforeEach, describe, expect, it, vi } from "vitest";

import { softDeleteComment } from "@/features/comments/api";

const database = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: database.rpc },
}));

describe("softDeleteComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.rpc.mockResolvedValue({ data: "comment-1", error: null });
  });

  it("uses the narrow soft-delete RPC without returning hidden content", async () => {
    await softDeleteComment("comment-1");

    expect(database.rpc).toHaveBeenCalledWith("soft_delete_comment", {
      p_comment_id: "comment-1",
    });
  });
});
