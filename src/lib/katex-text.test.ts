import { describe, expect, it } from "vitest";

import { parseKatexText } from "@/lib/katex-text";

describe("parseKatexText", () => {
  it("parses inline dollar math", () => {
    expect(parseKatexText("Let $x^2$ be square.")).toEqual([
      { kind: "text", value: "Let " },
      { kind: "math", value: "x^2", displayMode: false, source: "$x^2$" },
      { kind: "text", value: " be square." },
    ]);
  });

  it("parses display math delimiters", () => {
    expect(parseKatexText("Before\n$$x^2$$\nafter")).toEqual([
      { kind: "text", value: "Before\n" },
      { kind: "math", value: "x^2", displayMode: true, source: "$$x^2$$" },
      { kind: "text", value: "\nafter" },
    ]);
  });

  it("keeps escaped delimiters as text", () => {
    expect(parseKatexText("Price is \\$5.")).toEqual([
      { kind: "text", value: "Price is \\$5." },
    ]);
  });

  it("keeps unclosed math delimiters as text", () => {
    expect(parseKatexText("Let $x be open.")).toEqual([
      { kind: "text", value: "Let " },
      { kind: "text", value: "$x be open." },
    ]);
  });
});
