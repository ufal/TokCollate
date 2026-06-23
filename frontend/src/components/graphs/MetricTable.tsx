import React from 'react';
import { FigureConfig, VisualizationData } from '../../types';
import { buildLanguageLabelMap, getDisplayLanguageLabel } from '../../utils/languageLabels';

interface MetricTableProps {
  config: FigureConfig;
  data: VisualizationData;
  tableData: any;
}

type RowSortState = { columnIndex: number | null; direction: 'asc' | 'desc' };
type ColumnSortState = { rowIndex: number | null; direction: 'asc' | 'desc' };

function formatLegendValue(v: number): string {
  if (!Number.isFinite(v)) return '';
  const abs = Math.abs(v);
  if ((abs >= 1000 && abs < Infinity) || (abs > 0 && abs < 0.01)) return v.toExponential(2);
  return v.toFixed(3);
}

const MetricTable: React.FC<MetricTableProps> = ({ config, data, tableData }) => {
  const [rowSort, setRowSort] = React.useState<RowSortState>({ columnIndex: null, direction: 'asc' });
  const [columnSort, setColumnSort] = React.useState<ColumnSortState>({ rowIndex: null, direction: 'asc' });

  if (tableData.error) {
    return <div className="no-data"><strong>Error:</strong> {tableData.error}</div>;
  }
  if (!tableData.rows || !tableData.columns || !tableData.data) {
    return <div className="no-data">Invalid table data structure</div>;
  }
  if (tableData.data.length === 0) {
    return <div className="no-data">No data available for this configuration</div>;
  }

  const allLanguages = data.metadata?.languages || [];
  const languageLabelMap = React.useMemo(
    () => buildLanguageLabelMap(allLanguages),
    [allLanguages],
  );

  const is3D =
    Array.isArray(config.metrics) &&
    config.metrics.length === 1 &&
    (data as any).metrics?.[config.metrics[0]]?.shape?.length === 3;

  const renderColumnLabel = (col: string) => {
    if (is3D && col.includes('-')) {
      const [lang1, lang2] = col.split('-', 2);
      return (
        <span className="metric-table-col-label">
          <span>{getDisplayLanguageLabel(lang1, languageLabelMap)}</span>
          <br />
          <span>{getDisplayLanguageLabel(lang2, languageLabelMap)}</span>
        </span>
      );
    }
    return getDisplayLanguageLabel(col, languageLabelMap);
  };

  const handleColumnHeaderClick = (colIdx: number) => {
    setRowSort((prev) =>
      prev.columnIndex === colIdx
        ? { columnIndex: colIdx, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { columnIndex: colIdx, direction: 'asc' },
    );
  };

  const handleRowHeaderClick = (rowIdx: number) => {
    setColumnSort((prev) =>
      prev.rowIndex === rowIdx
        ? { rowIndex: rowIdx, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { rowIndex: rowIdx, direction: 'asc' },
    );
  };

  const cellValue = (cell: any): number => {
    const raw = cell?.value;
    const v = Number(raw);
    return raw === undefined || raw === null || Number.isNaN(v) ? Infinity : v;
  };

  const sortedRowIndices: number[] = tableData.data.map((_: any, i: number) => i);
  if (rowSort.columnIndex !== null && rowSort.columnIndex < tableData.columns.length) {
    const ci = rowSort.columnIndex;
    sortedRowIndices.sort((a, b) => {
      const diff = cellValue(tableData.data[a][ci]) - cellValue(tableData.data[b][ci]);
      return rowSort.direction === 'asc' ? diff : -diff;
    });
  }

  const sortedColumnIndices: number[] = tableData.columns.map((_: any, i: number) => i);
  if (columnSort.rowIndex !== null && columnSort.rowIndex < tableData.data.length) {
    const ri = columnSort.rowIndex;
    const row = tableData.data[ri];
    sortedColumnIndices.sort((a, b) => {
      const diff = cellValue(row[a]) - cellValue(row[b]);
      return columnSort.direction === 'asc' ? diff : -diff;
    });
  }

  let minValue = Infinity, maxValue = -Infinity;
  sortedRowIndices.forEach((ri) => {
    sortedColumnIndices.forEach((ci) => {
      const v = Number(tableData.data[ri][ci]?.value);
      if (Number.isFinite(v)) { if (v < minValue) minValue = v; if (v > maxValue) maxValue = v; }
    });
  });
  const hasValueRange = Number.isFinite(minValue) && Number.isFinite(maxValue);

  const getCellBackground = (raw: any): React.CSSProperties['backgroundColor'] => {
    if (!hasValueRange) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v)) return undefined;
    if (minValue === maxValue) return 'rgba(76, 175, 80, 0.25)';
    const t = Math.max(0, Math.min(1, (v - minValue) / (maxValue - minValue)));
    const r = Math.round(232 + (0 - 232) * t);
    const g = Math.round(246 + (120 - 246) * t);
    const b = Math.round(231 + (50 - 231) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getCellTextColor = (raw: any): React.CSSProperties['color'] => {
    if (!hasValueRange || minValue === maxValue) return undefined;
    const v = Number(raw);
    if (!Number.isFinite(v)) return undefined;
    return (v - minValue) / (maxValue - minValue) >= 0.65 ? '#ffffff' : '#2c3e50';
  };

  return (
    <div className="metric-table-container">
      <table className="metric-table">
        <thead>
          <tr>
            <th className="table-row-header">{tableData.rowHeader || 'Tokenizer'}</th>
            {sortedColumnIndices.map((ci) => {
              const isActive = rowSort.columnIndex === ci;
              return (
                <th
                  key={ci}
                  className="table-column-header"
                  onClick={() => handleColumnHeaderClick(ci)}
                  style={{ cursor: 'pointer' }}
                >
                  {renderColumnLabel(tableData.columns[ci])}
                  {isActive && (
                    <span style={{ marginLeft: '4px' }}>
                      {rowSort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRowIndices.map((ri) => {
            const row = tableData.data[ri];
            return (
              <tr key={ri}>
                <td
                  className="table-row-label"
                  onClick={() => handleRowHeaderClick(ri)}
                  style={{ cursor: 'pointer' }}
                >
                  {tableData.rows[ri]}
                  {columnSort.rowIndex === ri && (
                    <span style={{ marginLeft: '4px' }}>
                      {columnSort.direction === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </td>
                {sortedColumnIndices.map((ci) => {
                  const cell = row[ci];
                  const rawValue = cell?.value;
                  return (
                    <td
                      key={ci}
                      className="table-cell"
                      title={`Value: ${rawValue !== undefined ? rawValue : 'N/A'}`}
                      style={{ backgroundColor: getCellBackground(rawValue), color: getCellTextColor(rawValue) }}
                    >
                      {cell ? cell.formatted : 'N/A'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasValueRange && (
        <div className="metric-table-legend">
          <div className="metric-table-legend-title">
            Cell color shows relative value (lower -&gt; higher)
          </div>
          <div className="metric-table-legend-bar-wrapper">
            <div className="metric-table-legend-bar" />
          </div>
          <div className="metric-table-legend-labels">
            <span>{formatLegendValue(minValue)}</span>
            <span>{formatLegendValue((minValue + maxValue) / 2)}</span>
            <span>{formatLegendValue(maxValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricTable;
