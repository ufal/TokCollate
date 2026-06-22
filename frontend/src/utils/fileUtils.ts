import { VisualizationData, MetricDimensionality } from '../types';

export interface ParsedVisualizationPayload {
  processedData: VisualizationData;
  datasetName: string;
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
  metricDimensionality: MetricDimensionality;
  missingMetrics: string[];
  /** Non-null when the payload cannot be used (shape mismatch or invalid data). */
  error: string | null;
}

/**
 * Parse a raw visualization payload (from MainMenu import or server load) into
 * a normalized structure ready for app state. Returns an `error` string instead
 * of throwing so the caller can surface it via UI.
 */
export function parseVisualizationPayload(data: any): ParsedVisualizationPayload {
  let datasetName = 'Unknown';
  let availableTokenizers: string[] = [];
  let availableMetrics: string[] = [];
  let availableLanguages: string[] = [];
  let metricDimensionality: MetricDimensionality = {};
  let missingMetrics: string[] = [];
  let processedData: VisualizationData;

  if (data?.metadata && data?.npzData) {
    const metadata = data.metadata;
    const npzData = data.npzData;
    const languagesInfo = data.languagesInfo;
    const tokenizations = data.tokenizations;

    datasetName = metadata.dataset_name || 'Unknown';
    availableTokenizers = metadata.tokenizers || [];
    availableLanguages = metadata.languages || [];

    console.log('[fileUtils] NPZ data keys:', Object.keys(npzData));
    console.log('[fileUtils] Metadata:', { dataset_name: datasetName, tokenizers: availableTokenizers.length, languages: availableLanguages.length, metrics: metadata.metrics });

    const processed = processNpzMetrics(npzData, {
      metrics: metadata.metrics,
      tokenizers: availableTokenizers,
      languages: availableLanguages,
    });

    if (processed.shapeError) {
      return { processedData: {} as VisualizationData, datasetName, availableTokenizers, availableMetrics, availableLanguages, metricDimensionality, missingMetrics, error: processed.shapeError };
    }

    availableMetrics = processed.availableMetrics;
    missingMetrics = processed.missingMetrics;
    metricDimensionality = processed.metricDimensionality;

    const correlationObj = npzData?.correlation?.() || npzData?.correlation || {};

    console.log('[fileUtils] Loaded metadata:', { datasetName, tokenizers: availableTokenizers.length, metrics: availableMetrics.length, languages: availableLanguages.length });
    console.log('[fileUtils] Processed metrics:', Object.keys(processed.metricsObj));

    processedData = {
      metrics: processed.metricsObj,
      correlation: correlationObj,
      metadata: {
        datasetName,
        timestamp: metadata.timestamp,
        version: metadata.version,
        tokenizers: availableTokenizers,
        languages: availableLanguages,
        metrics: availableMetrics,
        languagesInfo,
        hasTokenizations: metadata?.has_tokenizations === true,
        tokenizations,
      },
    };
  } else if (data?.metadata) {
    datasetName = data.metadata.datasetName || data.metadata.dataset_name || 'Unknown';
    availableTokenizers = data.metadata.tokenizers || [];
    availableMetrics = data.metadata.metrics || [];
    availableLanguages = data.metadata.languages || [];

    processedData = {
      metrics: data.metrics || {},
      correlation: data.correlation || {},
      metadata: {
        datasetName,
        timestamp: data.metadata.timestamp,
        version: data.metadata.version,
        tokenizers: availableTokenizers,
        languages: availableLanguages,
        metrics: availableMetrics,
      },
    };
  } else {
    datasetName = data.dataset_name || 'Unknown';
    availableTokenizers = data.tokenizers || [];
    availableMetrics = data.metrics || [];
    availableLanguages = data.languages || [];

    processedData = {
      metrics: data.metrics || {},
      correlation: data.correlation || {},
      metadata: {
        datasetName,
        tokenizers: availableTokenizers,
        languages: availableLanguages,
        metrics: availableMetrics,
      },
    };
  }

  if (!datasetName || (availableTokenizers.length === 0 && availableMetrics.length === 0 && availableLanguages.length === 0)) {
    console.error('[fileUtils] Payload validation failed:', { datasetName, tokenizers: availableTokenizers.length, metrics: availableMetrics.length, languages: availableLanguages.length });
    return { processedData, datasetName, availableTokenizers, availableMetrics, availableLanguages, metricDimensionality, missingMetrics, error: 'Import failed: Invalid or missing metadata/data.' };
  }

  return { processedData, datasetName, availableTokenizers, availableMetrics, availableLanguages, metricDimensionality, missingMetrics, error: null };
}

export interface ProcessedNpzMetrics {
  metricsObj: Record<string, any>;
  availableMetrics: string[];
  missingMetrics: string[];
  metricDimensionality: MetricDimensionality;
  shapeError: string | null;
}

export function processNpzMetrics(
  npzData: Record<string, any>,
  metadata: { metrics?: string[]; tokenizers: string[]; languages: string[] },
): ProcessedNpzMetrics {
  const metricsObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(npzData)) {
    if (key === 'correlation') continue;

    if (Array.isArray(value)) {
      const arrayValue = value as number[][];
      let shape: number[] = [];

      if (arrayValue.length > 0) {
        if (Array.isArray(arrayValue[0])) {
          if (Array.isArray(arrayValue[0][0])) {
            shape = [arrayValue.length, arrayValue[0].length, arrayValue[0][0].length];
          } else {
            shape = [arrayValue.length, arrayValue[0].length];
          }
        } else {
          shape = [arrayValue.length];
        }
      }

      const flatArray = new Float64Array(arrayValue.flat(Infinity) as number[]);
      metricsObj[key] = { data: flatArray, shape, dtype: 'float64' };
      console.log(`[fileUtils] Wrapped metric: ${key}`, { shape, dtype: 'float64', dataLength: flatArray.length });
    }
  }

  const npzMetricKeys = Object.keys(metricsObj);
  let availableMetrics: string[];
  let missingMetrics: string[] = [];

  if (metadata.metrics && Array.isArray(metadata.metrics) && metadata.metrics.length > 0) {
    availableMetrics = metadata.metrics.filter((m) => npzMetricKeys.includes(m));
    missingMetrics = metadata.metrics.filter((m) => !npzMetricKeys.includes(m));
    if (missingMetrics.length > 0) {
      console.warn('[fileUtils] Metrics listed in metadata but missing in results.npz:', missingMetrics);
    }
  } else {
    availableMetrics = npzMetricKeys;
  }

  const metricDimensionality: MetricDimensionality = {};
  availableMetrics.forEach((metric) => {
    if (metricsObj[metric]) {
      const { shape } = metricsObj[metric];
      const dim = shape.length >= 1 && shape.length <= 3 ? (shape.length as 1 | 2 | 3) : 1;
      metricDimensionality[metric] = dim;
      console.log(`[fileUtils] Metric dimensionality: ${metric} = ${dim}D (shape: ${shape.join('x')})`);
    }
  });

  const shapeIssues: string[] = [];
  const expectedTok = metadata.tokenizers.length;
  const expectedLang = metadata.languages.length;
  availableMetrics.forEach((metric) => {
    const m = metricsObj[metric];
    if (!m || !Array.isArray(m.shape)) return;
    const shape = m.shape as number[];

    if (shape.length === 2) {
      if (shape[0] !== expectedTok || shape[1] !== expectedLang) {
        shapeIssues.push(`${metric}: expected [${expectedTok}, ${expectedLang}], got [${shape[0]}, ${shape[1]}]`);
      }
    } else if (shape.length === 3) {
      if (shape[0] !== expectedTok || shape[1] !== expectedLang || shape[2] !== expectedLang) {
        shapeIssues.push(`${metric}: expected [${expectedTok}, ${expectedLang}, ${expectedLang}], got [${shape.join(', ')}]`);
      }
    }
  });

  const shapeError =
    shapeIssues.length > 0
      ? `Import failed: metric array shapes do not match tokenizers/languages metadata. See console for details.`
      : null;
  if (shapeIssues.length > 0) {
    console.error('[fileUtils] Metric shape/metadata mismatch detected:', shapeIssues);
  }

  return { metricsObj, availableMetrics, missingMetrics, metricDimensionality, shapeError };
}

/**
 * Save visualization configuration to JSON
 */
export const saveVisualization = (data: VisualizationData, filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Export charts as PNG images using html2canvas
 * Note: Requires html2canvas library - install with: npm install html2canvas
 */
export const exportGraphAsPNG = async (
  elementId: string,
  filename: string
): Promise<void> => {
  // Dynamic import to avoid hard dependency
  try {
    const html2canvas = (await import('html2canvas')).default;
    const element = document.getElementById(elementId);
    
    if (!element) {
      throw new Error(`Element with ID ${elementId} not found`);
    }

    const canvas = await html2canvas(element, {
      backgroundColor: '#fff',
      scale: 2,
      logging: false,
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  } catch (error) {
    console.warn('html2canvas not available. Export requires: npm install html2canvas');
    throw new Error('Graph export requires html2canvas library. Please install it first.');
  }
};

/**
 * Export all graphs as PNG files
 * Creates a list of exports and triggers download
 */
export const exportAllGraphs = async (
  graphs: Array<{ id: string; filename?: string }>
): Promise<void> => {
  if (graphs.length === 0) {
    alert('No graphs to export');
    return;
  }

  try {
    for (const graph of graphs) {
      const base = graph.filename || graph.id || 'graph';
      const safe = String(base).replace(/[^a-z0-9]/gi, '_');
      const filename = `${safe}.png`;
      await exportGraphAsPNG(graph.id, filename);
      // Add small delay between exports to avoid browser throttling
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    alert(`Successfully exported ${graphs.length} graph(s)`);
  } catch (error) {
    alert(`Failed to export graphs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('Export error:', error);
  }
};
