import csv
import re
import os
import urllib.request
from collections import defaultdict

"""Match FLORES languages with Joshi et al. (2020) language tiers.

Joshi et al. only provide language names and tiers in a CSV file, the names are
not standardized. This is a best-effort matching script to associate FLORES
languages (with ISO 639-3 codes and glottocodes) with the Joshi et al. tiers.
The unmatched languages are marked with '?' tier and later are manually checked.
"""

# Download tier data if it doesn't exist
tier_file = 'lang2tax.txt'
tier_url = 'https://microsoft.github.io/linguisticdiversity/assets/lang2tax.txt'


if not os.path.exists(tier_file):
    print(f"Downloading {tier_file} from {tier_url}...")
    urllib.request.urlretrieve(tier_url, tier_file)
    print(f"Downloaded {tier_file}")

# Read tier data from file
with open(tier_file, 'r', encoding='utf-8') as f:
    tier_data = f.read()

# Parse tier data
tier_dict = {}
for line in tier_data.strip().split('\n'):
    if ',' in line:
        lang_name, tier = line.rsplit(',', 1)
        lang_name = lang_name.strip().lower()
        tier = tier.strip()
        tier_dict[lang_name] = tier

# Normalize function for better matching
def normalize_name(name):
    # Remove parentheses and their content
    name = re.sub(r'\([^)]*\)', '', name)
    # Convert to lowercase and strip
    name = name.lower().strip()
    # Remove extra whitespace
    name = ' '.join(name.split())
    return name

# Create normalized lookup
normalized_tier_dict = {normalize_name(k): v for k, v in tier_dict.items()}

# Matching function
def find_tier(lang_name):
    # Direct match
    normalized = normalize_name(lang_name)
    if normalized in normalized_tier_dict:
        return normalized_tier_dict[normalized]
    
    # Try to extract main language name before parentheses
    main_name = re.sub(r'\([^)]*\)', '', lang_name).strip().lower()
    if main_name in normalized_tier_dict:
        return normalized_tier_dict[main_name]
    
    # Special matching rules
    lang_lower = lang_name.lower()
    
    # Handle Arabic variants
    if 'arabic' in lang_lower:
        if 'egyptian' in lang_lower:
            return normalized_tier_dict.get('egyptian arabic', '?')
        else:
            return normalized_tier_dict.get('arabic', '?')
    
    # Handle Chinese variants
    if 'chinese' in lang_lower:
        if 'mandarin' in lang_lower:
            return normalized_tier_dict.get('mandarin', '?')
        elif 'cantonese' in lang_lower or 'yue' in lang_lower:
            return normalized_tier_dict.get('cantonese', '?')
        elif 'wu' in lang_lower:
            return normalized_tier_dict.get('wu', '?')
    
    # Handle Kurdish variants
    if 'kurdish' in lang_lower:
        if 'northern' in lang_lower or 'kurmanji' in lang_lower:
            return normalized_tier_dict.get('kurdish (kurmanji)', '?')
        elif 'central' in lang_lower or 'sorani' in lang_lower:
            return normalized_tier_dict.get('kurdish (sorani)', '?')
    
    # Handle Norwegian variants
    if 'norwegian' in lang_lower:
        if 'nynorsk' in lang_lower:
            return normalized_tier_dict.get('norwegian (nynorsk)', '?')
        else:
            return normalized_tier_dict.get('norwegian (bokmål)', '?')
    
    # Handle Panjabi/Punjabi variants
    if 'panjabi' in lang_lower or 'punjabi' in lang_lower:
        if 'eastern' in lang_lower:
            return normalized_tier_dict.get('eastern punjabi', '?')
        elif 'western' in lang_lower:
            return normalized_tier_dict.get('western punjabi', '?')
    
    # Handle Sotho variants
    if 'sotho' in lang_lower:
        if 'northern' in lang_lower:
            return normalized_tier_dict.get('northern sotho', '?')
        elif 'southern' in lang_lower:
            return normalized_tier_dict.get('sesotho', '?')
    
    # Handle Pashto variants
    if 'pashto' in lang_lower:
        return normalized_tier_dict.get('pashto', '?')
    
    # Handle Persian/Dari
    if 'persian' in lang_lower or 'dari' in lang_lower:
        return normalized_tier_dict.get('persian', '?')
    
    # Handle other common cases
    common_mappings = {
        'lhasa tibetan': 'tibetan',
        'standard malay': 'malay',
        'halh mongolian': 'mongolian',
        'khmer': 'khmer',
        'filipino': 'tagalog',
        'haitian creole': 'haitian',
        'mauritian creole': 'mauritian creole',
        'sinhala': 'sinhalese',
        'maithili': 'maithili',
        'azerbaijani': 'azerbaijani',
    }
    
    for key, value in common_mappings.items():
        if key in lang_lower:
            return normalized_tier_dict.get(value, '?')
    
    return '?'

# Generate output
results = []
seen_glottocodes = {}

# Read and parse TSV data from file
tsv_languages = []
with open('flores_languages.tsv', 'r', encoding='utf-8') as f:
    for line in f:
        if line.strip():
            parts = line.strip().split('\t')
            if len(parts) >= 4:
                iso_code = parts[0]
                script = parts[1]
                glottocode = parts[2]
                lang_name = parts[3]
                tsv_languages.append({
                    'iso': iso_code,
                    'script': script,
                    'glottocode': glottocode,
                    'name': lang_name
                })

for lang in tsv_languages:
    glottocode = lang['glottocode']
    iso_code = lang['iso']
    lang_name = lang['name']
    
    tier = find_tier(lang_name)
    
    # Track first occurrence for each glottocode
    if glottocode not in seen_glottocodes:
        seen_glottocodes[glottocode] = (iso_code, tier)
        results.append((iso_code, glottocode, tier))
    elif tier != '?' and seen_glottocodes[glottocode][1] == '?':
        # Update if we found a better match
        seen_glottocodes[glottocode] = (iso_code, tier)
        # Update the result
        for i, (ic, gc, t) in enumerate(results):
            if gc == glottocode:
                results[i] = (iso_code, glottocode, tier)
                break

# Write output to TSV
with open('./code_tiers_automatic.tsv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f, delimiter='\t')
    writer.writerow(['iso_code', 'glottocode', 'tier'])
    for iso_code, glottocode, tier in results:
        writer.writerow([iso_code, glottocode, tier])

print(f"Processed {len(results)} unique glottocodes")
print(f"Matched: {sum(1 for _, _, tier in results if tier != '?')}")
print(f"Unmatched: {sum(1 for _, _, tier in results if tier == '?')}")
print("\nOutput written to: ./code_tiers_automatic.tsv")