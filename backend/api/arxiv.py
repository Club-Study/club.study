import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from rest_framework.exceptions import ValidationError


CANONICAL_ID_PATTERN = re.compile(
    r"^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+/[0-9]{7})(?:v[0-9]+)?$"
)
ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"


def lookup_arxiv_metadata(raw_input):
    arxiv_id, abstract_url, pdf_url = normalize_arxiv_input(raw_input)
    query_url = "https://export.arxiv.org/api/query?id_list={}".format(
        urllib.parse.quote(arxiv_id)
    )

    try:
        with urllib.request.urlopen(query_url, timeout=10) as response:
            payload = response.read()
    except OSError as error:
        raise ValidationError("Could not fetch arXiv metadata.") from error

    try:
        root = ET.fromstring(payload)
    except ET.ParseError as error:
        raise ValidationError("arXiv returned invalid metadata.") from error

    entry = root.find("{}entry".format(ATOM_NS))
    if entry is None:
        raise ValidationError("No arXiv paper was found for that ID.")

    title = text_child(entry, "title")
    abstract = text_child(entry, "summary", required=False)
    published_at = text_child(entry, "published", required=False)
    updated_at = text_child(entry, "updated", required=False)
    doi = text_child(entry, "{}doi".format(ARXIV_NS), required=False)
    license_url = find_license_url(entry)
    authors = [
        normalize_whitespace(name.text)
        for name in entry.findall("{}author/{}name".format(ATOM_NS, ATOM_NS))
        if normalize_whitespace(name.text)
    ]

    if not authors:
        raise ValidationError("arXiv metadata did not include authors.")

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "arxiv_id": arxiv_id,
        "doi": doi,
        "license": license_url,
        "abstract_url": abstract_url,
        "pdf_url": pdf_url,
        "published_at": published_at,
        "updated_at": updated_at,
    }


def normalize_arxiv_input(raw_input):
    if not isinstance(raw_input, str) or not raw_input.strip():
        raise ValidationError("Enter an arXiv URL or ID.")

    extracted = extract_arxiv_id(raw_input.strip())
    match = CANONICAL_ID_PATTERN.match(extracted)

    if not match:
        raise ValidationError("Use a valid arXiv URL, PDF URL, or ID.")

    arxiv_id = match.group(1)
    return arxiv_id, "https://arxiv.org/abs/{}".format(arxiv_id), "https://arxiv.org/pdf/{}".format(arxiv_id)


def extract_arxiv_id(value):
    parsed = urllib.parse.urlparse(value)

    if parsed.scheme and parsed.netloc:
        if parsed.netloc not in {"arxiv.org", "www.arxiv.org"}:
            return value

        path_parts = [part for part in parsed.path.split("/") if part]
        if len(path_parts) >= 2 and path_parts[0] in {"abs", "pdf"}:
            return "/".join(path_parts[1:]).removesuffix(".pdf")

        return value

    return re.sub(r"^arXiv:", "", value, flags=re.IGNORECASE)


def text_child(entry, tag, required=True):
    if not tag.startswith("{"):
        tag = "{}{}".format(ATOM_NS, tag)

    child = entry.find(tag)
    value = normalize_whitespace(child.text if child is not None else None)

    if required and not value:
        raise ValidationError("arXiv metadata was missing {}.".format(tag))

    return value or None


def find_license_url(entry):
    for link in entry.findall("{}link".format(ATOM_NS)):
        if link.attrib.get("rel") == "license":
            return link.attrib.get("href")

    return None


def normalize_whitespace(value):
    if not isinstance(value, str):
        return ""

    return re.sub(r"\s+", " ", value).strip()
