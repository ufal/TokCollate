import React, { useRef } from 'react';
import { loadMetricsFile } from '../utils/fileUtils';
import './MainMenu.css';

interface MainMenuProps {
  onLoadVisualization: (data: any) => void;
  onSaveVisualization: () => void;
  onDatasetChange: (dataset: 'metrics' | 'correlation') => void;
  currentDataset: 'metrics' | 'correlation';
}

const MainMenu: React.FC<MainMenuProps> = ({
  onLoadVisualization,
  onSaveVisualization,
  onDatasetChange,
  currentDataset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await loadMetricsFile(file);
        onLoadVisualization(data);
      } catch (error) {
        alert('Failed to load file. Make sure it\'s a valid JSON file.');
        console.error(error);
      }
    }
  };

  return (
    <div className="main-menu">
      <div className="menu-buttons">
        <button className="menu-button" onClick={handleLoadClick}>
          Load
        </button>
        <button className="menu-button" onClick={onSaveVisualization}>
          Save
        </button>
        <button className="menu-button" disabled>
          Add Tokenizer
        </button>
        <div className="dataset-selector">
          <label>Dataset Type:</label>
          <select
            value={currentDataset}
            onChange={(e) =>
              onDatasetChange(e.target.value as 'metrics' | 'correlation')
            }
          >
            <option value="metrics">Metrics</option>
            <option value="correlation">Correlation</option>
          </select>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.npz"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MainMenu;
