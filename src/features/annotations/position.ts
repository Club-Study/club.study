import type {
  AnnotationPosition,
  AnnotationRect,
} from "@/features/annotations/api";

export function normalizeClientRect(
  rect: DOMRect,
  pageRect: DOMRect,
): AnnotationRect | null {
  const left = Math.max(rect.left, pageRect.left);
  const right = Math.min(rect.right, pageRect.right);
  const top = Math.max(rect.top, pageRect.top);
  const bottom = Math.min(rect.bottom, pageRect.bottom);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    left: ((left - pageRect.left) / pageRect.width) * 100,
    top: ((top - pageRect.top) / pageRect.height) * 100,
    width: ((right - left) / pageRect.width) * 100,
    height: ((bottom - top) / pageRect.height) * 100,
  };
}

export function getBoundingRect(rects: AnnotationRect[]): AnnotationRect {
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

export function isAnnotationPosition(value: unknown): value is AnnotationPosition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const position = value as Partial<AnnotationPosition>;
  return (
    (position.type === "text" || position.type === "area") &&
    isAnnotationRect(position.boundingRect) &&
    Array.isArray(position.rects) &&
    position.rects.every(isAnnotationRect)
  );
}

function isAnnotationRect(value: unknown): value is AnnotationRect {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rect = value as Partial<AnnotationRect>;
  return (
    isFiniteNumber(rect.left) &&
    isFiniteNumber(rect.top) &&
    isFiniteNumber(rect.width) &&
    isFiniteNumber(rect.height)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
