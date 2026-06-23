export const GRAPH_COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#8dd1e1',
  '#d084d0',
  '#ffa500',
  '#00ff00',
];

export const getColorForMetric = (index: number): string =>
  GRAPH_COLORS[index % GRAPH_COLORS.length];
