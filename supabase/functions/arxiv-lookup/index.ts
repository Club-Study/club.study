const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type LookupBody = {
  input?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await request.json()) as LookupBody;
    const normalized = normalizeArxivInput(body.input ?? "");
    const response = await fetch(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(
        normalized.arxivId,
      )}`,
      {
        headers: {
          accept: "application/atom+xml",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`arXiv lookup failed with ${response.status}.`);
    }

    const xml = await response.text();
    const entry = firstTag(xml, "entry");

    if (!entry) {
      throw new Error("No arXiv paper found for that ID.");
    }

    const title = firstText(entry, "title");
    const abstract = firstText(entry, "summary");
    const authors = allTags(entry, "author")
      .map((author) => firstText(author, "name"))
      .filter(Boolean);
    const entryId = firstText(entry, "id");
    const canonical = normalizeArxivInput(entryId || normalized.arxivId);
    const doi = firstText(entry, "arxiv:doi") || firstText(entry, "doi");
    const license = firstText(entry, "arxiv:license") ||
      firstText(entry, "license");

    return json({
      title,
      authors,
      abstract: abstract || null,
      arxiv_id: canonical.arxivId,
      doi: doi || null,
      license: license || null,
      abstract_url: canonical.abstractUrl,
      pdf_url: canonical.pdfUrl,
      published_at: firstText(entry, "published") || null,
      updated_at: firstText(entry, "updated") || null,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "arXiv lookup failed" },
      400,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}

function firstText(xml: string, tagName: string) {
  return compactText(decodeXml(stripTags(firstTag(xml, tagName) ?? "")));
}

function firstTag(xml: string, tagName: string) {
  return tagPattern(tagName).exec(xml)?.[1] ?? null;
}

function allTags(xml: string, tagName: string) {
  return [...xml.matchAll(tagPattern(tagName, "gi"))]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
}

function tagPattern(tagName: string, flags = "i") {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
    flags,
  );
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

type NormalizedArxivInput = {
  arxivId: string;
  abstractUrl: string;
  pdfUrl: string;
};

const canonicalIdPattern =
  /^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+\/[0-9]{7})(?:v[0-9]+)?$/;

function normalizeArxivInput(input: string): NormalizedArxivInput {
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
