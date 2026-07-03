export type NormalizedArxivInput = {
  arxivId: string;
  abstractUrl: string;
  pdfUrl: string;
};

const canonicalIdPattern =
  /^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+\/[0-9]{7})(?:v[0-9]+)?$/;

export function normalizeArxivInput(input: string): NormalizedArxivInput {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Enter an arXiv URL or ID.");
  }

  const extracted = extractArxivId(raw);
  const match = canonicalIdPattern.exec(extracted);

  if (!match?.[1]) {
    throw new Error("Use a valid arXiv URL, PDF URL, or ID.");
  }

  const arxivId = match[1];

  return {
    arxivId,
    abstractUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
  };
}

export function isCanonicalArxivId(value: string) {
  return canonicalIdPattern.test(value) && !/v[0-9]+$/.test(value);
}

function extractArxivId(input: string) {
  try {
    const url = new URL(input);
    if (!["arxiv.org", "www.arxiv.org"].includes(url.hostname)) {
      return input;
    }

    const [kind, ...rest] = url.pathname.split("/").filter(Boolean);
    if ((kind === "abs" || kind === "pdf") && rest.length > 0) {
      return rest.join("/").replace(/\.pdf$/i, "");
    }
  } catch {
    return input.replace(/^arXiv:/i, "");
  }

  return input;
}
