"""Recitation counts from Ganjoor's public API, the popularity of a poem («پرخواننده»).

/api/audio/published?catId=<id> lists only the recitations of poems directly in that category
(sub-categories are not included), so every category that holds poems is queried on its own.
Results are cached per category in tools/ganjoor/.cache/audio, so reruns need no network.
"""
import json
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

API = "https://api.ganjoor.net/api/audio/published?catId={cat}&PageNumber={page}&PageSize=100"


def count_recitations(pages):
    """Pages of recitation records -> {poemId: number of recitations}."""
    return dict(Counter(item["poemId"] for page in pages for item in page))


def total_pages(headers):
    """Page count from the `paging-headers` response header (a JSON string)."""
    return json.loads(headers["paging-headers"])["totalPages"]


def get_page(cat, page, attempts=4):
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(API.format(cat=cat, page=page), timeout=60) as response:
                return json.load(response), response.headers
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == attempts - 1:
                sys.exit(f"audio list failed for category {cat}: {error}")
            time.sleep(2 ** attempt)


def category_counts(cache_dir, cat):
    """{poemId: recitations} for the poems directly in one category (cached)."""
    file = cache_dir / f"{cat}.json"
    if file.exists():
        return {int(k): v for k, v in json.loads(file.read_text()).items()}
    first, headers = get_page(cat, 1)
    pages = [first] + [get_page(cat, n)[0] for n in range(2, total_pages(headers) + 1)]
    counts = count_recitations(pages)
    cache_dir.mkdir(parents=True, exist_ok=True)
    part = file.with_name(file.name + ".part")
    part.write_text(json.dumps(counts))
    part.replace(file)
    return counts
