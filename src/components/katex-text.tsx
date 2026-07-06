import katex from "katex";

import { parseKatexText } from "@/lib/katex-text";
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
        ) : part.displayMode ? (
          <div
            key={index}
            className="overflow-x-auto py-1"
            dangerouslySetInnerHTML={{
              __html: renderMath(part.value, part.displayMode),
            }}
          />
        ) : (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: renderMath(part.value, part.displayMode),
            }}
          />
        ),
      )}
    </div>
  );
}

function renderMath(value: string, displayMode: boolean) {
  return katex.renderToString(value, {
    displayMode,
    strict: "error",
    throwOnError: true,
    trust: false,
  });
}
