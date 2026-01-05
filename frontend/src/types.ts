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
}

export interface GraphConfig {
  id: string;
  type: 'bar' | 'line' | 'scatter' | 'heatmap';
  title: string;
  tokenizers: string[];
  languages: string[];
  metrics: string[];
  filters?: Record<string, any>;
}

export interface VisualizationState {
  graphs: GraphConfig[];
  currentDataset: 'metrics' | 'correlation';
  availableTokenizers: string[];
  availableMetrics: string[];
  availableLanguages: string[];
  data: VisualizationData | null;
}
