import React from 'react';
import { FigureConfig, VisualizationData } from '../../types';
import { decodeSentence } from '../../utils/tokenDecoder';

interface TokenizedTextProps {
  config: FigureConfig;
  data: VisualizationData;
}

const TokenizedText: React.FC<TokenizedTextProps> = ({ config, data }) => {
  const [hoveredToken, setHoveredToken] = React.useState<string | null>(null);
  const [hoveredSentenceIdx, setHoveredSentenceIdx] = React.useState<number | null>(null);

  const tokenizations: Record<string, any> | undefined = data.metadata?.tokenizations;

  const selectedTokenizers =
    config.tokenizers && config.tokenizers.length > 0 && tokenizations
      ? config.tokenizers
      : tokenizations ? Object.keys(tokenizations) : [];
  const selectedLanguages =
    config.languages && config.languages.length > 0 ? config.languages : [];

  if (!tokenizations) {
    return <div className="no-data">No tokenizations available for this dataset</div>;
  }

  if (selectedLanguages.length === 0) {
    return <div className="no-data">Select at least one language to display tokenized text</div>;
  }

  const panels: React.ReactNode[] = [];
  for (const tokenizer of selectedTokenizers) {
    const tokData = tokenizations[tokenizer];
    if (!tokData) continue;
    for (const lang of selectedLanguages) {
      const sentences: string[][] | undefined = tokData[lang];
      if (!sentences) continue;
      const from = config.sentenceRange ? config.sentenceRange[0] - 1 : 0;
      const to = config.sentenceRange ? config.sentenceRange[1] : sentences.length;
      const slice = sentences.slice(Math.max(0, from), to);
      panels.push(
        <div key={`${tokenizer}__${lang}`} className="tokenized-text-panel">
          <div className="tokenized-text-header">
            <span className="tokenized-text-tokenizer">{tokenizer}</span>
            <span className="tokenized-text-lang">{lang}</span>
          </div>
          <div className="tokenized-text-body">
            {slice.map((tokens, i) => (
              <div
                key={from + i}
                className={[
                  'tokenized-text-sentence',
                  hoveredSentenceIdx === from + i ? 'tokenized-text-sentence--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => setHoveredSentenceIdx(from + i)}
                onMouseLeave={() => setHoveredSentenceIdx(null)}
              >
                <span className="tokenized-text-idx">{from + i + 1}.</span>{' '}
                {decodeSentence(tokens).map((dt, j, arr) => (
                  <React.Fragment key={j}>
                    <span
                      className={[
                        'tokenized-text-token',
                        dt.isByteLevel ? 'tokenized-text-token--byte' : '',
                        dt.decoded === '' ? 'tokenized-text-token--fragment' : '',
                        hoveredToken === dt.raw ? 'tokenized-text-token--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={
                        dt.isByteLevel && dt.decoded !== dt.raw
                          ? `raw: ${dt.raw}`
                          : undefined
                      }
                      onMouseEnter={() => setHoveredToken(dt.raw)}
                      onMouseLeave={() => setHoveredToken(null)}
                    >
                      {dt.decoded !== '' ? (
                        dt.decoded
                      ) : (
                        <span className="tokenized-text-fragment-placeholder">·</span>
                      )}
                    </span>
                    {j < arr.length - 1 && arr[j + 1].decoded !== '' && ' '}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>,
      );
    }
  }

  if (panels.length === 0) {
    return (
      <div className="no-data">No data for the selected tokenizer/language combination</div>
    );
  }

  return <div className="tokenized-text-container">{panels}</div>;
};

export default TokenizedText;
