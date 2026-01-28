import json
import time
import csv
import logging
from io import StringIO

import requests

"""Collect language data from FLORES, Wikidata, and Glottolog APIs.

For each language in the FLORES dataset, this script retrieves additional
information from Wikidata (such as number of speakers, continent, Wikipedia link)
and from Glottolog (language family). The final output is a JSON object with
detailed information for each language.
"""

# Configure logging with date and time
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


def load_code_tiers(tsv_path):
    """Load language resource tiers from TSV file
    
    Note: One ISO code can have multiple glottocodes, but there is only one tier per ISO code.
    """
    
    tiers = {}
    
    with open(tsv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        next(reader, None)  # Skip header row
        
        for row in reader:
            if len(row) < 3:
                continue
                
            iso_code = row[0].strip()
            tier = row[2].strip()
            
            if not iso_code:
                continue
            
            # Only store tier if not already set (all entries for same ISO should have same tier)
            if iso_code not in tiers:
                # Store tier, handling '?' as None and converting to int if possible
                if tier == '?':
                    tiers[iso_code] = None
                else:
                    try:
                        tiers[iso_code] = int(tier)
                    except ValueError:
                        tiers[iso_code] = None
    
    return tiers


def load_morphology_types(tsv_path):
    """Load morphology types from TSV file"""
    
    morphology = {}
    
    with open(tsv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        
        for row in reader:
            if len(row) < 3:
                continue
                
            iso_code = row[0].strip()
            morph_type = row[2].strip()
            
            if not iso_code or not morph_type:
                continue
            
            morphology[iso_code] = morph_type
    
    return morphology


def load_flores_languages(tsv_path):
    """Load languages from FLORES TSV file and group by language code"""
    
    languages = {}
    
    with open(tsv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter='\t')
        
        for row in reader:
            if len(row) < 4:
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


def get_wikidata_info(iso_codes):
    """Query Wikidata for language info using ISO 639-3 codes"""
    
    endpoint = "https://query.wikidata.org/sparql"
    
    batch_size = 50
    all_results = []
    
    for i in range(0, len(iso_codes), batch_size):
        batch = iso_codes[i:i + batch_size]
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
            endpoint, 
            params={"query": query, "format": "json"},
            headers={"User-Agent": "LanguageDataBot/1.0"}
        )
        
        if response.status_code == 200:
            data = response.json()
            all_results.extend(data["results"]["bindings"])
        else:
            logging.error(f"Error on batch {i}: {response.status_code}")
        
        time.sleep(1)
    
    return all_results


def get_glottolog_families(glottocodes):
    """Query Glottolog API for language family information using glottocodes"""
    
    families = {}
    
    for glottocode in glottocodes:
        if not glottocode:
            continue
            
        url = f"https://glottolog.org/resource/languoid/id/{glottocode}.json"
        
        try:
            response = requests.get(url, headers={"User-Agent": "LanguageDataBot/1.0"})
            
            if response.status_code == 200:
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
                logging.error(f"Error fetching Glottolog data for {glottocode}: {response.status_code}")
                families[glottocode] = None
        except Exception as e:
            logging.error(f"Exception fetching Glottolog data for {glottocode}: {e}")
            families[glottocode] = None
        
        time.sleep(0.1)  # Be nice to the API
    
    return families


def get_fineweb2_data():
    """Download and parse Fine Web 2 language distribution data"""
    
    url = "https://raw.githubusercontent.com/huggingface/fineweb-2/refs/heads/main/fineweb2-language-distribution.csv"
    
    try:
        logging.info("Downloading Fine Web 2 language distribution data...")
        response = requests.get(url, headers={"User-Agent": "LanguageDataBot/1.0"})
        
        if response.status_code != 200:
            logging.error(f"Error downloading Fine Web 2 data: {response.status_code}")
            return {}
        
        # Parse CSV
        csv_content = StringIO(response.text)
        reader = csv.DictReader(csv_content)
        
        # Group by language code and script
        fineweb_data = {}
        for row in reader:
            # Skip if not in train split or if it's a removed subset
            subset = row.get('subset', '')
            if '_removed' in subset:
                continue
            
            split = row.get('split', '')
            if split != 'train':
                continue
            
            code = row.get('code', '').strip()
            script = row.get('script', '').strip()
            
            if not code or not script:
                continue
            
            key = f"{code}_{script}"
            
            # Store UTF-8 bytes count
            try:
                fineweb_data[key] = int(row.get('utf8_bytes', 0))
            except (ValueError, TypeError):
                # Skip if conversion fails
                continue
        
        # Manually add eng_Latn (missing from CSV)
        fineweb_data['eng_Latn'] = 200_000_000_000_000
        
        logging.info(f"Loaded Fine Web 2 data for {len(fineweb_data)} language-script combinations")
        return fineweb_data
        
    except Exception as e:
        logging.error(f"Exception fetching Fine Web 2 data: {e}")
        return {}


def merge_wikidata_info(languages, wikidata_results, glottolog_families, code_tiers, fineweb_data, morphology_types):
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
    for iso, lang in languages.items():
        glottocodes = lang.get("glottocodes", set())
        families = set()
        for glottocode in glottocodes:
            if glottocode and glottocode in glottolog_families:
                family = glottolog_families[glottocode]
                if family:
                    families.add(family)
        if families:
            # Store as list if multiple families, single value if one, None if empty
            lang["families"] = sorted(families) if len(families) > 1 else list(families)[0]
    
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
    languages = load_flores_languages("flores_languages.tsv")
    logging.info(f"Loaded {len(languages)} unique languages")
    
    # Load code tiers
    logging.info("Loading language resource tiers from code_tiers.tsv...")
    code_tiers = load_code_tiers("code_tiers.tsv")
    logging.info(f"Loaded tiers for {len(code_tiers)} languages")

    # Load morphology types
    logging.info("Loading morphology types from morphology.tsv...")
    morphology_types = load_morphology_types("morphology.tsv")
    logging.info(f"Loaded morphology types for {len(morphology_types)} languages")
    
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
    final_data = merge_wikidata_info(languages, wikidata_results, glottolog_families, code_tiers, fineweb_data, morphology_types)
    
    # Output as JSON
    print(json.dumps(final_data, indent=2, ensure_ascii=False))
