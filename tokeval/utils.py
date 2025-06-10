import gzip
import numpy as np
from pathlib import Path
from typing import Dict, List, TextIO


def open_file(file: Path, mode: str) -> TextIO:
    """Return a correct file handle based on the file suffix."""
    assert mode in ("r", "w")
    if file.suffix == ".gz":
        return gzip.open(file, f"{mode}t")
    return file.open(f"{mode}t")


def load_dataset_file(file: Path) -> List[str]:
    """Load dataset file as a list of line strings."""
    with open_file(file, "r") as fh:
        return fh.readlines()


def file_path(path_str: str) -> Path:
    """A file_path type definition for argparse."""
    path = Path(path_str)
    if not path.exists():
        raise FileNotFoundError(path)
    return path.absolute()


def get_vocabulary(corpus: List[str], token_separator: str = " ") -> Dict[str, int]:
    """TODO"""
    vocab = {}
    for line in corpus:
        line = line.strip()
        for tok in line.split(token_separator):
            if tok in vocab:
                vocab[tok] += 1
            else:
                vocab[tok] = 1
    return vocab


def get_unigram_frequencies(corpus: List[str], token_separator: str = " ") -> np.ndarray:
    """TODO"""
    vocab = get_vocabulary(corpus, token_separator)
    return np.array(sorted(vocab.values(), reverse=True))


def get_unigram_distribution(corpus: List[str], token_separator: str = " ") -> np.ndarray:
    """TODO"""
    unigram_counts = get_unigram_frequencies(corpus, token_separator)
    return unigram_counts / unigram_counts.sum()
