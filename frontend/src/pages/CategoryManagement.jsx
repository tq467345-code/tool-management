import { useState, useEffect, useRef } from 'react'
import { Table, Button, Modal, Form, Input, message, Card, Row, Col, Upload, Progress } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { categoriesAPI } from '../services/api'
import ImportExportGroup from '../components/ImportExportGroup'

function CategoryManagement() {
  const [categories, setCategories] = useState([])
  const [visible, setVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [editingCategory, setEditingCategory] = useState(null)
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const data = await categoriesAPI.getAll()
      setCategories(data)
    } catch (error) {
      message.error('Failed to load categories')
    }
  }

  const handleAdd = () => {
    form.resetFields()
    setEditingCategory(null)
    setVisible(true)
  }

  const handleEdit = (category) => {
    form.resetFields()
    setEditingCategory(category)
    form.setFieldsValue(category)
    setEditVisible(true)
  }

  const handleDelete = (category) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete category "${category.name}"?`,
      onOk: async () => {
        try {
          await categoriesAPI.delete(category.id)
          message.success('Deleted successfully')
          loadCategories()
        } catch (error) {
          message.error(error.message || 'Delete failed')
        }
      }
    })
  }

  const handleSubmit = async (values) => {
    try {
      if (editingCategory) {
        await categoriesAPI.update(editingCategory.id, values)
        message.success('Updated successfully')
        setEditVisible(false)
      } else {
        await categoriesAPI.create(values)
        message.success('Added successfully')
        setVisible(false)
      }
      loadCategories()
    } catch (error) {
      message.error(error.message || 'Operation failed')
    }
  }

  const handleExport = async () => {
    try {
      await categoriesAPI.exportFile()
      message.success('Exported successfully')
    } catch (error) {
      message.error(error.message || 'Export failed')
    }
  }

  const handleExportTemplate = async () => {
    try {
      await categoriesAPI.exportTemplateFile()
      message.success('Template downloaded')
    } catch (error) {
      message.error(error.message || 'Template download failed')
    }
  }

  const handleImportClick = () => {
    setImportModal(true)
    setImportResult(null)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target.result
        const lines = text.split('\n').filter(line => line.trim())

        const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim())
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.replace(/["']/g, '').trim())
          const obj = {}
          headers.forEach((header, index) => {
            obj[header] = values[index] || ''
          })
          return obj
        }).filter(row => row['Category Name'])

        const result = await categoriesAPI.import(data)
        setImportResult(result)
        loadCategories()
      } catch (error) {
        message.error(error.message || 'Import failed')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Category Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (desc) => desc || '-' },
    {
      title: 'Actions',
      key: 'action',
      render: (_, category) => (
        <div>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(category)} size="small" style={{ marginRight: 8 }}>
            Edit
          </Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(category)} size="small" danger>
            Delete
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card title="Category Management">
      <Row style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="Search category name"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Col>
        <Col span={12} style={{ textAlign: 'right' }}>
          <ImportExportGroup
            onDownloadTemplate={handleExportTemplate}
            onImport={handleImportClick}
            onExport={handleExport}
            templateLabel="Download Template"
            importLabel="Import Categories"
            exportLabel="Export Categories"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ height: 32, borderRadius: 6 }}>
            Add Category
          </Button>
        </Col>
      </Row>

      <Table columns={columns} dataSource={filteredCategories} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        open={visible || editVisible}
        onCancel={() => { setVisible(false); setEditVisible(false); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Category Name" rules={[{ required: true }]}>
            <Input placeholder="Enter category name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Enter category description (optional)" rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              Confirm
            </Button>
            <Button onClick={() => { setVisible(false); setEditVisible(false); }}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import Categories"
        open={importModal}
        onCancel={() => { setImportModal(false); setImportResult(null); }}
        footer={null}
      >
        {!importResult ? (
          <div>
            <p style={{ marginBottom: 16 }}>Select a CSV file to import:</p>
            <p style={{ marginBottom: 16, color: '#666', fontSize: '12px' }}>
              <strong>Note:</strong> Category Name is required. Please download the template first to check the format.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Upload.Dragger
              beforeUpload={() => false}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files.length > 0) {
                  const event = { target: { files: e.dataTransfer.files } }
                  handleFileChange(event)
                }
              }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">Supports .csv format</p>
            </Upload.Dragger>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button onClick={() => setImportModal(false)} style={{ marginRight: 8 }}>
                Cancel
              </Button>
              <Button
                type="primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Select File
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: 16, fontSize: '16px', fontWeight: 'bold' }}>
              {importResult.message}
            </p>
            {importResult.successCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Progress
                  type="circle"
                  percent={(importResult.successCount / (importResult.successCount + importResult.failCount)) * 100}
                  size={80}
                />
              </div>
            )}
            {importResult.errors && importResult.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16 }}>
                <p style={{ marginBottom: 8, color: '#ff4d4f' }}>Failed records:</p>
                {importResult.errors.map((error, index) => (
                  <p key={index} style={{ color: '#ff4d4f', fontSize: '12px' }}>
                    {error}
                  </p>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <Button type="primary" onClick={() => setImportModal(false)}>
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default CategoryManagement