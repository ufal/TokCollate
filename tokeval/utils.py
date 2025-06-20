import gzip
from collections import Counter
from pathlib import Path
from typing import TextIO

import numpy as np


def open_file(file: Path, mode: str) -> TextIO:
    """Return a correct file handle based on the file suffix."""
    assert mode in ("r", "w")
    if file.suffix == ".gz":
        return gzip.open(file, f"{mode}t")
    return file.open(f"{mode}t")


def load_dataset_file(file: Path) -> list[str]:
    """Load dataset file as a list of line strings."""
    with open_file(file, "r") as fh:
        return fh.readlines()


def load_tokenized_dataset_file(file: Path, token_separator: str = " ") -> list[list[str]]:
    """Load dataset file as a list of lists of sentence tokens.

    TODO
    """
    return [line.split(token_separator) for line in load_dataset_file(file)]


def file_path(path_str: str) -> Path:
    """A file_path type definition for argparse."""
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(path)
    return path.absolute()


def get_vocabulary(corpus: list[list[str]]) -> Counter:
    """TODO"""
    return Counter(tok for line in corpus for tok in line)


def get_unigram_frequencies(corpus: list[list[str]]) -> np.ndarray:
    """TODO"""
    return np.array([tok[1] for tok in get_vocabulary(corpus).most_common()])


def get_unigram_distribution(corpus: list[list[str]]) -> np.ndarray:
    """TODO"""
    unigram_counts = get_unigram_frequencies(corpus)
    return unigram_counts / unigram_counts.sum()


def shannon_entropy(corpus: list[list[str]]) -> float:
    """TODO"""
    unigram_probs = get_unigram_distribution(corpus)
    return -np.sum(unigram_probs * np.log2(unigram_probs))
