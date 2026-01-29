export interface MetricsData {
  [metricName: string]: number | number[];
}

export interface SystemMetrics {
  [systemName: string]: MetricsData;
}

export interface LanguageMetrics {
  [language: string]: SystemMetrics;
}

export interface VisualizationData {
  metrics: { [key: string]: any };
  correlation: { [key: string]: any };
  metadata?: {
    datasetName?: string;
    timestamp?: string;
    version?: string;
    metricsPath?: string;
    correlationPath?: string;
    tokenizers?: string[];
    languages?: string[];
    metrics?: string[];
  };
}

export interface FigureConfig {
  id: string;
  typeId: string; // 'scatter-metric-correlation', 'metrics-table', etc.
  title: string;
  tokenizers: string[];
  languages: string[];
  metrics: string[];
  filters?: Record<string, any>;
}

export interface MetricDimensionality {
  [metricName: string]: 1 | 2; // 1 for 1D metrics, 2 for 2D metrics
}

export interface VisualizationState {
  figures: FigureConfig[];
  datasetName: string;
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
  metricDimensionality: MetricDimensionality;
  data: VisualizationData | null;
}
