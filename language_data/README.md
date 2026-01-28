# Language data

This directory contains contains `languages.json`, a database of language features.

The languages are are indexed by their [ISO 639-3 codes](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes). The item contain the following information:

* Name of the language in English

* List of scripts that this language uses in the Flores+ dataset as [ISO 15924 codes](https://en.wikipedia.org/wiki/ISO_15924)

* List of glottocodes associated with the languages (typically just ones, but variants of some languages have different glottocodes)

* Language family according to Glottolog

* Number of speakers according to WikiData

* Continent of origin according to WikiData

* Link to Wikipedia page

* Resource tier following [Joshi et al. (2020)](https://aclanthology.org/2020.acl-main.560)

* Size of the [FineWeb 2 corpus](https://huggingface.co/collections/HuggingFaceFW/fineweb2) in the respective languages

## Flores+ languages

We consider languages that have development set in the [Flores+ dataset](https://huggingface.co/datasets/openlanguagedata/flores_plus). Each language is identified by their [ISO 639-3 code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes) of the language, [ISO 15924 code](https://en.wikipedia.org/wiki/ISO_15924) for the script and the [Glottolog](https://glottolog.org) code is occasionally needed for disambiguation.

The list of Flores+ languages is in `flores_languages.tsv`.

## Resource Tiers Joshi et al., 2020

[Joshi et al. (2020)](https://aclanthology.org/2020.acl-main.560) categorized world's languages into 6 tiers based on how much linguistic resources and plain text resources were available for the languages in 2020. Tier 5 languages are six high-resource languages (English, Spanish, German, Japanese, French, Arabic, Mandarin), for tier 0 languages, there only limited resources.

The language categorization is provided in the format `name,tier`. However, some languages are known under several names. Therefore, we try to automatically match the languages using `match_flores_with_joshi_tiers.py`. We resolve non-matching languages manually. The assignment of the languages to the tiers is in `code_tiers.tsv`.

## Using WikiData and Glottolog API to collect more information

Finally, we use WikiData and Glottolog to get the additional information about the languages and combine it with information stored in the files in this repository. Additionally, it downloads the statistics about on how much data is available for the language-script combination in the FineWeb 2 corpus.