import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Card, Row, Col, Upload, Progress, Tag, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons'
import { usersAPI, departmentsAPI } from '../services/api'
import ImportExportGroup from '../components/ImportExportGroup'

const { Option } = Select

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [visible, setVisible] = useState(false)
  const [editVisible, setEditVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const [editingUser, setEditingUser] = useState(null)
  const [resetPwdVisible, setResetPwdVisible] = useState(false)
  const [resetPwdUser, setResetPwdUser] = useState(null)
  const [resetPwdForm] = Form.useForm()
  const [importModal, setImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [selectedRole, setSelectedRole] = useState('user')
  const fileInputRef = useRef(null)

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isDeptAdmin = currentUser?.role === 'dept_admin'

  useEffect(() => {
    loadUsers()
    loadDepartments()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      setUsers(data)
    } catch (error) {
      message.error(error.message || 'Failed to load users')
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

  const handleAdd = () => {
    form.resetFields()
    setEditingUser(null)
    setSelectedRole('user')
    setVisible(true)
  }

  const handleEdit = (user) => {
    form.resetFields()
    setEditingUser(user)
    setSelectedRole(user.role)
    form.setFieldsValue(user)
    setEditVisible(true)
  }

  const canDelete = (user) => {
    if (user.username === 'admin') {
      return false
    }
    if (isSuperAdmin) {
      return true
    }
    if (isDeptAdmin && user.role === 'user' && user.departmentId === currentUser?.departmentId) {
      return true
    }
    return false
  }

  const handleDelete = (user) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: `Are you sure you want to delete user "${user.realName}"?`,
      onOk: async () => {
        try {
          await usersAPI.delete(user.id)
          message.success('Deleted successfully')
          loadUsers()
        } catch (error) {
          message.error(error.message || 'Delete failed')
        }
      }
    })
  }

  const handleResetPassword = (user) => {
    resetPwdForm.resetFields()
    setResetPwdUser(user)
    setResetPwdVisible(true)
  }

  const canResetPassword = (user) => {
    if (isSuperAdmin && user.username !== 'admin') {
      return true
    }
    if (isDeptAdmin && user.role === 'user' && user.departmentId === currentUser?.departmentId) {
      return true
    }
    return false
  }

  const handleSubmitResetPassword = async (values) => {
    try {
      await usersAPI.resetPassword(resetPwdUser.id, values.adminPassword)
      message.success('Password reset to 123456')
      setResetPwdVisible(false)
      setResetPwdUser(null)
    } catch (error) {
      message.error(error.message || 'Reset failed')
    }
  }

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id, values)
        message.success('Updated successfully')
        setEditVisible(false)
      } else {
        await usersAPI.create(values)
        message.success('Added successfully')
        setVisible(false)
      }
      loadUsers()
    } catch (error) {
      message.error(error.message || 'Operation failed')
    }
  }

  const handleExport = async () => {
    try {
      await usersAPI.exportFile()
      message.success('Exported successfully')
    } catch (error) {
      message.error(error.message || 'Export failed')
    }
  }

  const handleExportTemplate = async () => {
    try {
      await usersAPI.exportTemplateFile()
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
        }).filter(row => row['Username'])

        const result = await usersAPI.import(data)
        setImportResult(result)
        loadUsers()
      } catch (error) {
        message.error(error.message || 'Import failed')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchText.toLowerCase()) ||
    user.realName.toLowerCase().includes(searchText.toLowerCase())
  )

  const columns = [
    { title: 'No.', key: 'index', render: (_, __, index) => index + 1 },
    { title: 'Employee ID', dataIndex: 'username', key: 'username' },
    { title: 'Name', dataIndex: 'realName', key: 'realName' },
    { title: 'Department', dataIndex: 'departmentName', key: 'departmentName' },
    {
      title: 'Role',
      key: 'role',
      render: (_, user) => (
        <span>{user.role === 'super_admin' ? 'Super Admin' : user.role === 'dept_admin' ? 'Dept Admin' : 'User'}</span>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, user) => (
        <Tag color={user.status === 'active' ? 'green' : 'red'}>
          {user.status === 'active' ? 'Active' : 'Disabled'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_, user) => {
        if (user.username === 'admin') {
          return <span style={{ color: '#999' }}>Admin account</span>
        }
        const showResetBtn = canResetPassword(user)
        const canToggleStatus = isSuperAdmin || (isDeptAdmin && user.role === 'user' && user.departmentId === currentUser?.departmentId)
        return (
          <div>
            <Button icon={<EditOutlined />} onClick={() => handleEdit(user)} size="small" style={{ marginRight: 8 }}>
              Edit
            </Button>
            {showResetBtn && (
              <Button icon={<ReloadOutlined />} onClick={() => handleResetPassword(user)} size="small" style={{ marginRight: 8 }}>
                Reset Password
              </Button>
            )}
            {canToggleStatus && (
              <Switch
                size="small"
                checked={user.status === 'active'}
                onChange={(checked) => {
                  Modal.confirm({
                    title: checked ? 'Enable Account' : 'Disable Account',
                    content: `Are you sure you want to ${checked ? 'enable' : 'disable'} user "${user.realName}"?`,
                    onOk: async () => {
                      try {
                        await usersAPI.updateStatus(user.id, checked ? 'active' : 'disabled')
                        message.success(checked ? 'Account enabled' : 'Account disabled')
                        loadUsers()
                      } catch (error) {
                        message.error(error.message || 'Operation failed')
                      }
                    }
                  })
                }}
                style={{ marginRight: 8 }}
              />
            )}
            {canDelete(user) && (
              <Button icon={<DeleteOutlined />} onClick={() => handleDelete(user)} size="small" danger>
                Delete
              </Button>
            )}
          </div>
        )
      }
    }
  ]

  const availableDepartments = isSuperAdmin ? departments : departments.filter(d => d.id === currentUser?.departmentId)

  return (
    <Card title="User Management">
      <Row style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Input
            placeholder="Search by employee ID or name"
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
            importLabel="Import Users"
            exportLabel="Export Users"
          />
          {(isSuperAdmin || isDeptAdmin) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ height: 32, borderRadius: 6 }}>
              Add User
            </Button>
          )}
        </Col>
      </Row>

      <Table columns={columns} dataSource={filteredUsers} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal
        title={editingUser ? 'Edit User' : 'Add User'}
        open={visible || editVisible}
        onCancel={() => { setVisible(false); setEditVisible(false); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="Employee ID" rules={[{ required: true }]}>
            <Input placeholder="Enter employee ID" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="realName" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Enter name" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              placeholder="Select role"
              defaultValue={editingUser?.role || 'user'}
              onChange={(value) => setSelectedRole(value)}
            >
              {isSuperAdmin && <Option value="super_admin">Super Admin</Option>}
              <Option value="dept_admin">Dept Admin</Option>
              <Option value="user">User</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="departmentId"
            label="Department"
            rules={[(selectedRole !== 'super_admin') ? { required: true, message: 'Please select department' } : {}]}
          >
            <Select placeholder={selectedRole === 'super_admin' ? 'Super admin does not need department' : 'Select department'}>
              {selectedRole === 'super_admin' && <Option value="">None (Super Admin)</Option>}
              {availableDepartments.map(dept => (
                <Option key={dept.id} value={dept.id}>{dept.name}</Option>
              ))}
            </Select>
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
        {!editingUser && (
          <p style={{ color: '#999', fontSize: '12px', paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            New user initial password: 123456
          </p>
        )}
      </Modal>

      <Modal
        title="Reset Password"
        open={resetPwdVisible}
        onCancel={() => { setResetPwdVisible(false); setResetPwdUser(null); }}
        footer={null}
      >
        <Form form={resetPwdForm} layout="vertical" onFinish={handleSubmitResetPassword}>
          <Form.Item
            label="Admin Password"
            name="adminPassword"
            rules={[{ required: true, message: 'Please enter admin password' }]}
          >
            <Input.Password placeholder="Enter your password to verify identity" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ marginRight: 8 }}>
              Confirm
            </Button>
            <Button onClick={() => { setResetPwdVisible(false); setResetPwdUser(null); }}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import Users"
        open={importModal}
        onCancel={() => { setImportModal(false); setImportResult(null); }}
        footer={null}
      >
        {!importResult ? (
          <div>
            <p style={{ marginBottom: 16 }}>Select a CSV file to import:</p>
            <p style={{ marginBottom: 16, color: '#666', fontSize: '12px' }}>
              <strong>Note:</strong> Username, Name, and Role are required. Please download the template first.
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

export default UserManagement