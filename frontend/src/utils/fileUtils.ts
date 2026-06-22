import { VisualizationData } from '../types';

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
