import { Button, Tooltip } from 'antd'
import { FileTextOutlined, DownloadOutlined, ExportOutlined } from '@ant-design/icons'

/**
 * Import/Export Button Group Component
 *
 * Usage:
 * <ImportExportGroup
 *   onDownloadTemplate={handleExportTemplate}
 *   onImport={handleImportClick}
 *   onExport={handleExport}
 *   templateLabel="Download Template"
 *   importLabel="Import"
 *   exportLabel="Export"
 * />
 */
function ImportExportGroup({
  onDownloadTemplate,
  onImport,
  onExport,
  templateLabel = 'Download Template',
  importLabel = 'Import',
  exportLabel = 'Export',
  showTemplate = true,
  showImport = true,
  showExport = true,
  style = {},
  buttonStyle = {},
}) {
  const baseButtonStyle = {
    height: 32,
    borderRadius: 6,
    fontSize: 14,
    ...buttonStyle,
  }

  const buttonGap = 8

  return (
    <div style={{ display: 'flex', gap: buttonGap, alignItems: 'center', ...style }}>
      {showTemplate && (
        <Tooltip title={`${templateLabel} - Get standard data import template`}>
          <Button
            icon={<FileTextOutlined />}
            onClick={onDownloadTemplate}
            style={baseButtonStyle}
          >
            {templateLabel}
          </Button>
        </Tooltip>
      )}
      {showImport && (
        <Tooltip title={`${importLabel} - Import data from local file`}>
          <Button
            icon={<DownloadOutlined />}
            onClick={onImport}
            style={baseButtonStyle}
          >
            {importLabel}
          </Button>
        </Tooltip>
      )}
      {showExport && (
        <Tooltip title={`${exportLabel} - Export data to local file`}>
          <Button
            icon={<ExportOutlined />}
            onClick={onExport}
            style={baseButtonStyle}
          >
            {exportLabel}
          </Button>
        </Tooltip>
      )}
    </div>
  )
}

export default ImportExportGroup