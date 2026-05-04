import { useState, useEffect, useRef } from 'react'
import { Table, Button, Modal, Form, Input, message, Card, Row, Col, Tag, Statistic, Tabs, Upload, Progress, Badge } from 'antd'
import { SearchOutlined, EyeOutlined, PlusOutlined, RotateLeftOutlined, UploadOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import { toolsAPI, borrowsAPI, departmentsAPI } from '../services/api'
import ImportExportGroup from '../components/ImportExportGroup'

const { TabPane } = Tabs

function BorrowRecords({ currentUser }) {
  const [tools, setTools] = useState([])
  const [departments, setDepartments] = useState([])
  const [borrows, setBorrows] = useState([])
  const [pendingBorrows, setPendingBorrows] = useState([])
  const [searchText, setSearchText] = useState('')
  const [detailModal, setDetailModal] = useState(false)
  const [borrowModal, setBorrowModal] = useState(false)
  const [currentTool, setCurrentTool] = useState(null)
  const [currentToolBorrows, setCurrentToolBorrows] = useState([])
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('inventory')
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isDeptAdmin = currentUser?.role === 'dept_admin'
  const isAdmin = isSuperAdmin || isDeptAdmin

  useEffect(() => {
    loadTools()
    loadDepartments()
    loadBorrows()
    loadPendingBorrows()
  }, [])

  const loadTools = async () => {
    try {
      const data = await toolsAPI.getAll()
      setTools(data)
    } catch (error) {
      message.error(error.message || 'Failed to load tool inventory')
    }
  }

  const loadDepartments = async () => {
    try {
      const data = await departmentsAPI.getAll()
      setDepartments(data)
    } catch (error) {
      message.error(error.message || 'Failed to load departments')
    }
  }

  const loadBorrows = async () => {
    try {
      const data = await borrowsAPI.getAll()
      setBorrows(data)
    } catch (error) {
      message.error(error.message || 'Failed to load borrow records')
    }
  }

  const loadPendingBorrows = async () => {
    try {
      const data = await toolsAPI.getPendingBorrows()
      setPendingBorrows(data)
    } catch (error) {
      message.error(error.message || 'Failed to load pending applications')
    }
  }

  const handleViewDetail = (tool) => {
    setCurrentTool(tool)
    const toolBorrows = borrows.filter(b => b.toolId === tool.id)
    setCurrentToolBorrows(toolBorrows)
    setDetailModal(true)
  }

  const handleBorrow = (tool) => {
    setCurrentTool(tool)
    form.resetFields()
    form.setFieldsValue({ quantity: 1 })
    setBorrowModal(true)
  }

  const handleSubmitBorrow = async (values) => {
    try {
      const result = await toolsAPI.borrow(currentTool.id, currentUser.id, values.borrowReason, values.quantity)
      if (result.status === 'pending') {
        message.info('Borrow application submitted, please wait for approval')
        await loadPendingBorrows()
      } else {
        message.success('Borrowed successfully')
      }
      setBorrowModal(false)
      await loadTools()
      await loadBorrows()
    } catch (error) {
      message.error(error.message || 'Borrow failed')
    }
  }

  const handleReturn = async (record) => {
    Modal.confirm({
      title: 'Confirm Return',
      content: `Are you sure you want to return tool "${record.toolName}"?`,
      onOk: async () => {
        try {
          await toolsAPI.return(record.toolId)
          message.success('Returned successfully')
          await loadTools()
          await loadBorrows()
          if (currentTool) {
            setCurrentToolBorrows(borrows.filter(b => b.toolId === currentTool.id))
          }
        } catch (error) {
          message.error(error.message || 'Return failed')
        }
      }
    })
  }


  const handleApprove = async (pending) => {
    Modal.confirm({
      title: 'Approve Application',
      content: `Are you sure you want to approve user "${pending.userName}"'s borrow application?`,
      onOk: async () => {
        try {
          await toolsAPI.approvePendingBorrow(pending.id, currentUser.id)
          message.success('Application approved')
          loadPendingBorrows()
          loadTools()
          loadBorrows()
        } catch (error) {
          message.error(error.message || 'Approval failed')
        }
      }
    })
  }

  const handleReject = async (pending) => {
    Modal.confirm({
      title: 'Reject Application',
      content: `Are you sure you want to reject user "${pending.userName}"'s borrow application?`,
      onOk: async () => {
        try {
          await toolsAPI.rejectPendingBorrow(pending.id)
          message.success('Application rejected')
          loadPendingBorrows()
        } catch (error) {
          message.error(error.message || 'Operation failed')
        }
      }
    })
  }

  const handleCancelPending = async (pending) => {
    Modal.confirm({
      title: 'Cancel Application',
      content: 'Are you sure you want to cancel this borrow application?',
      onOk: async () => {
        try {
          await toolsAPI.cancelPendingBorrow(pending.id)
          message.success('Application cancelled')
          loadPendingBorrows()
        } catch (error) {
          message.error(error.message || 'Cancel failed')
        }
      }
    })
  }

  const handleExportBorrows = async () => {
    try {
      await borrowsAPI.exportFile()
      message.success('Exported successfully')
    } catch (error) {
      message.error(error.message || 'Export failed')
    }
  }

  const handleExportTemplate = async () => {
    try {
      await borrowsAPI.exportTemplateFile()
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

        const result = await borrowsAPI.import(data)
        setImportResult(result)
        loadBorrows()
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

  const borrowedRecords = borrows.filter(r => r.status === 'borrowed')
  const pendingCount = pendingBorrows.filter(p => p.status === 'pending').length

  const totalTools = tools.reduce((sum, t) => sum + t.total, 0)
  const availableTools = tools.reduce((sum, t) => sum + t.available, 0)
  const borrowedCount = totalTools - availableTools

  const getStatusColor = (available, total) => {
    const ratio = available / total
    if (ratio === 1) return 'green'
    if (ratio > 0) return 'orange'
    return 'red'
  }

  const getStatusText = (available, total) => {
    const ratio = available / total
    if (ratio === 1) return 'All Available'
    if (ratio > 0) return 'Partially Borrowed'
    return 'All Borrowed'
  }

  const inventoryColumns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Tool Name', dataIndex: 'name', key: 'name' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Department', key: 'department', render: (_, tool) => departments.find(d => d.id === tool.departmentId)?.name || '-' },
    { title: 'Total Stock', dataIndex: 'total', key: 'total' },
    { title: 'Available', dataIndex: 'available', key: 'available' },
    {
      title: 'Status',
      key: 'status',
      render: (_, tool) => (
        <Tag color={getStatusColor(tool.available, tool.total)}>
          {getStatusText(tool.available, tool.total)}
        </Tag>
      )
    },
    { title: 'Location', dataIndex: 'location', key: 'location', render: (loc) => loc || '-' },
    {
      title: 'Actions',
      key: 'action',
      render: (_, tool) => (
        <div>
          <Button icon={<EyeOutlined />} onClick={() => handleViewDetail(tool)} size="small" style={{ marginRight: 8 }}>
            Details
          </Button>
          {tool.available > 0 && (
            <Button icon={<PlusOutlined />} onClick={() => handleBorrow(tool)} size="small" type="primary">
              Borrow
            </Button>
          )}
        </div>
      )
    }
  ]

  const borrowedColumns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Tool Name', dataIndex: 'toolName', key: 'toolName' },
    { title: 'Category', dataIndex: 'toolCategory', key: 'toolCategory' },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName' },
    { title: 'Borrower', dataIndex: 'userName', key: 'userName' },
    { title: 'Borrow Date', dataIndex: 'borrowDate', key: 'borrowDate' },
    { title: 'Borrow Time', dataIndex: 'borrowTime', key: 'borrowTime' },
    { title: 'Reason', dataIndex: 'borrowReason', key: 'borrowReason', render: (r) => r || '-' },
    {
      title: 'Actions',
      key: 'action',
      render: (record) => (
        <Button icon={<RotateLeftOutlined />} onClick={() => handleReturn(record)} size="small" type="primary">
          Return
        </Button>
      )
    }
  ]

  const recordColumns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Tool Name', dataIndex: 'toolName', key: 'toolName' },
    { title: 'Category', dataIndex: 'toolCategory', key: 'toolCategory' },
    { title: 'Borrower', dataIndex: 'userName', key: 'userName' },
    { title: 'Borrow Date', dataIndex: 'borrowDate', key: 'borrowDate' },
    { title: 'Return Date', dataIndex: 'returnDate', key: 'returnDate', render: (d) => d || '-' },
    { title: 'Reason', dataIndex: 'borrowReason', key: 'borrowReason', render: (r) => r || '-' },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => (
        <Tag color={record.status === 'borrowed' ? 'orange' : 'green'}>
          {record.status === 'borrowed' ? 'Borrowed' : 'Returned'}
        </Tag>
      )
    },
  ]


  const pendingColumns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Tool Name', dataIndex: 'toolName', key: 'toolName' },
    { title: 'Category', dataIndex: 'toolCategory', key: 'toolCategory' },
    { title: 'Applicant', dataIndex: 'userName', key: 'userName' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
    { title: 'Reason', dataIndex: 'borrowReason', key: 'borrowReason', render: (r) => r || '-' },
    { title: 'Applied At', dataIndex: 'createdAt', key: 'createdAt', render: (t) => t ? t.slice(0, 16).replace('T', ' ') : '-' },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const statusMap = {
          pending: { color: 'orange', text: 'Pending' },
          approved: { color: 'green', text: 'Approved' },
          rejected: { color: 'red', text: 'Rejected' },
          cancelled: { color: 'default', text: 'Cancelled' }
        }
        const s = statusMap[record.status] || statusMap.pending
        return <Tag color={s.color}>{s.text}</Tag>
      }
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'pending') {
          return <span style={{ color: '#999' }}>-</span>
        }
        if (isAdmin) {
          return (
            <div>
              <Button icon={<CheckOutlined />} onClick={() => handleApprove(record)} size="small" type="primary" style={{ marginRight: 4 }}>
                Approve
              </Button>
              <Button icon={<CloseOutlined />} onClick={() => handleReject(record)} size="small" danger style={{ marginRight: 4 }}>
                Reject
              </Button>
            </div>
          )
        }
        return (
          <Button icon={<DeleteOutlined />} onClick={() => handleCancelPending(record)} size="small" danger>
            Cancel
          </Button>
        )
      }
    }
  ]

  return (
    <Card title="Borrow/Return Tools">
      <Row style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Tools" value={totalTools} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Available" value={availableTools} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Borrowed" value={borrowedCount} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Tool Types" value={tools.length} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Tool Inventory" key="inventory">
          <Row style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Input
                placeholder="Search by tool name or category"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Col>
          </Row>
          <Table columns={inventoryColumns} dataSource={filteredTools} rowKey="id" pagination={{ pageSize: 10 }} />
        </TabPane>
        <TabPane tab="Borrowed" key="borrowed">
          <Table columns={borrowedColumns} dataSource={borrowedRecords} rowKey="id" pagination={{ pageSize: 10 }} />
        </TabPane>
        <TabPane tab="Borrow Records" key="records">
          <Row style={{ marginBottom: 16 }}>
            <Col span={24} style={{ textAlign: 'center' }}>
              <ImportExportGroup
                onDownloadTemplate={handleExportTemplate}
                onImport={handleImportClick}
                onExport={handleExportBorrows}
                templateLabel="Download Template"
                importLabel="Import Records"
                exportLabel="Export Records"
              />
            </Col>
          </Row>
          <Table columns={recordColumns} dataSource={borrows} rowKey="id" pagination={{ pageSize: 10 }} />
        </TabPane>
        {!isAdmin && (
          <TabPane tab={<span>My Applications{pendingCount > 0 && <Badge count={pendingCount} />}</span>} key="myApplications">
            <Table columns={pendingColumns} dataSource={pendingBorrows} rowKey="id" pagination={{ pageSize: 10 }} />
          </TabPane>
        )}
        {isAdmin && (
          <TabPane tab={<span>Pending Approval{pendingCount > 0 && <Badge count={pendingCount} />}</span>} key="pending">
            <Table columns={pendingColumns} dataSource={pendingBorrows} rowKey="id" pagination={{ pageSize: 10 }} />
          </TabPane>
        )}
      </Tabs>

      <Modal
        title={`${currentTool?.name} - Details`}
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        width={800}
        footer={null}
      >
        {currentTool && (
          <div>
            <Tabs>
              <TabPane tab="Inventory Info" key="info">
                <Row gutter={16}>
                  <Col span={12}>
                    <p><strong>Tool Name:</strong>{currentTool.name}</p>
                    <p><strong>Category:</strong>{currentTool.category}</p>
                    <p><strong>Department:</strong>{departments.find(d => d.id === currentTool.departmentId)?.name}</p>
                  </Col>
                  <Col span={12}>
                    <p><strong>Total Stock:</strong>{currentTool.total}</p>
                    <p><strong>Available:</strong>{currentTool.available}</p>
                    <p><strong>Location:</strong>{currentTool.location || '-'}</p>
                  </Col>
                </Row>
                <p><strong>Notes:</strong>{currentTool.description || '-'}</p>
              </TabPane>
              <TabPane tab="Borrow Records" key="borrows">
                <Table
                  columns={recordColumns}
                  dataSource={currentToolBorrows}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  onRow={(record) => ({
                    onDoubleClick: () => {
                      if (record.status === 'borrowed') {
                        handleReturn(record)
                      }
                    }
                  })}
                />
              </TabPane>
            </Tabs>
          </div>
        )}
      </Modal>

      <Modal
        title="Borrow Tool"
        open={borrowModal}
        onCancel={() => setBorrowModal(false)}
        footer={null}
      >
        {currentTool && (
          <Form form={form} layout="vertical" onFinish={handleSubmitBorrow}>
            <Form.Item label="Tool Name">
              <Input value={currentTool.name} disabled />
            </Form.Item>
            <Form.Item label="Category">
              <Input value={currentTool.category} disabled />
            </Form.Item>
            <Form.Item label="Available">
              <Input value={currentTool.available} disabled />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="Borrow Quantity"
              rules={[{ required: true, message: 'Please enter borrow quantity' }, { type: 'number', min: 1, message: 'Quantity must be greater than 0' }]}
            >
              <Input type="number" min={1} max={currentTool.available} placeholder="Enter borrow quantity" />
            </Form.Item>
            <Form.Item name="borrowReason" label="Reason">
              <Input.TextArea placeholder="Enter borrow reason (optional)" rows={3} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
                {isAdmin ? 'Confirm Borrow' : 'Submit Application'}
              </Button>
              <Button onClick={() => setBorrowModal(false)}>
                Cancel
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Import Borrow Records"
        open={importModal}
        onCancel={() => { setImportModal(false); setImportResult(null); }}
        footer={null}
      >
        {!importResult ? (
          <div>
            <p style={{ marginBottom: 16 }}>Select a CSV file to import:</p>
            <p style={{ marginBottom: 16, color: '#666', fontSize: '12px' }}>
              <strong>Note:</strong> Tool Name and Borrower Name are required. Please download the template first.
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
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default BorrowRecords