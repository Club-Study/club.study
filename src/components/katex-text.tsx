import katex from "katex";

import { parseKatexText, type KatexTextPart } from "@/lib/katex-text";
import { cn } from "@/lib/utils";

export function KatexText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = parseKatexText(text);

  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.value}</span>
        ) : (
          <MathPart key={index} part={part} />
        ),
      )}
    </div>
  );
}

function MathPart({ part }: { part: Extract<KatexTextPart, { kind: "math" }> }) {
  const html = renderMath(part.value, part.displayMode);

  if (html === null) {
    return part.displayMode ? (
      <div className="whitespace-pre-wrap py-1">{part.source}</div>
    ) : (
      <span>{part.source}</span>
    );
  }

  return part.displayMode ? (
    <div
      className="overflow-x-auto py-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function renderMath(value: string, displayMode: boolean) {
  try {
    return katex.renderToString(value, {
      displayMode,
      strict: "error",
      throwOnError: true,
      trust: false,
    });
  } catch {
    return null;
  }
}
