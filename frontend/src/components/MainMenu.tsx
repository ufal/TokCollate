import React, { useRef } from 'react';
import { loadMetricsFile, loadMetadata } from '../utils/fileUtils';
import './MainMenu.css';

interface MainMenuProps {
  onLoadVisualization: (data: any) => void;
  onSaveVisualization: () => void;
  onExportGraphs?: () => void;
  datasetName: string;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onLoadVisualization,
  onSaveVisualization,
  onExportGraphs,
  datasetName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const metadataInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportDataClick = () => {
    metadataInputRef.current?.click();
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

  const handleMetadataSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const metadata = await loadMetadata(file);
        if (metadata) {
          onLoadVisualization(metadata);
        }
      } catch (error) {
        alert('Failed to load metadata file. Make sure it contains valid TokEval scorer metadata.');
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
        <button className="menu-button" onClick={handleImportDataClick}>
          Import Data
        </button>
        <button className="menu-button" onClick={onSaveVisualization}>
          Save
        </button>
        <button className="menu-button" onClick={onExportGraphs} disabled={!onExportGraphs}>
          Export graphs
        </button>
        <div className="dataset-selector">
          <label>Dataset Name:</label>
          <span className="dataset-display">{datasetName}</span>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.npz"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={metadataInputRef}
        type="file"
        accept=".json"
        onChange={handleMetadataSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MainMenu;
