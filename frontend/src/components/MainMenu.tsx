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
  const dirInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportDataClick = () => {
    // Trigger the directory picker
    dirInputRef.current?.click();
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

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    // Find metadata.json and results.npz in the selected files
    let metadataFile: File | null = null;
    let resultsFile: File | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      
      if (name === 'metadata.json') {
        metadataFile = file;
      } else if (name === 'results.npz') {
        resultsFile = file;
      }
    }

    if (!metadataFile || !resultsFile) {
      window.alert(
        'Error: Selected directory must contain:\n' +
        '  • metadata.json\n' +
        '  • results.npz'
      );
      return;
    }

    console.log('[MainMenu] Loading from selected directory');
    
    try {
      // Load metadata.json
      console.log('[MainMenu] Reading metadata.json');
      const metadataText = await metadataFile.text();
      const metadata = JSON.parse(metadataText);
      console.log('[MainMenu] ✓ Loaded metadata.json');

      // Load results.npz - send to backend for deserialization
      console.log('[MainMenu] Reading results.npz');
      const resultsBuffer = await resultsFile.arrayBuffer();
      console.log('[MainMenu] ✓ Loaded results.npz (size:', resultsBuffer.byteLength, 'bytes)');

      // Send NPZ to backend for parsing (handles pickled objects)
      console.log('[MainMenu] Sending NPZ to backend for parsing...');
      const backendURL = process.env.NODE_ENV === 'production' 
        ? '/api/parse-npz' 
        : 'http://localhost:5000/api/parse-npz';
      
      const parseResponse = await fetch(backendURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: resultsBuffer,
      });

      if (!parseResponse.ok) {
        console.error('[MainMenu] Parse failed:', parseResponse.status, parseResponse.statusText);
        const errorText = await parseResponse.text();
        console.error('[MainMenu] Response body:', errorText.substring(0, 200));
        throw new Error(
          `Failed to parse results.npz\n\n` +
          `Server response: ${parseResponse.status} ${parseResponse.statusText}\n\n` +
          `Make sure the backend server is running: cd frontend && node server.js`
        );
      }

      const npzData = await parseResponse.json();
      console.log('[MainMenu] ✓ Parsed results.npz');
      console.log('[MainMenu] NPZ metrics:', Object.keys(npzData || {}).filter(k => k !== 'correlation'));

      // Create visualization data with metadata and NPZ data
      const visualizationData = {
        metadata,
        npzData,
      };

      console.log('[MainMenu] ✓ All files loaded successfully');
      onLoadVisualization(visualizationData);
      window.alert('✓ Successfully loaded:\n  • metadata.json\n  • results.npz\n\nClick on the Dataset Name to start creating figures.');

      // Reset the input
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
      }
    } catch (error) {
      console.error('[MainMenu] Error loading data:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      window.alert(errorMsg);
      
      // Reset the input
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
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
        ref={dirInputRef}
        type="file"
        webkitdirectory=""
        accept=".json,.npz"
        onChange={handleDirectorySelect}
        style={{ display: 'none' }}
        {...{ webkitdirectory: '' } as any}
      />
    </div>
  );
};

export default MainMenu;
