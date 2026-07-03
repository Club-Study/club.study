import { describe, expect, it } from "vitest";

import {
  getBoundingRect,
  isAnnotationPosition,
  normalizeClientRect,
} from "@/features/annotations/position";

describe("annotation position helpers", () => {
  it("normalizes client rects to page percentages", () => {
    const page = domRect(100, 200, 400, 800);
    const rect = domRect(140, 280, 80, 160);

    expect(normalizeClientRect(rect, page)).toEqual({
      left: 10,
      top: 10,
      width: 20,
      height: 20,
    });
  });

  it("returns a bounding rect for multiple text fragments", () => {
    expect(
      getBoundingRect([
        { left: 10, top: 10, width: 30, height: 5 },
        { left: 15, top: 20, width: 40, height: 5 },
      ]),
    ).toEqual({ left: 10, top: 10, width: 45, height: 15 });
  });

  it("validates stored annotation positions", () => {
    expect(
      isAnnotationPosition({
        type: "text",
        boundingRect: { left: 1, top: 2, width: 3, height: 4 },
        rects: [{ left: 1, top: 2, width: 3, height: 4 }],
      }),
    ).toBe(true);
    expect(isAnnotationPosition({ type: "text", rects: [] })).toBe(false);
  });
});

function domRect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as DOMRect;
}
