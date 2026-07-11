export type KatexTextPart =
  | {
      kind: "text";
      value: string;
    }
  | {
      kind: "math";
      value: string;
      displayMode: boolean;
      source: string;
    };

const MATH_DELIMITERS = [
  { open: "$$", close: "$$", displayMode: true },
  { open: "\\[", close: "\\]", displayMode: true },
  { open: "\\(", close: "\\)", displayMode: false },
  { open: "$", close: "$", displayMode: false },
] as const;

export function parseKatexText(text: string): KatexTextPart[] {
  const parts: KatexTextPart[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const nextDelimiter = findNextDelimiter(text, cursor);

    if (!nextDelimiter) {
      pushTextPart(parts, text.slice(cursor));
      break;
    }

    if (nextDelimiter.index > cursor) {
      pushTextPart(parts, text.slice(cursor, nextDelimiter.index));
    }

    const mathStart = nextDelimiter.index + nextDelimiter.open.length;
    const closeIndex = findClosingDelimiter(
      text,
      nextDelimiter.close,
      mathStart,
    );

    if (closeIndex === -1) {
      pushTextPart(parts, text.slice(nextDelimiter.index));
      break;
    }

    parts.push({
      kind: "math",
      value: text.slice(mathStart, closeIndex),
      displayMode: nextDelimiter.displayMode,
      source: text.slice(
        nextDelimiter.index,
        closeIndex + nextDelimiter.close.length,
      ),
    });

    cursor = closeIndex + nextDelimiter.close.length;
  }

  return parts;
}

function pushTextPart(parts: KatexTextPart[], value: string) {
  if (value) {
    parts.push({ kind: "text", value });
  }
}

function findNextDelimiter(text: string, startIndex: number) {
  let nextMatch:
    | (typeof MATH_DELIMITERS)[number] & {
        index: number;
      }
    | null = null;

  for (const delimiter of MATH_DELIMITERS) {
    const index = findUnescaped(text, delimiter.open, startIndex);

    if (index !== -1 && (!nextMatch || index < nextMatch.index)) {
      nextMatch = { ...delimiter, index };
    }
  }

  return nextMatch;
}

function findClosingDelimiter(
  text: string,
  delimiter: string,
  startIndex: number,
) {
  return findUnescaped(text, delimiter, startIndex);
}

function findUnescaped(text: string, search: string, startIndex: number) {
  let index = text.indexOf(search, startIndex);

  while (index !== -1) {
    if (!isEscaped(text, index)) {
      return index;
    }

    index = text.indexOf(search, index + search.length);
  }

  return -1;
}

function isEscaped(text: string, index: number) {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}
