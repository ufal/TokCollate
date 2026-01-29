import { VisualizationData, MetricDimensionality } from '../types';

// Type for TypedArray (Float64Array, etc)
type TypedArray = Float64Array | Float32Array | Int32Array | Uint32Array | Uint8Array;

/**
 * Configuration for a visualization type's constraints
 */
export interface ConstraintRange {
  min: number;
  max: number;
  dimension?: 1 | 2 | 'both'; // For metrics: 1D, 2D, or both
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
}

/**
 * Scatter plot visualization for correlating two metrics
 */
export class MetricPairCorrelationGraphType extends GraphType {
  typeId = 'metric-pair-correlation';
  displayName = 'Metric Pair Correlation';
  description = 'Scatterplot showing the relationship between two selected metrics. Choose X and Y axes, tokenizers, and languages.';

  constraints: VisualizationConstraints = {
    metrics: { min: 2, max: 2, dimension: 'both' }, // Allow any two metrics (1D or 2D)
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 1, max: Infinity },
  };

  transform(data: VisualizationData, config: VisualizationConfig): any[] {
    if (!config.metrics || config.metrics.length !== 2) {
      console.error('Metric Pair Correlation requires exactly 2 metrics (X and Y axes)');
      return [];
    }

    const [metricX, metricY] = config.metrics;
    const chartData: any[] = [];

    // Extract numpy arrays for both metrics
    let xArray = data.metrics?.[metricX];
    let yArray = data.metrics?.[metricY];

    if (!xArray || !yArray) {
      console.error('One or both metrics not found in data');
      return [];
    }

    // Extract TypedArray and shape from npyjs objects
    let xData: TypedArray | number[] = [];
    let xShape: number[] = [];
    let yData: TypedArray | number[] = [];
    let yShape: number[] = [];

    if (xArray.data && xArray.shape) {
      xData = xArray.data;
      xShape = xArray.shape;
    } else if (Array.isArray(xArray)) {
      xData = xArray;
      xShape = [xArray.length];
    }

    if (yArray.data && yArray.shape) {
      yData = yArray.data;
      yShape = yArray.shape;
    } else if (Array.isArray(yArray)) {
      yData = yArray;
      yShape = [yArray.length];
    }

    console.log('[MetricPairCorrelation] Metric X shape:', xShape);
    console.log('[MetricPairCorrelation] Metric Y shape:', yShape);

    // For 2D metrics: (tokenizers, languages)
    // Extract values at matching tokenizer/language indices
    if (xShape.length === 2 && yShape.length === 2) {
      const numLanguagesX = xShape[1];
      const numLanguagesY = yShape[1];

      for (const tokenizer of config.tokenizers) {
        for (const language of config.languages) {
          const tokIdx = config.tokenizers.indexOf(tokenizer);
          const langIdx = config.languages.indexOf(language);

          if (tokIdx >= 0 && langIdx >= 0) {
            const xIndex = tokIdx * numLanguagesX + langIdx;
            const yIndex = tokIdx * numLanguagesY + langIdx;

            const xVal = xData[xIndex];
            const yVal = yData[yIndex];

            if (xVal !== undefined && yVal !== undefined) {
              chartData.push({
                tokenizer,
                language,
                [metricX]: xVal,
                [metricY]: yVal,
              });
            }
          }
        }
      }
    } else if (xShape.length === 3 && yShape.length === 3) {
      // For 3D metrics: (tokenizers, language1, language2)
      // Extract values at matching tokenizer/language pair indices
      const numLang1X = xShape[1];
      const numLang2X = xShape[2];
      const numLang1Y = yShape[1];
      const numLang2Y = yShape[2];

      for (const tokenizer of config.tokenizers) {
        for (let i = 0; i < config.languages.length; i++) {
          for (let j = 0; j < config.languages.length; j++) {
            const lang1 = config.languages[i];
            const lang2 = config.languages[j];
            const tokIdx = config.tokenizers.indexOf(tokenizer);

            if (tokIdx >= 0) {
              const xIndex = tokIdx * (numLang1X * numLang2X) + i * numLang2X + j;
              const yIndex = tokIdx * (numLang1Y * numLang2Y) + i * numLang2Y + j;

              const xVal = xData[xIndex];
              const yVal = yData[yIndex];

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
      }
    } else {
      console.error(
        `Unsupported metric dimensionality: X is ${xShape.length}D, Y is ${yShape.length}D`
      );
      return [];
    }

    console.log('[MetricPairCorrelation] Generated', chartData.length, 'data points');
    return chartData;
  }
}

/**
 * Table visualization for displaying metric matrices
 * Supports 2D (tokenizer x language) and 3D (tokenizer x language x language) matrices
 */
export class MetricTableGraphType extends GraphType {
  typeId = 'metric-table';
  displayName = 'Metric Table';
  description = 'Table displaying a metric matrix with rows as tokenizers and columns as languages (or language-pairs for 3D metrics).';

  constraints: VisualizationConstraints = {
    metrics: { min: 1, max: 1, dimension: 'both' }, // Exactly 1 metric (can be 1D or 2D)
    tokenizers: { min: 1, max: Infinity },
    languages: { min: 1, max: Infinity },
  };

  transform(data: VisualizationData, config: VisualizationConfig): any {
    if (!config.metrics || config.metrics.length !== 1) {
      console.error('Metric Table requires exactly 1 metric');
      return { rows: [], columns: [], data: [], error: 'Metric Table requires exactly 1 metric' };
    }

    const metricName = config.metrics[0];
    console.log('[MetricTable] Looking for metric:', metricName);
    console.log('[MetricTable] Available metrics:', Object.keys(data.metrics || {}));
    console.log('[MetricTable] Selected tokenizers:', config.tokenizers);
    console.log('[MetricTable] Selected languages:', config.languages);
    
    // The metrics object contains the raw numpy arrays from npyjs
    let metricArray = data.metrics?.[metricName];
    
    if (!metricArray) {
      console.error(`Metric ${metricName} not found in data`);
      console.error('Available keys:', Object.keys(data.metrics || {}));
      return { rows: [], columns: [], data: [], error: `Metric "${metricName}" not found in loaded data. Available metrics: ${Object.keys(data.metrics || {}).join(', ')}` };
    }

    console.log('[MetricTable] Found metric:', metricName);
    console.log('[MetricTable] metricArray type:', typeof metricArray);
    console.log('[MetricTable] metricArray.shape:', metricArray.shape);

    // Extract the array data from npyjs array object
    let arrayData: TypedArray | number[] = [];
    let shape: number[] = [];
    
    if (metricArray.data && metricArray.shape) {
      arrayData = metricArray.data;
      shape = metricArray.shape;
    } else if (Array.isArray(metricArray)) {
      arrayData = metricArray;
      shape = [metricArray.length, 1];
    }

    console.log('[MetricTable] Array shape:', shape);
    console.log('[MetricTable] Array data length:', arrayData.length);

    if (shape.length === 0) {
      console.error('[MetricTable] Could not determine array shape');
      return { rows: [], columns: [], data: [], error: 'Could not determine array shape from metric data' };
    }

    // Filter tokenizers and languages
    const selectedTokenizers = config.tokenizers;
    const selectedLanguages = config.languages;

    if (selectedTokenizers.length === 0) {
      return { rows: [], columns: [], data: [], error: 'No tokenizers selected' };
    }

    if (selectedLanguages.length === 0) {
      return { rows: [], columns: [], data: [], error: 'No languages selected' };
    }

    // Build the table based on array dimensionality
    let tableData: any = {
      rows: selectedTokenizers,
      columns: selectedLanguages,
      data: [],
    };

    if (shape.length === 2) {
      // 2D array: (tokenizers, languages)
      console.log('[MetricTable] Processing 2D metric (tokenizers x languages)');
      const numTokenizers = shape[0];
      const numLanguages = shape[1];

      console.log(`[MetricTable] Array has ${numTokenizers} tokenizers, ${numLanguages} languages`);
      console.log(`[MetricTable] Selected ${selectedTokenizers.length} tokenizers, ${selectedLanguages.length} languages`);

      // Get the full tokenizer and language lists from metadata
      const allTokenizers = data.metadata?.tokenizers || [];
      const allLanguages = data.metadata?.languages || [];
      
      console.log('[MetricTable] All tokenizers:', allTokenizers);
      console.log('[MetricTable] All languages:', allLanguages);

      for (let tokIdx = 0; tokIdx < selectedTokenizers.length; tokIdx++) {
        const tokenizer = selectedTokenizers[tokIdx];
        const row: any[] = [];
        
        // Find the actual position of this tokenizer in the full array
        const tokPosition = allTokenizers.indexOf(tokenizer);
        if (tokPosition === -1) {
          console.warn(`[MetricTable] Tokenizer "${tokenizer}" not found in metadata`);
          continue;
        }
        
        for (let langIdx = 0; langIdx < selectedLanguages.length; langIdx++) {
          const language = selectedLanguages[langIdx];
          
          // Find the actual position of this language in the full array
          const langPosition = allLanguages.indexOf(language);
          if (langPosition === -1) {
            console.warn(`[MetricTable] Language "${language}" not found in metadata`);
            continue;
          }
          
          // Calculate the index in the flat array (row-major order)
          // index = tokenizer_position * numLanguages + language_position
          const arrayIndex = tokPosition * numLanguages + langPosition;
          const value = arrayData[arrayIndex];
          
          console.log(`[MetricTable] Accessing [${tokPosition}, ${langPosition}] -> array index ${arrayIndex}, value: ${value}`);
          
          row.push({
            tokenizer,
            column: language,
            value,
            formatted: value !== undefined && value !== null ? Number(value).toFixed(4) : 'N/A',
          });
        }
        tableData.data.push(row);
      }
    } else if (shape.length === 3) {
      // 3D array: (tokenizers, language1, language2)
      // Flatten to (tokenizers, language_pairs)
      console.log('[MetricTable] Processing 3D metric (tokenizers x language x language)');
      const numTokenizers = shape[0];
      const numLanguages1 = shape[1];
      const numLanguages2 = shape[2];

      console.log(`[MetricTable] Array has ${numTokenizers} tokenizers, ${numLanguages1}x${numLanguages2} language pairs`);
      console.log(`[MetricTable] Selected ${selectedTokenizers.length} tokenizers, ${selectedLanguages.length} languages`);

      // Get the full tokenizer and language lists from metadata
      const allTokenizers = data.metadata?.tokenizers || [];
      const allLanguages = data.metadata?.languages || [];
      
      console.log('[MetricTable] All tokenizers:', allTokenizers);
      console.log('[MetricTable] All languages:', allLanguages);

      // Create language pair column headers
      const languagePairs: string[] = [];
      for (const lang1 of selectedLanguages) {
        for (const lang2 of selectedLanguages) {
          languagePairs.push(`${lang1}-${lang2}`);
        }
      }
      tableData.columns = languagePairs;

      for (let tokIdx = 0; tokIdx < selectedTokenizers.length; tokIdx++) {
        const tokenizer = selectedTokenizers[tokIdx];
        const row: any[] = [];
        
        // Find the actual position of this tokenizer in the full array
        const tokPosition = allTokenizers.indexOf(tokenizer);
        if (tokPosition === -1) {
          console.warn(`[MetricTable] Tokenizer "${tokenizer}" not found in metadata`);
          continue;
        }
        
        for (let lang1Idx = 0; lang1Idx < selectedLanguages.length; lang1Idx++) {
          for (let lang2Idx = 0; lang2Idx < selectedLanguages.length; lang2Idx++) {
            const lang1 = selectedLanguages[lang1Idx];
            const lang2 = selectedLanguages[lang2Idx];
            const pairLabel = `${lang1}-${lang2}`;
            
            // Find the actual positions of these languages in the full array
            const lang1Position = allLanguages.indexOf(lang1);
            const lang2Position = allLanguages.indexOf(lang2);
            
            if (lang1Position === -1) {
              console.warn(`[MetricTable] Language "${lang1}" not found in metadata`);
              continue;
            }
            if (lang2Position === -1) {
              console.warn(`[MetricTable] Language "${lang2}" not found in metadata`);
              continue;
            }
            
            // Calculate the index in the flat array (row-major order)
            // index = tokenizer_position * (numLanguages1 * numLanguages2) + lang1_position * numLanguages2 + lang2_position
            const arrayIndex = tokPosition * (numLanguages1 * numLanguages2) + lang1Position * numLanguages2 + lang2Position;
            const value = arrayData[arrayIndex];
            
            console.log(`[MetricTable] Accessing [${tokPosition}, ${lang1Position}, ${lang2Position}] -> array index ${arrayIndex}, value: ${value}`);
            
            row.push({
              tokenizer,
              column: pairLabel,
              value,
              formatted: value !== undefined && value !== null ? Number(value).toFixed(4) : 'N/A',
            });
          }
        }
        tableData.data.push(row);
      }
    } else {
      console.error('[MetricTable] Unsupported array dimensionality:', shape.length);
      return { rows: [], columns: [], data: [], error: `Unsupported array dimensionality: ${shape.length}D. Expected 2D or 3D.` };
    }

    console.log('[MetricTable] Generated table data with', tableData.data.length, 'rows and', tableData.columns.length, 'columns');
    return tableData;
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
  registerGraphType(new MetricPairCorrelationGraphType());
  registerGraphType(new MetricTableGraphType());
  // Future visualization types can be added here:
  // registerGraphType(new HeatmapGraphType());
};

// Initialize on module load
initializeRegistry();
