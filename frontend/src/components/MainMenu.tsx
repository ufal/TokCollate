import React, { useRef } from 'react';
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
  const dirInputRef = useRef<HTMLInputElement>(null);

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
      const visualizationData: any = {
        metadata,
        npzData,
      };
      if (languagesInfo) {
        visualizationData.languagesInfo = languagesInfo;
      }

      console.log('[MainMenu] ✓ All files loaded successfully');
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
        <button className="menu-button" onClick={handleImportDataClick}>
          Import Data
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
