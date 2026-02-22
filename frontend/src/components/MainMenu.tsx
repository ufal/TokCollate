import React, { useRef, useState } from 'react';
import './MainMenu.css';

interface MainMenuProps {
  onLoadVisualization: (data: any) => void;
  onSaveVisualization: () => void;
  onExportGraph?: () => void;
  datasetName: string;
}

const MainMenu: React.FC<MainMenuProps> = ({
  onLoadVisualization,
  onSaveVisualization,
  onExportGraph,
  datasetName,
}) => {
  const dirInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    step: number;
    total: number;
    label: string;
  } | null>(null);

  const totalSteps = 4;

  const handleImportDataClick = () => {
    // Trigger the directory picker
    dirInputRef.current?.click();
  };

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    // Find metadata.json and results.npz in the selected files
    let metadataFile: File | null = null;
    let resultsFile: File | null = null;
    let languagesInfoFile: File | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      
      if (name === 'metadata.json') {
        metadataFile = file;
      } else if (name === 'results.npz') {
        resultsFile = file;
      } else if (name === 'languages_info.json' || name === 'language_info.json') {
        languagesInfoFile = file;
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

    try {
      setIsImporting(true);
      setImportProgress({ step: 1, total: totalSteps, label: 'Reading metadata and language info…' });

      // Load metadata.json
      console.log('[MainMenu] Reading metadata.json');
      const metadataText = await metadataFile.text();
      const metadata = JSON.parse(metadataText);
      console.log('[MainMenu] ✓ Loaded metadata.json');

      // Optionally load languages_info.json
      let languagesInfo: any = undefined;
      if (languagesInfoFile) {
        try {
          console.log('[MainMenu] Reading languages_info.json');
          const langInfoText = await languagesInfoFile.text();
          languagesInfo = JSON.parse(langInfoText);
          console.log('[MainMenu] ✓ Loaded languages_info.json');
        } catch (e) {
          console.warn('[MainMenu] Failed to parse languages_info.json (continuing without it):', e);
        }
      }

      setImportProgress({ step: 2, total: totalSteps, label: 'Reading results.npz file…' });

      // Load results.npz - send to backend for deserialization
      console.log('[MainMenu] Reading results.npz');
      const resultsBuffer = await resultsFile.arrayBuffer();
      console.log('[MainMenu] ✓ Loaded results.npz (size:', resultsBuffer.byteLength, 'bytes)');

      // Send NPZ to backend for parsing (handles pickled objects)
      console.log('[MainMenu] Sending NPZ to backend for parsing...');
      const backendURL = process.env.NODE_ENV === 'production'
        ? '/api/parse-npz'
        : 'http://localhost:5000/api/parse-npz';

      setImportProgress({ step: 3, total: totalSteps, label: 'Parsing results.npz on backend…' });

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
      const visualizationData: any = {
        metadata,
        npzData,
      };
      if (languagesInfo) {
        visualizationData.languagesInfo = languagesInfo;
      }

      console.log('[MainMenu] ✓ All files loaded successfully');
      setImportProgress({ step: 4, total: totalSteps, label: 'Finalizing visualization…' });
      onLoadVisualization(visualizationData);
      window.alert(
        '✓ Successfully loaded:\n' +
        '  • metadata.json\n' +
        '  • results.npz' +
        (languagesInfoFile ? '\n  • languages_info.json' : '') +
        '\n\nClick on the Dataset Name to start creating figures.'
      );

      // Reset the input
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
      }

      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(null);
      }, 500);
    } catch (error) {
      console.error('[MainMenu] Error loading data:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      window.alert(errorMsg);

      // Reset the input
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
      }

      setIsImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="main-menu">
      <div className="menu-buttons">
        <button className="menu-button" onClick={handleImportDataClick} disabled={isImporting}>
          Import Data
        </button>
        <button className="menu-button" onClick={onExportGraph} disabled={!onExportGraph}>
          Export Graph
        </button>
        <div className="dataset-selector">
          <label>Dataset Name:</label>
          <span className="dataset-display">{datasetName}</span>
        </div>
      </div>
      {importProgress && (
        <div className="import-progress">
          <div className="import-progress-bar">
            <div
              className="import-progress-bar-fill"
              style={{ width: `${(importProgress.step / importProgress.total) * 100}%` }}
            />
          </div>
          <div className="import-progress-label">
            {importProgress.label} ({importProgress.step}/{importProgress.total})
          </div>
        </div>
      )}
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
