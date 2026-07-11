import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KatexText } from "@/components/katex-text";

describe("KatexText", () => {
  it("renders invalid balanced math as escaped plain text", () => {
    const { container } = render(
      <KatexText text={"Before $\\notARealCommand{x}$ after"} />,
    );

    expect(container).toHaveTextContent(
      "Before $\\notARealCommand{x}$ after",
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders an unclosed delimiter as plain text", () => {
    const { container } = render(<KatexText text="Price is $5 today" />);

    expect(container).toHaveTextContent("Price is $5 today");
  });
});
