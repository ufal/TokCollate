import logging
from pathlib import Path

from attrs import converters, define, field, validators

from tokcollate.utils import load_tokenized_text_file

logger = logging.getLogger(__name__)

TextType = list[list[str]]

LANG_SPEC_LEN = 3


@define(kw_only=True)
class LanguageInfo(dict):
    """TODO"""

    name: str = field(validator=validators.instance_of(str))
    scripts: list[str] = field(validator=validators.instance_of(list))
    glottocodes: list[str] = field(validator=validators.instance_of(list))
    families: str = field(validator=validators.optional(validators.instance_of(str)))
    speakers: int = field(validator=validators.optional(validators.instance_of(int)))
    continent: str = field(validator=validators.optional(validators.instance_of(str)))
    wikipedia: str = field(validator=validators.optional(validators.instance_of(str)))
    tier: int = field(validator=validators.optional(validators.instance_of(int)))
    morphology: str = field(validator=validators.instance_of(str))
    fineweb2: dict[str, int] = field(validator=validators.optional(validators.instance_of(dict)))

    @classmethod
    def create_entry(cls: "LanguageInfo", entry: dict) -> "LanguageInfo":
        """TODO"""
        return cls(**entry)


@define(kw_only=True)
class TokCollateData:
    """TODO"""

    data_dir: Path = field(converter=Path)
    systems: list[str] = field(converter=converters.optional(list), factory=list)
    languages: list[str] = field(converter=converters.optional(list), factory=list)
    languages_info: dict[str, LanguageInfo] = field(
        validator=validators.optional(validators.instance_of(dict)), default=None
    )
    metrics: list["TokCollateMetric"] = field(factory=list)  # noqa: F821
    file_suffix: str = field(validator=validators.instance_of(str), default="txt")
    input_file_stem: str = field(validator=validators.instance_of(str), default="input")
    reference_file_stem: str = field(validator=validators.instance_of(str), default="reference")

    _data: dict = None
    _input_key: str = "__input__"
    _reference_key: str = "__reference__"

    def __attrs_post_init__(self) -> None:
        """TODO"""
        self._data = {}
        logger.info("Loading texts for scoring...")
        for system_label in self.systems:
            if not self.languages:
                filename = f"{system_label}.{self.file_suffix}"
                logger.debug("Loading %s ...", filename)
                self._data[system_label] = load_tokenized_text_file(Path(self.data_dir, filename))
            else:
                logger.debug("Loading %s/{%s}.%s ...", system_label, ",".join(self.languages), self.file_suffix)
                self._data[system_label] = {
                    lang: load_tokenized_text_file(Path(self.data_dir, f"{system_label}", f"{lang}.{self.file_suffix}"))
                    for lang in self.languages
                }

        if self.has_input_text:
            filename = f"{self.input_file_stem}.{self.file_suffix}"
            logger.debug("Loading %s ...", filename)
            self._data[self._input_key] = load_tokenized_text_file(Path(self.data_dir, filename))

        if self.has_reference_text:
            filename = f"{self.reference_file_stem}.{self.file_suffix}"
            self._data[self._reference_key] = load_tokenized_text_file(Path(self.data_dir, filename))

        if self.languages_info is not None:
            # The language info needs to follow a strict data structure. In such case, the language specification also
            # needs to follow it.
            for lang in self.languages:
                lang_split = lang.split("_")
                assert len(lang_split) == LANG_SPEC_LEN
                if lang_split[0] not in self.languages_info:
                    logger.exception(
                        "Language %s not in the provided languages_info JSON file.\nAvailable languages: [%s]",
                        lang_split[0],
                        ",".join(self.languages_info.keys()),
                    )
                if lang_split[1] not in self.languages_info[lang_split[0]]["scripts"]:
                    logger.exception(
                        "Script %s of language %s not listed in the languages_info JSON file.\n"
                        "langages_info['%s'] = %s",
                        lang_split[1],
                        lang_split[0],
                        lang_split[0],
                        self.languages_info[lang_split[0]],
                    )
                if lang_split[2] not in self.languages_info[lang_split[0]]["glottocodes"]:
                    logger.exception(
                        "Glottocode %s of language %s not listed in the languages_info JSON file.\n"
                        "langages_info['%s'] = %s",
                        lang_split[2],
                        lang_split[0],
                        lang_split[0],
                        self.languages_info[lang_split[0]],
                    )

    @property
    def has_input_text(self) -> bool:
        """TODO"""
        return any(m.requires_input_text for m in self.metrics)

    @property
    def has_reference_text(self) -> bool:
        """TODO"""
        return any(m.requires_reference_text for m in self.metrics)

    def get_input_text(self) -> TextType:
        """TODO"""
        if self._input_key in self._data:
            return self._data[self._input_key]
        err_msg = "[self.__class__.__name__] Trying to access unavailable ._input_key"
        raise AttributeError(err_msg)

    def get_reference_text(self) -> TextType:
        """TODO"""
        if self._reference_key in self._data:
            return self._data[self._reference_key]
        err_msg = "[self.__class__.__name__] Trying to access unavailable ._reference_key."
        raise AttributeError(err_msg)

    def get_system_text(self, system_label: str, language: str | None = None) -> TextType:
        """TODO"""
        if language is not None:
            if not self.languages:
                err_msg = "Cannot access a language-specific text of a {self.__name__}(languages=None, **kwargs)"
                raise ValueError(err_msg)
            return self._data[system_label][language]
        if self.languages:
            return [line for lang in self.languages for line in self._data[system_label][lang]]
        return self._data[system_label]

    def get_full_text(self) -> TextType:
        """TODO"""
        text = [line for system_label in self.systems for line in self.get_system_text(system_label)]
        if self.has_input_text:
            text += self.get_input_text()
        if self.has_reference_text:
            text += self.get_reference_text()
        return text
