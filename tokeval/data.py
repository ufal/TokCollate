import logging
from pathlib import Path

from attrs import converters, define, field, validators

from tokeval.utils import load_tokenized_text_file

logger = logging.getLogger(__name__)

TextType = list[list[str]]


@define(kw_only=True)
class TokEvalData:
    """TODO"""

    data_dir: Path = field(converter=Path)
    systems: list[str] = field(converter=converters.optional(list), factory=list)
    languages: list[str] = field(converter=converters.optional(list), factory=list)
    metrics: list["TokEvalMetric"] = field(factory=list)  # noqa: F821
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
        for system in self.systems:
            if not self.languages:
                filename = f"{system}.{self.file_suffix}"
                logger.debug("Loading %s ...", filename)
                self._data[system] = load_tokenized_text_file(Path(self.data_dir, filename))
            else:
                logger.debug("Loading %s.{%s}.%s ...", system, ",".join(self.languages), self.file_suffix)
                self._data[system] = {
                    lang: load_tokenized_text_file(Path(self.data_dir, f"{system}.{lang}.{self.file_suffix}"))
                    for lang in self.languages
                }

        if self.has_input_text:
            filename = f"{self.input_file_stem}.{self.file_suffix}"
            logger.debug("Loading %s ...", filename)
            self._data[self._input_key] = load_tokenized_text_file(Path(self.data_dir, filename))

        if self.has_reference_text:
            filename = f"{self.reference_file_stem}.{self.file_suffix}"
            self._data[self._reference_key] = load_tokenized_text_file(Path(self.data_dir, filename))

    @property
    def has_input_text(self) -> bool:
        """TODO"""
        return any(m.requires_input_text for m in self.metrics.values())

    @property
    def has_reference_text(self) -> bool:
        """TODO"""
        return any(m.requires_reference_text for m in self.metrics.values())

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

    def get_system_text(self, system: str, language: str | None = None) -> TextType:
        """TODO"""
        if language is not None:
            if not self.languages:
                err_msg = "Cannot access a language-specific text of a {self.__name__}(languages=None, **kwargs)"
                raise ValueError(err_msg)
            return self._data[system][language]
        if self.languages:
            return [line for lang in self.languages for line in self._data[system][lang]]
        return self._data[system]

    def get_full_text(self) -> TextType:
        """TODO"""
        text = [line for system in self.systems for line in self.get_system_text(system)]
        if self.has_input_text:
            text += self.get_input_text()
        if self.has_reference_text:
            text += self.get_reference_text()
        return text
