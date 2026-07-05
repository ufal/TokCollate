import { VisualizationData, MetricDimensionality } from '../types';

// Type for TypedArray (Float64Array, etc)
type TypedArray = Float64Array | Float32Array | Int32Array | Uint32Array | Uint8Array;

/**
 * Configuration for a visualization type's constraints
 */
export interface ConstraintRange {
  min: number;
  max: number;
  dimension?: 1 | 2 | 3 | 'both'; // For metrics: 1D, 2D, 3D, or both
}

export interface VisualizationConstraints {
  metrics: ConstraintRange;
  tokenizers: ConstraintRange;
  languages: ConstraintRange;
}

/**
 * Validation result for a visualization configuration
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Configuration passed to visualization transform functions
 */
export interface VisualizationConfig {
  metrics: string[];
  tokenizers: string[];
  languages: string[];
}

/**
 * Abstract base class for visualization types
 */
export abstract class GraphType {
  abstract typeId: string;
  abstract displayName: string;
  abstract description: string;
  abstract constraints: VisualizationConstraints;

  /**
   * Transform raw data into chart data format
   */
  abstract transform(data: VisualizationData, config: VisualizationConfig): any[];

  /**
   * Validate configuration against constraints
   */
  validate(config: VisualizationConfig, metricDimensionality: MetricDimensionality): ValidationResult {
    const errors: string[] = [];

    // Validate metric count
    if (config.metrics.length < this.constraints.metrics.min) {
      errors.push(
        `Minimum ${this.constraints.metrics.min} metric(s) required, got ${config.metrics.length}`
      );
    }
    if (config.metrics.length > this.constraints.metrics.max) {
      errors.push(
        `Maximum ${this.constraints.metrics.max} metric(s) allowed, got ${config.metrics.length}`
      );
    }

    // Validate metric dimensionality
    if (this.constraints.metrics.dimension && this.constraints.metrics.dimension !== 'both') {
      const invalidMetrics = config.metrics.filter(
        (m) => metricDimensionality[m] !== this.constraints.metrics.dimension
      );
      if (invalidMetrics.length > 0) {
        errors.push(
          `This visualization requires ${this.constraints.metrics.dimension}D metrics, but got: ${invalidMetrics.join(', ')}`
        );
      }
    }

    // Validate tokenizer count
    if (config.tokenizers.length < this.constraints.tokenizers.min) {
      errors.push(
        `Minimum ${this.constraints.tokenizers.min} tokenizer(s) required, got ${config.tokenizers.length}`
      );
    }
    if (config.tokenizers.length > this.constraints.tokenizers.max) {
      errors.push(
        `Maximum ${this.constraints.tokenizers.max} tokenizer(s) allowed, got ${config.tokenizers.length}`
      );
    }

    // Validate language count
    if (config.languages.length < this.constraints.languages.min) {
      errors.push(
        `Minimum ${this.constraints.languages.min} language(s) required, got ${config.languages.length}`
      );
    }
    if (config.languages.length > this.constraints.languages.max) {
      errors.push(
        `Maximum ${this.constraints.languages.max} language(s) allowed, got ${config.languages.length}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract data and shape from either a raw npyjs object `{data, shape}` or
   * a plain JS array. Centralises the repeated unpacking pattern in transform().
   */
  protected extractNpyArray(array: any): { data: TypedArray | number[]; shape: number[] } {
    if (array?.data && array?.shape) {
      return { data: array.data as TypedArray, shape: array.shape as number[] };
    }
    if (Array.isArray(array)) {
      return { data: array, shape: [array.length] };
    }
    return { data: [], shape: [] };
  }

  /**
   * Return the full tokenizer and language index lists from dataset metadata.
   * Both transform() implementations use these lists to translate selection
   * names into flat-array positions.
   */
  protected getMetadataLists(data: VisualizationData): {
    allTokenizers: string[];
    allLanguages: string[];
  } {
    return {
      allTokenizers: data.metadata?.tokenizers ?? [],
      allLanguages: data.metadata?.languages ?? [],
    };
  }

  /**
   * Return the subset of `metrics` that are compatible with this graph type.
   *
   * The configurator calls this to hide metrics that would always fail
   * validation, giving users a cleaner selection UI. The default allows all
   * metrics; subclasses narrow this when they require a specific array
   * dimensionality.
   */
  getCompatibleMetrics(metrics: string[], _dimensionality: MetricDimensionality): string[] {
    return metrics;
  }
}

/**
 * Scatter plot visualization for correlating two 2D (monolingual) metrics
 */
export class MonolingualMetricPairCorrelationGraphType extends GraphType {
  typeId = 'metric-pair-correlation-mono';
  displayName = 'Metric Pair Correlation (Monolingual)';
  description = 'Scatterplot showing the relationship between two 2D (per-language) metrics. Choose X and Y axes, tokenizers, and languages.';

  constraints: VisualizationConstraints = {
    metrics: { min: 2, max: 2, dimension: 2 },
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 1, max: Infinity },
  };

  override getCompatibleMetrics(metrics: string[], dimensionality: MetricDimensionality): string[] {
    return metrics.filter((m) => dimensionality[m] === 2);
  }

  override validate(config: VisualizationConfig, metricDimensionality: MetricDimensionality): ValidationResult {
    const base = super.validate(config, metricDimensionality);
    const errors = [...base.errors];

    if (config.metrics.length === 2) {
      const invalid = config.metrics.filter((m) => metricDimensionality[m] !== 2);
      if (invalid.length > 0) {
        errors.push(
          `Monolingual Metric Pair Correlation requires 2D metrics, but got: ${invalid.map((m) => `${m} (${metricDimensionality[m] ?? 'unknown'}D)`).join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  transform(data: VisualizationData, config: VisualizationConfig): any[] {
    if (config.metrics.length !== 2) return [];

    const [metricX, metricY] = config.metrics;
    const { data: xData, shape: xShape } = this.extractNpyArray(data.metrics?.[metricX]);
    const { data: yData, shape: yShape } = this.extractNpyArray(data.metrics?.[metricY]);

    if (xShape.length !== 2 || yShape.length !== 2) return [];

    const { allTokenizers, allLanguages } = this.getMetadataLists(data);
    const chartData: any[] = [];

    for (const tokenizer of config.tokenizers) {
      const tokIdx = allTokenizers.indexOf(tokenizer);
      if (tokIdx < 0) continue;
      for (const language of config.languages) {
        const langIdx = allLanguages.indexOf(language);
        if (langIdx < 0) continue;
        const xVal = xData[tokIdx * xShape[1] + langIdx];
        const yVal = yData[tokIdx * yShape[1] + langIdx];
        if (xVal !== undefined && yVal !== undefined) {
          chartData.push({ tokenizer, language, [metricX]: xVal, [metricY]: yVal });
        }
      }
    }

    return chartData;
  }
}

/**
 * Scatter plot visualization for correlating two 3D (bilingual) metrics
 */
export class BilingualMetricPairCorrelationGraphType extends GraphType {
  typeId = 'metric-pair-correlation-bi';
  displayName = 'Metric Pair Correlation (Bilingual)';
  description = 'Scatterplot showing the relationship between two 3D (per-language-pair) metrics. Choose X and Y axes, tokenizers, and languages.';

  constraints: VisualizationConstraints = {
    metrics: { min: 2, max: 2, dimension: 3 },
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 2, max: Infinity },
  };

  override getCompatibleMetrics(metrics: string[], dimensionality: MetricDimensionality): string[] {
    return metrics.filter((m) => dimensionality[m] === 3);
  }

  override validate(config: VisualizationConfig, metricDimensionality: MetricDimensionality): ValidationResult {
    const base = super.validate(config, metricDimensionality);
    const errors = [...base.errors];

    if (config.metrics.length === 2) {
      const invalid = config.metrics.filter((m) => metricDimensionality[m] !== 3);
      if (invalid.length > 0) {
        errors.push(
          `Bilingual Metric Pair Correlation requires 3D metrics, but got: ${invalid.map((m) => `${m} (${metricDimensionality[m] ?? 'unknown'}D)`).join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  transform(data: VisualizationData, config: VisualizationConfig): any[] {
    if (config.metrics.length !== 2) return [];

    const [metricX, metricY] = config.metrics;
    const { data: xData, shape: xShape } = this.extractNpyArray(data.metrics?.[metricX]);
    const { data: yData, shape: yShape } = this.extractNpyArray(data.metrics?.[metricY]);

    if (xShape.length !== 3 || yShape.length !== 3) return [];

    const { allTokenizers, allLanguages } = this.getMetadataLists(data);
    const chartData: any[] = [];

    for (const tokenizer of config.tokenizers) {
      const tokIdx = allTokenizers.indexOf(tokenizer);
      if (tokIdx < 0) continue;
      for (const lang1 of config.languages) {
        const l1Idx = allLanguages.indexOf(lang1);
        if (l1Idx < 0) continue;
        for (const lang2 of config.languages) {
          if (lang1 === lang2) continue;
          const l2Idx = allLanguages.indexOf(lang2);
          if (l2Idx < 0) continue;
          const xVal = xData[tokIdx * xShape[1] * xShape[2] + l1Idx * xShape[2] + l2Idx];
          const yVal = yData[tokIdx * yShape[1] * yShape[2] + l1Idx * yShape[2] + l2Idx];
          if (xVal !== undefined && yVal !== undefined) {
            chartData.push({
              tokenizer,
              languagePair: `${lang1}-${lang2}`,
              [metricX]: xVal,
              [metricY]: yVal,
            });
          }
        }
      }
    }

    return chartData;
  }
}

/**
 * Table visualization for displaying metric matrices.
 * Supports 2D (tokenizer × language) and 3D (tokenizer × language × language) metrics.
 */
export class MetricTableGraphType extends GraphType {
  typeId = 'metric-table';
  displayName = 'Metric Table';
  description = 'Table displaying a metric matrix with rows as tokenizers and columns as languages (or language-pairs for 3D metrics).';

  constraints: VisualizationConstraints = {
    metrics: { min: 1, max: 1, dimension: 'both' },
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 1, max: Infinity },
  };

  /** Only matrix metrics (2D or 3D) can be meaningfully displayed as a table. */
  override getCompatibleMetrics(metrics: string[], dimensionality: MetricDimensionality): string[] {
    return metrics.filter((m) => dimensionality[m] === 2 || dimensionality[m] === 3);
  }

  transform(data: VisualizationData, config: VisualizationConfig): any {
    if (config.metrics.length !== 1) {
      return { rows: [], columns: [], data: [], error: 'Metric Table requires exactly 1 metric' };
    }

    const metricName = config.metrics[0];
    const metricArray = data.metrics?.[metricName];
    if (!metricArray) {
      const available = Object.keys(data.metrics || {}).join(', ');
      return { rows: [], columns: [], data: [], error: `Metric "${metricName}" not found. Available: ${available}` };
    }

    const { data: arrayData, shape } = this.extractNpyArray(metricArray);
    if (!shape.length) {
      return { rows: [], columns: [], data: [], error: 'Could not determine array shape' };
    }

    const { tokenizers: selectedTokenizers, languages: selectedLanguages } = config;
    if (!selectedTokenizers.length) return { rows: [], columns: [], data: [], error: 'No tokenizers selected' };
    if (!selectedLanguages.length) return { rows: [], columns: [], data: [], error: 'No languages selected' };

    const { allTokenizers, allLanguages } = this.getMetadataLists(data);

    if (shape.length === 2) {
      // 2D metric: shape [tokenizer, language]
      const tableRows: any[][] = [];
      for (const tokenizer of selectedTokenizers) {
        const tokPos = allTokenizers.indexOf(tokenizer);
        if (tokPos < 0) continue;
        const row: any[] = [];
        for (const language of selectedLanguages) {
          const langPos = allLanguages.indexOf(language);
          if (langPos < 0) continue;
          const value = arrayData[tokPos * shape[1] + langPos];
          row.push({
            tokenizer,
            column: language,
            value,
            formatted: value != null ? Number(value).toFixed(4) : 'N/A',
          });
        }
        tableRows.push(row);
      }
      return { rows: selectedTokenizers, columns: selectedLanguages, data: tableRows, rowHeader: metricName };
    }

    if (shape.length === 3) {
      // 3D metric: shape [tokenizer, lang1, lang2] — columns become language pairs
      const languagePairs: string[] = [];
      for (const l1 of selectedLanguages) {
        for (const l2 of selectedLanguages) {
          if (l1 !== l2) languagePairs.push(`${l1}-${l2}`);
        }
      }
      const tableRows: any[][] = [];
      for (const tokenizer of selectedTokenizers) {
        const tokPos = allTokenizers.indexOf(tokenizer);
        if (tokPos < 0) continue;
        const row: any[] = [];
        for (const l1 of selectedLanguages) {
          const l1Pos = allLanguages.indexOf(l1);
          if (l1Pos < 0) continue;
          for (const l2 of selectedLanguages) {
            if (l1 === l2) continue;
            const l2Pos = allLanguages.indexOf(l2);
            if (l2Pos < 0) continue;
            const value = arrayData[tokPos * shape[1] * shape[2] + l1Pos * shape[2] + l2Pos];
            row.push({
              tokenizer,
              column: `${l1}-${l2}`,
              value,
              formatted: value != null ? Number(value).toFixed(4) : 'N/A',
            });
          }
        }
        tableRows.push(row);
      }
      return { rows: selectedTokenizers, columns: languagePairs, data: tableRows, rowHeader: metricName };
    }

    return { rows: [], columns: [], data: [], error: `Unsupported array shape: ${shape.length}D. Expected 2D or 3D.` };
  }
}

/**
 * Tokenized text visualization scaffold.
 *
 * For now this type only configures tokenizers/languages (plus shared
 * language filters in the configurator). Rendering implementation on the
 * left panel will be added separately.
 */
export class TokenizedTextGraphType extends GraphType {
  typeId = 'tokenized-text';
  displayName = 'Tokenized Text';
  description = 'Inspect tokenized text for selected tokenizers and languages.';

  constraints: VisualizationConstraints = {
    metrics: { min: 0, max: 0, dimension: 'both' },
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 1, max: Infinity },
  };

  transform(_data: VisualizationData, _config: VisualizationConfig): any[] {
    return [];
  }
}

/**
 * Registry of all available visualization types
 */
const GRAPH_TYPE_REGISTRY: Map<string, GraphType> = new Map();

/**
 * Register a visualization type in the registry
 */
export const registerGraphType = (graphType: GraphType): void => {
  GRAPH_TYPE_REGISTRY.set(graphType.typeId, graphType);
  console.log(`Registered graph type: ${graphType.typeId}`);
};

/**
 * Get a visualization type by ID
 */
export const getGraphType = (typeId: string): GraphType | undefined => {
  return GRAPH_TYPE_REGISTRY.get(typeId);
};

/**
 * Get all available visualization types
 */
export const getAvailableGraphTypes = (): GraphType[] => {
  return Array.from(GRAPH_TYPE_REGISTRY.values());
};

/**
 * Initialize the registry with built-in visualization types
 */
const initializeRegistry = () => {
  registerGraphType(new MonolingualMetricPairCorrelationGraphType());
  registerGraphType(new BilingualMetricPairCorrelationGraphType());
  registerGraphType(new MetricTableGraphType());
  registerGraphType(new TokenizedTextGraphType());
  // Future visualization types can be added here:
  // registerGraphType(new HeatmapGraphType());
};

// Initialize on module load
initializeRegistry();
