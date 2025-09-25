import gzip
import logging
from collections import Counter
from pathlib import Path
from typing import TextIO

import numpy as np

logger = logging.getLogger(__name__)


def open_file(file: Path, mode: str) -> TextIO:
    """Return a correct file handle based on the file suffix."""
    assert mode in ("r", "w")
    if file.suffix == ".gz":
        return gzip.open(file, f"{mode}t")
    return file.open(f"{mode}t")


def load_text_file(file: Path) -> tuple[str]:
    """Load dataset file as a list of line strings."""
    with open_file(file, "r") as fh:
        return fh.readlines()

def concat_files(input_files: list[Path], output_file: Path) -> None:
    """Concatenate files from a given list."""
    with open_file(output_file, "w") as out_fh:
        for input_file in input_files:
            with open_file(input_file, "r") as in_fh:
                for line in in_fh:
                    print(line, end="", file=out_fh)


def remove_dir(directory: Path) -> None:
    """Remove the directory and its contents recursively."""
    for file_path in directory.iterdir():
        try:
            if file_path.is_file() or file_path.is_symlink():
                file_path.unlink()
            elif file_path.is_dir():
                remove_dir(file_path)
        except Exception as err:  # noqa: BLE001
            logger.error("Failed to delete %s. Reason: %s", file_path, err)  # noqa: TRY400


def load_tokenized_text_file(file: Path, token_separator: str | None = None) -> list[list[str]]:
    """Load dataset file as a list of lists of sentence tokens.

    Args:
        file (Path): location of the dataset file.
        token_separator (str): character used to indicate token boundaries
    """
    text = [line.rstrip("\n").split(token_separator) for line in load_text_file(file)]
    text = [[w.strip() for w in line if w.strip] for line in text]
    return [line for line in text if line]


def file_path(path_str: str) -> Path:
    """A file_path type definition for argparse."""
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(path)
    return path.absolute()


def get_vocabulary(text: list[list[str]]) -> Counter:
    """Return a token vocabulary given the tokenized input text."""
    return Counter(tok for line in text for tok in line)


def get_unigram_frequencies(text: list[list[str]], vocab: Counter | None = None) -> np.ndarray:
    """Return a sorted array of vocabulary token frequencies."""
    if vocab is None:
        return np.array([tok[1] for tok in get_vocabulary(text).most_common()])
    text_vocab = get_vocabulary(text)
    return np.array([text_vocab[tok[0]] for tok in vocab.most_common()])


def get_unigram_distribution(text: list[list[str]], vocab: Counter | None = None) -> np.ndarray:
    """Return the token probability distribution of a given text."""
    unigram_counts = get_unigram_frequencies(text, vocab=vocab)
    return unigram_counts / unigram_counts.sum()
