#!/usr/bin/env python3
import csv
import json
import logging
import time
from io import StringIO
from pathlib import Path
from typing import Any

import requests

"""Collect language data from FLORES, Wikidata, and Glottolog APIs.

For each language in the FLORES dataset, this script retrieves additional
information from Wikidata (such as number of speakers, continent, Wikipedia link)
and from Glottolog (language family). The final output is a JSON object with
detailed information for each language.
"""

CODE_TIERS_N_COLS = 3
MORPHOLOGY_TYPES_N_COLS = 3
FLORES_LANGUAGES_N_COLS = 4
RESPONSE_SUCCESS_CODE = 200


# Configure logging with date and time
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")


def load_code_tiers(tsv_path: Path) -> dict[str, int]:
    """Load language resource tiers from TSV file

    Note: One ISO code can have multiple glottocodes, but there is only one tier per ISO code.
    """

    tiers = {}

    with tsv_path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")
        next(reader, None)  # Skip header row

        for row in reader:
            if len(row) < CODE_TIERS_N_COLS:
                continue

            iso_code = row[0].strip()
            tier = row[2].strip()

            if not iso_code:
                continue

            # Only store tier if not already set (all entries for same ISO should have same tier)
            if iso_code not in tiers:
                # Store tier, handling '?' as None and converting to int if possible
                if tier == "?":
                    tiers[iso_code] = None
                else:
                    try:
                        tiers[iso_code] = int(tier)
                    except ValueError:
                        tiers[iso_code] = None

    return tiers


def load_morphology_types(tsv_path: Path) -> dict[str, str]:
    """Load morphology types from TSV file"""

    morphology = {}

    with tsv_path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")

        for row in reader:
            if len(row) < MORPHOLOGY_TYPES_N_COLS:
                continue

            iso_code = row[0].strip()
            morph_type = row[2].strip()

            if not iso_code or not morph_type:
                continue

            morphology[iso_code] = morph_type

    return morphology


def load_flores_languages(tsv_path: Path) -> dict[str, dict[str, str | set]]:
    """Load languages from FLORES TSV file and group by language code"""

    languages = {}

    with tsv_path.open("r", encoding="utf-8") as f:
        reader = csv.reader(f, delimiter="\t")

        for row in reader:
            if len(row) < FLORES_LANGUAGES_N_COLS:
                continue

            iso_code = row[0].strip()
            script = row[1].strip()
            glottocode = row[2].strip()
            name = row[3].strip()

            if not iso_code:
                continue

            if iso_code not in languages:
                languages[iso_code] = {
                    "iso_639_3": iso_code,
                    "name": name,
                    "scripts": set(),
                    "glottocodes": set(),
                }

            if script:
                languages[iso_code]["scripts"].add(script)

            if glottocode:
                languages[iso_code]["glottocodes"].add(glottocode)

    return languages


def get_wikidata_info(iso_codes: list[str]) -> list[str]:
    """Query Wikidata for language info using ISO 639-3 codes"""

    endpoint = "https://query.wikidata.org/sparql"

    batch_size = 50
    all_results = []

    for i in range(0, len(iso_codes), batch_size):
        batch = iso_codes[i : i + batch_size]
        values = " ".join([f'"{code}"' for code in batch])

        query = f"""
        SELECT ?iso ?langLabel ?speakers ?continentLabel ?article WHERE {{
          VALUES ?iso {{ {values} }}
          ?lang wdt:P220 ?iso .

          OPTIONAL {{ ?lang wdt:P1098 ?speakers . }}
          OPTIONAL {{
            {{ ?lang wdt:P495 ?country . }} UNION {{ ?lang wdt:P17 ?country . }}
            ?country wdt:P30 ?continent .
          }}
          OPTIONAL {{
            ?article schema:about ?lang .
            ?article schema:inLanguage "en" .
            ?article schema:isPartOf <https://en.wikipedia.org/> .
          }}

          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        """

        response = requests.get(
            endpoint, params={"query": query, "format": "json"}, headers={"User-Agent": "LanguageDataBot/1.0"}
        )

        if response.status_code == RESPONSE_SUCCESS_CODE:
            data = response.json()
            all_results.extend(data["results"]["bindings"])
        else:
            logging.error("Error on batch %i: %i", i, response.status_code)

        time.sleep(1)

    return all_results


def get_glottolog_families(glottocodes: list[str]) -> dict[str, str | None]:
    """Query Glottolog API for language family information using glottocodes"""

    families = {}

    for glottocode in glottocodes:
        if not glottocode:
            continue

        url = f"https://glottolog.org/resource/languoid/id/{glottocode}.json"

        try:
            response = requests.get(url, headers={"User-Agent": "LanguageDataBot/1.0"})

            if response.status_code == RESPONSE_SUCCESS_CODE:
                data = response.json()

                # Get the classification (family chain)
                classification = data.get("classification", [])
                if classification:
                    # The top-level family is usually the first in the classification
                    families[glottocode] = classification[0].get("name", "")
                else:
                    # If no classification, it might be an isolate or top-level family
                    families[glottocode] = None
            else:
                logging.error("Error fetching Glottolog data for %s: %i", glottocode, response.status_code)
                families[glottocode] = None
        except Exception:
            logging.exception("Exception fetching Glottolog data for %s:", glottocode)
            families[glottocode] = None

        time.sleep(0.1)  # Be nice to the API

    return families


def get_fineweb2_data() -> dict[str, int | str | None]:
    """Download and parse Fine Web 2 language distribution data"""

    url = "https://raw.githubusercontent.com/huggingface/fineweb-2/refs/heads/main/fineweb2-language-distribution.csv"

    try:
        logging.info("Downloading Fine Web 2 language distribution data...")
        response = requests.get(url, headers={"User-Agent": "LanguageDataBot/1.0"})

        if response.status_code != RESPONSE_SUCCESS_CODE:
            logging.error("Error downloading Fine Web 2 data: %i", response.status_code)
            return {}

        # Parse CSV
        csv_content = StringIO(response.text)
        reader = csv.DictReader(csv_content)

        # Group by language code and script
        fineweb_data = {}
        for row in reader:
            # Skip if not in train split or if it's a removed subset
            subset = row.get("subset", "")
            if "_removed" in subset:
                continue

            split = row.get("split", "")
            if split != "train":
                continue

            code = row.get("code", "").strip()
            script = row.get("script", "").strip()

            if not code or not script:
                continue

            key = f"{code}_{script}"

            # Store UTF-8 bytes count
            try:
                fineweb_data[key] = int(row.get("utf8_bytes", 0))
            except (ValueError, TypeError):
                # Skip if conversion fails
                continue

        # Manually add eng_Latn (missing from CSV)
        fineweb_data["eng_Latn"] = 200_000_000_000_000

        logging.info("Loaded Fine Web 2 data for %i language-script combinations", len(fineweb_data))
        return fineweb_data  # noqa: TRY300

    except Exception:
        logging.exception("Exception fetching Fine Web 2 data:")
        return {}


def merge_wikidata_info(  # noqa: PLR0912
    languages: dict[str, dict[str, str | set]],
    wikidata_results: list[str],
    glottolog_families: dict[str, str | None],
    code_tiers: dict[str, int],
    fineweb_data: dict[str, int | str | None],
    morphology_types: dict[str, str],
) -> dict[str, Any]:
    """Merge Wikidata, Glottolog, tier, and morphology information into language records"""

    for r in wikidata_results:
        iso = r.get("iso", {}).get("value", "")

        if not iso or iso not in languages:
            continue

        lang = languages[iso]

        continent = r.get("continentLabel", {}).get("value", "")
        if continent and "continent" not in lang:
            lang["continent"] = continent

        wikipedia = r.get("article", {}).get("value", "")
        if wikipedia and "wikipedia" not in lang:
            lang["wikipedia"] = wikipedia

        speakers = r.get("speakers", {}).get("value", "")
        if speakers:
            try:
                count = int(float(speakers))
                if "speakers" not in lang or lang["speakers"] is None or count > lang["speakers"]:
                    lang["speakers"] = count
            except ValueError:
                pass

    # Add Glottolog family information for each glottocode
    for lang in languages.values():
        glottocodes = lang.get("glottocodes", set())
        families = set()
        for glottocode in glottocodes:
            if glottocode and glottocode in glottolog_families:
                family = glottolog_families[glottocode]
                if family:
                    families.add(family)
        if families:
            # Store as list if multiple families, single value if one, None if empty
            lang["families"] = sorted(families) if len(families) > 1 else next(iter(families))

    # Add tier information
    for iso, lang in languages.items():
        if iso in code_tiers:
            lang["tier"] = code_tiers[iso]

    # Add morphology type information
    for iso, lang in languages.items():
        if iso in morphology_types:
            lang["morphology"] = morphology_types[iso]

    # Add Fine Web 2 corpus statistics
    for iso, lang in languages.items():
        scripts = lang.get("scripts", set())

        # Collect Fine Web 2 data for each script
        fineweb_stats = {}
        for script in scripts:
            key = f"{iso}_{script}"
            if key in fineweb_data:
                fineweb_stats[script] = fineweb_data[key]

        if fineweb_stats:
            lang["fineweb2"] = fineweb_stats

    # Convert sets to sorted lists and format output
    output = {}
    for iso, lang in sorted(languages.items()):
        glottocodes = lang.get("glottocodes", set())
        fineweb_stats = lang.get("fineweb2", {})

        # Format Fine Web 2 data
        fineweb_formatted = None
        if fineweb_stats:
            fineweb_formatted = {}
            for script, stats in sorted(fineweb_stats.items()):
                fineweb_formatted[script] = stats

        output[iso] = {
            "name": lang["name"],
            "scripts": sorted(lang["scripts"]) if lang["scripts"] else None,
            "glottocodes": sorted(glottocodes) if glottocodes else None,
            "families": lang.get("families"),
            "speakers": lang.get("speakers"),
            "continent": lang.get("continent"),
            "wikipedia": lang.get("wikipedia"),
            "tier": lang.get("tier"),
            "morphology": lang.get("morphology"),
            "fineweb2": fineweb_formatted,
        }

    return output


if __name__ == "__main__":
    # Load languages from FLORES TSV
    logging.info("Loading languages from flores_languages.tsv...")
    languages = load_flores_languages(Path("tokeval/resources/language/flores_languages.tsv"))
    logging.info("Loaded %i unique languages", len(languages))

    # Load code tiers
    logging.info("Loading language resource tiers from code_tiers.tsv...")
    code_tiers = load_code_tiers(Path("tokeval/resources/language/code_tiers.tsv"))
    logging.info("Loaded tiers for %i languages", len(code_tiers))

    # Load morphology types
    logging.info("Loading morphology types from morphology.tsv...")
    morphology_types = load_morphology_types(Path("tokeval/resources/language/morphology.tsv"))
    logging.info("Loaded morphology types for %i languages", len(morphology_types))

    # Get Wikidata information
    logging.info("Querying Wikidata for additional information...")
    iso_codes = list(languages.keys())
    wikidata_results = get_wikidata_info(iso_codes)

    # Get Glottolog family information
    logging.info("Querying Glottolog for language families...")
    # Collect all unique glottocodes across all languages
    all_glottocodes = set()
    for lang in languages.values():
        all_glottocodes.update(lang.get("glottocodes", set()))
    glottocodes = list(all_glottocodes)
    glottolog_families = get_glottolog_families(glottocodes)

    # Get Fine Web 2 corpus data
    logging.info("Fetching Fine Web 2 corpus statistics..."), morphology_types
    fineweb_data = get_fineweb2_data()

    # Merge the data
    logging.info("Merging data...")
    final_data = merge_wikidata_info(
        languages, wikidata_results, glottolog_families, code_tiers, fineweb_data, morphology_types
    )

    # Output as JSON
    print(json.dumps(final_data, indent=2, ensure_ascii=False))  # noqa: T201
