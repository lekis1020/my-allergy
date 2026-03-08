"""
Conference scraper using Scrapling.
https://github.com/D4Vinci/Scrapling

Install: pip install scrapling
Setup:   python -m scrapling install

Usage:
  # Scrape and print JSON
  python scripts/scrape_conferences.py

  # Upload to Supabase
  python scripts/scrape_conferences.py --upload

Environment variables (for --upload):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import json
import asyncio
import re
import sys
import os
import argparse
from datetime import datetime
from typing import Optional

try:
    from scrapling.fetchers import AsyncFetcher
except ImportError:
    print("scrapling not installed. Run: pip install scrapling && python -m scrapling install", file=sys.stderr)
    sys.exit(1)

MONTH_MAP = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """Extract YYYY-MM-DD start/end dates from text."""
    # "March 7-11, 2025" or "March 7 - 11, 2025"
    m = re.search(r'(\w+)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})', text, re.I)
    if m:
        mon = MONTH_MAP.get(m.group(1).lower())
        if mon:
            year = int(m.group(4))
            return (f"{year}-{mon:02d}-{int(m.group(2)):02d}",
                    f"{year}-{mon:02d}-{int(m.group(3)):02d}")

    # "March 7 – April 2, 2025"
    m = re.search(r'(\w+)\s+(\d{1,2})\s*[-–]\s*(\w+)\s+(\d{1,2}),?\s*(\d{4})', text, re.I)
    if m:
        m1 = MONTH_MAP.get(m.group(1).lower())
        m2 = MONTH_MAP.get(m.group(3).lower())
        if m1 and m2:
            year = int(m.group(5))
            return (f"{year}-{m1:02d}-{int(m.group(2)):02d}",
                    f"{year}-{m2:02d}-{int(m.group(4)):02d}")

    # ISO dates
    dates = re.findall(r'\d{4}-\d{2}-\d{2}', text)
    if len(dates) >= 2:
        return dates[0], dates[1]
    if len(dates) == 1:
        return dates[0], dates[0]

    return None, None


async def scrape_aaaai() -> list[dict]:
    """Scrape AAAAI Annual Meeting."""
    results = []
    url = "https://www.aaaai.org/meetings-events/aaaai-annual-meeting"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        # Look for date text near heading
        heading = page.css("h1, h2, .event-title, .meeting-title")
        date_els = page.css("time, .date, .event-date, [class*='date'], [class*='when']")
        loc_els = page.css(".location, [class*='location'], [class*='venue'], [class*='city']")

        title = heading[0].text.strip() if heading else "AAAAI Annual Meeting"
        date_text = " ".join(el.text for el in date_els[:8])
        loc_text = loc_els[0].text.strip() if loc_els else "USA"

        start, end = parse_date_range(date_text)
        if start:
            results.append({
                "name": title or "AAAAI Annual Meeting",
                "start_date": start,
                "end_date": end or start,
                "location": loc_text,
                "country": "USA",
                "tags": ["Allergy", "Asthma", "Immunology"],
                "website": "https://www.aaaai.org/meetings-events",
                "is_korean": False,
                "source_url": url,
            })
    except Exception as e:
        print(f"[AAAAI] error: {e}", file=sys.stderr)
    return results


async def scrape_eaaci() -> list[dict]:
    """Scrape EAACI Congress."""
    results = []
    url = "https://eaaci.org/events/"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        cards = page.css("article, .event-item, .tribe-event, [class*='event-card'], li.event")
        for card in cards[:10]:
            text = card.text
            if not any(k in text.lower() for k in ["allerg", "congress", "immunol", "symposium"]):
                continue
            title_el = card.css("h2, h3, h4, .tribe-event-url, .event-title, a")
            title = title_el[0].text.strip() if title_el else ""
            if not title:
                continue
            start, end = parse_date_range(text)
            loc_el = card.css(".tribe-venue, .location, [class*='venue'], [class*='location']")
            loc = loc_el[0].text.strip() if loc_el else "Europe"
            if start:
                results.append({
                    "name": title,
                    "start_date": start,
                    "end_date": end or start,
                    "location": loc,
                    "country": "TBD",
                    "tags": ["Allergy", "Immunology"],
                    "website": "https://eaaci.org/events/",
                    "is_korean": False,
                    "source_url": url,
                })
    except Exception as e:
        print(f"[EAACI] error: {e}", file=sys.stderr)
    return results


async def scrape_acaai() -> list[dict]:
    """Scrape ACAAI Annual Scientific Meeting."""
    results = []
    url = "https://acaai.org/meet/annual-scientific-meeting/"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        heading = page.css("h1, h2, .event-title")
        date_els = page.css("time, .date, [class*='date']")
        loc_els = page.css(".location, [class*='location'], [class*='venue']")

        title = heading[0].text.strip() if heading else "ACAAI Annual Scientific Meeting"
        date_text = " ".join(el.text for el in date_els[:6])
        loc_text = loc_els[0].text.strip() if loc_els else "USA"

        start, end = parse_date_range(date_text)
        if start:
            results.append({
                "name": title or "ACAAI Annual Scientific Meeting",
                "start_date": start,
                "end_date": end or start,
                "location": loc_text,
                "country": "USA",
                "tags": ["Allergy", "Asthma", "Immunology"],
                "website": url,
                "is_korean": False,
                "source_url": url,
            })
    except Exception as e:
        print(f"[ACAAI] error: {e}", file=sys.stderr)
    return results


async def scrape_wao() -> list[dict]:
    """Scrape WAO (World Allergy Organization) events."""
    results = []
    url = "https://www.worldallergy.org/education-and-programs/education/allergology-in-practice/congress-calendar"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        rows = page.css("table tr, .congress-item, [class*='congress'], li")
        for row in rows[:20]:
            text = row.text
            if len(text.strip()) < 10:
                continue
            if not any(k in text.lower() for k in ["allerg", "immunol", "asthma", "congress", "symposium"]):
                continue
            start, end = parse_date_range(text)
            if start:
                # Extract name (first line or first sentence)
                name = text.strip().split("\n")[0].strip()[:120]
                results.append({
                    "name": name,
                    "start_date": start,
                    "end_date": end or start,
                    "location": "TBD",
                    "country": "International",
                    "tags": ["Allergy", "Immunology"],
                    "website": url,
                    "is_korean": False,
                    "source_url": url,
                })
    except Exception as e:
        print(f"[WAO] error: {e}", file=sys.stderr)
    return results


async def scrape_korean_allergy() -> list[dict]:
    """대한천식알레르기학회 일정 스크래핑."""
    results = []
    url = "https://www.allergy.or.kr/"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        items = page.css(
            ".schedule-list li, .notice-list li, table tr, "
            "[class*='schedule'] li, [class*='board'] li, .main-notice li"
        )
        for item in items[:15]:
            text = item.text.strip()
            if not any(k in text for k in ["학술", "대회", "심포", "세미나", "워크숍"]):
                continue
            start, end = parse_date_range(text)
            if start:
                name = text.split("\n")[0].strip()[:100]
                results.append({
                    "name": name,
                    "start_date": start,
                    "end_date": end or start,
                    "location": "Korea",
                    "country": "Korea",
                    "tags": ["Allergy", "Immunology"],
                    "website": "https://www.allergy.or.kr/",
                    "is_korean": True,
                    "source_url": url,
                })
    except Exception as e:
        print(f"[Korean Allergy] error: {e}", file=sys.stderr)
    return results


async def scrape_kapard() -> list[dict]:
    """대한소아알레르기호흡기학회 일정 스크래핑."""
    results = []
    url = "https://www.kapard.or.kr/"
    try:
        fetcher = AsyncFetcher(auto_match=False)
        page = await fetcher.get(url, timeout=20, stealthy_headers=True)

        items = page.css(
            ".schedule li, .notice li, table tr, "
            "[class*='schedule'] li, [class*='board'] li"
        )
        for item in items[:15]:
            text = item.text.strip()
            if not any(k in text for k in ["학술", "대회", "심포", "세미나", "워크숍"]):
                continue
            start, end = parse_date_range(text)
            if start:
                name = text.split("\n")[0].strip()[:100]
                results.append({
                    "name": name,
                    "start_date": start,
                    "end_date": end or start,
                    "location": "Korea",
                    "country": "Korea",
                    "tags": ["Pediatric", "Allergy", "Respiratory"],
                    "website": "https://www.kapard.or.kr/",
                    "is_korean": True,
                    "source_url": url,
                })
    except Exception as e:
        print(f"[KAPARD] error: {e}", file=sys.stderr)
    return results


async def main(upload: bool = False):
    print("Scraping conference data...", file=sys.stderr)

    tasks = [
        scrape_aaaai(),
        scrape_eaaci(),
        scrape_acaai(),
        scrape_wao(),
        scrape_korean_allergy(),
        scrape_kapard(),
    ]

    all_results = await asyncio.gather(*tasks, return_exceptions=True)
    conferences = []
    for r in all_results:
        if isinstance(r, list):
            conferences.extend(r)
        elif isinstance(r, Exception):
            print(f"Task error: {r}", file=sys.stderr)

    now = datetime.utcnow().isoformat() + "Z"
    for c in conferences:
        c["scraped_at"] = now

    print(f"Scraped {len(conferences)} conferences.", file=sys.stderr)

    if upload:
        try:
            from supabase import create_client
            url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
            key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
            client = create_client(url, key)

            if conferences:
                # Clear existing scraped data and insert new
                client.table("conferences").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                client.table("conferences").insert(conferences).execute()
                print(f"Uploaded {len(conferences)} conferences to Supabase.", file=sys.stderr)
            else:
                print("No conferences to upload.", file=sys.stderr)
        except ImportError:
            print("supabase-py not installed. Run: pip install supabase", file=sys.stderr)
        except KeyError as e:
            print(f"Missing env var: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Upload error: {e}", file=sys.stderr)
    else:
        print(json.dumps(conferences, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape allergy conference data")
    parser.add_argument("--upload", action="store_true", help="Upload results to Supabase")
    args = parser.parse_args()
    asyncio.run(main(upload=args.upload))
