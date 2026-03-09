
import tempfile
from io import StringIO

import numpy as np
from attr import define

from tokcollate.data import TokCollateData
from tokcollate.metrics import register_metric
from tokcollate.metrics.tokcollate_metric import TokCollateMultilingualMetric
from tokcollate.utils_alignment import symmetrize_alignment

import eflomal

@register_metric("eflomal")
@define(kw_only=True)
class EflomalScore(TokCollateMultilingualMetric):
    """Measures the Eflomal Score over the (parallel) text vocabulary distributions.

    This metric uses the Eflomal aligner to compute alignment scores between the
    source and target tokens. The final score is computed as the average of the
    forward and reverse alignment scores of the alignment between the source and
    target tokens.

    See https://aclanthology.org/2025.naacl-short.63 for more details.    
    """

    def score(self, data: TokCollateData, system_label: str, src_lang: str, tgt_lang: str) -> float:
        text_src = data.get_system_text(system_label=system_label, language=src_lang)
        text_tgt = data.get_system_text(system_label=system_label, language=tgt_lang)

        aligner = eflomal.Aligner()

        # Create file-like objects from the text variables
        src_data = StringIO("\n".join([" ".join(line) for line in text_src]))
        trg_data = StringIO("\n".join([" ".join(line) for line in text_tgt]))
        
        aligner = eflomal.Aligner()

        # Create temporary files for alignment scores
        with tempfile.NamedTemporaryFile(mode='w', suffix='.fwd.scores', delete=False) as fwd_scores_file, \
                tempfile.NamedTemporaryFile(mode='w', suffix='.rev.scores', delete=False) as rev_scores_file:
            fwd_scores_path = fwd_scores_file.name
            rev_scores_path = rev_scores_file.name

        try:
            aligner.align(
                src_data, trg_data,
                scores_filename_fwd=fwd_scores_path,
                scores_filename_rev=rev_scores_path)
            
            # Read the alignment scores
            with open(fwd_scores_path, 'r', encoding='utf-8') as f:
                fwd_scores = f.read()
            with open(rev_scores_path, 'r', encoding='utf-8') as f:
                rev_scores = f.read()

        finally:
            # Clean up temporary files
            import os
            if os.path.exists(fwd_scores_path):
                os.unlink(fwd_scores_path)
            if os.path.exists(rev_scores_path):
                os.unlink(rev_scores_path)

        fwd_scores_list = [float(score) for score in fwd_scores.splitlines()]
        rev_scores_list = [float(score) for score in rev_scores.splitlines()]

        # Filter out inf values and compute mean (nanmean handles NaN values)
        fwd_scores_filtered = [s for s in fwd_scores_list if not np.isinf(s)]
        rev_scores_filtered = [s for s in rev_scores_list if not np.isinf(s)]

        fwd_mean = np.nanmean(fwd_scores_filtered) if fwd_scores_filtered else np.nan
        rev_mean = np.nanmean(rev_scores_filtered) if rev_scores_filtered else np.nan

        return (fwd_mean + rev_mean) / 2

    def score_batched(self, data: TokCollateData, system_label: str, languages: list[str]) -> np.ndarray:
        result = np.zeros((len(languages), len(languages)))
        for i, src_lang in enumerate(languages):
            for j, tgt_lang in enumerate(languages):
                if i <= j:
                    score = self.score(data, system_label, src_lang, tgt_lang)
                    result[i, j] = score
                    result[j, i] = score  # Symmetric score
        return result