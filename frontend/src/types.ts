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
    languagesInfo?: Record<string, any>;
  };
}

export interface FigureConfig {
  id: string;
  typeId: string; // 'scatter-metric-correlation', 'metrics-table', etc.
  tokenizers: string[];
  languages: string[];
  metrics: string[];
  filters?: Record<string, any>;
  groupBy?: 'tokenizer' | 'language' | 'family';
  // Deprecated boolean flag kept for backward compatibility
  showTrendline?: boolean;
  // New, more expressive trendline mode
  trendlineMode?: 'none' | 'global' | 'groups';
}

export interface MetricDimensionality {
  [metricName: string]: 1 | 2 | 3; // 1: 1D, 2: 2D, 3: 3D
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
