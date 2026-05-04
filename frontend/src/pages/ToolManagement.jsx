import { useState, useEffect, useRef } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Card, Row, Col, Upload, Progress } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { toolsAPI, categoriesAPI, departmentsAPI } from '../services/api'
import ImportExportGroup from '../components/ImportExportGroup'

const { Option } = Select

function ToolManagement({ currentUser }) {
  const [tools, setTools] = useState([])
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [visible, setVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [editingTool, setEditingTool] = useState(null)
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadTools()
    loadCategories()
    loadDepartments()
  }, [])

  const loadTools = async () => {
    try {
      const data = await toolsAPI.getAll()
      setTools(data)
    } catch (error) {
      message.error('Failed to load tools')
    }
  }

  const loadCategories = async () => {
    try {
      const data = await categoriesAPI.getAll()
      setCategories(data)
    } catch (error) {
      message.error('Failed to load categories')
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await departmentsAPI.getAll()
      setDepartments(data)
    } catch (error) {
      message.error('Failed to load departments')
    }
  }

  const handleAdd = () => {
    form.resetFields()
    setEditingTool(null)
    setVisible(true)
  }

  const handleEdit = (tool) => {
    form.resetFields()
    setEditingTool(tool)
    form.setFieldsValue(tool)
    setEditVisible(true)
  }


  const handleDelete = (tool) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete tool "${tool.name}"?`,
      onOk: async () => {
        try {
          await toolsAPI.delete(tool.id)
          message.success('Deleted successfully')
          loadTools()
        } catch (error) {
          message.error(error.message || 'Delete failed')
        }
      }
    })
  }

  const handleSubmit = async (values) => {
    try {
      const submitData = {
        ...values,
        total: Number(values.total),
        departmentId: currentUser.role === 'super_admin' ? values.departmentId : currentUser.departmentId,
      }
      if (editingTool) {
        await toolsAPI.update(editingTool.id, submitData)
        message.success('Updated successfully')
        setEditVisible(false)
      } else {
        await toolsAPI.create(submitData)
        message.success('Added successfully')
        setVisible(false)
      }
      loadTools()
    } catch (error) {
      message.error(error.message || 'Operation failed')
    }
  }


  const handleExport = async () => {
    try {
      await toolsAPI.exportFile()
      message.success('Exported successfully')
    } catch (error) {
      message.error(error.message || 'Export failed')
    }
  }

  const handleExportTemplate = async () => {
    try {
      await toolsAPI.exportTemplateFile()
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
        }).filter(row => row['Tool Name'])

        const result = await toolsAPI.import(data)
        setImportResult(result)
        loadTools()
      } catch (error) {
        message.error(error.message || 'Import failed')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchText.toLowerCase()) ||
    tool.category.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Tool Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Department', key: 'department', render: (_, tool) => departments.find(d => d.id === tool.departmentId)?.name || '-' },
    { title: 'Total Stock', dataIndex: 'total', key: 'total' },
    { title: 'Available', dataIndex: 'available', key: 'available' },
    { title: 'Location', dataIndex: 'location', key: 'location', render: (loc) => loc || '-' },
    {
      title: 'Actions',
      key: 'action',
      render: (_, tool) => (
        <div>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(tool)} size="small" style={{ marginRight: 8 }}>
            Edit
          </Button>
          <Button icon={<DeleteOutlined />} onClick={() => handleDelete(tool)} size="small" danger>
            Delete
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card title="Tool Management">
      <Row style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="Search by tool name or category"
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
            importLabel="Import Tools"
            exportLabel="Export Tools"
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ height: 32, borderRadius: 6 }}>
            Add Tool
          </Button>
        </Col>
      </Row>

      <Table columns={columns} dataSource={filteredTools} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingTool ? 'Edit Tool' : 'Add Tool'}
        open={visible || editVisible}
        onCancel={() => { setVisible(false); setEditVisible(false); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Tool Name" rules={[{ required: true }]}>
            <Input placeholder="Enter tool name" />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category">
              {categories.map(cat => (
                <Option key={cat.id} value={cat.name}>{cat.name}</Option>
              ))}
            </Select>
          </Form.Item>
          {(currentUser.role === 'super_admin' || currentUser.role === 'dept_admin') && (
            <Form.Item name="departmentId" label="Department" rules={[{ required: true }]} initialValue={currentUser.role === 'dept_admin' ? currentUser.departmentId : undefined}>
              <Select placeholder="Select department" disabled={currentUser.role === 'dept_admin'}>
                {(currentUser.role === 'super_admin' ? departments : departments.filter(d => d.id === currentUser.departmentId)).map(dept => (
                  <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="total" label="Stock Quantity" rules={[{ required: true, message: 'Please enter stock quantity' }]}>
            <InputNumber min={1} placeholder="Enter stock quantity" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="Location">
            <Input placeholder="Enter location" />
          </Form.Item>
          <Form.Item name="description" label="Notes">
            <Input.TextArea placeholder="Enter notes" rows={3} />
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
        title="Import Tools"
        open={importModal}
        onCancel={() => { setImportModal(false); setImportResult(null); }}
        footer={null}
      >
        {!importResult ? (
          <div>
            <p style={{ marginBottom: 16 }}>Select a CSV file to import:</p>
            <p style={{ marginBottom: 16, color: '#666', fontSize: '12px' }}>
              <strong>Note:</strong> Tool Name, Category, and Total Stock are required. Please download the template first.
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

export default ToolManagement