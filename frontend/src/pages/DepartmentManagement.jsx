import { useState, useEffect, useRef } from 'react'
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space } from 'antd'
import { departmentsAPI } from '../services/api'

const DepartmentManagement = ({ currentUser }) => {
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [form] = Form.useForm()

  const isSuperAdmin = currentUser?.role === 'super_admin'

  const fetchDepartments = async () => {
    setLoading(true)
    try {
      const data = await departmentsAPI.getAll()
      setDepartments(data)
    } catch (error) {
      message.error('Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  const handleAdd = () => {
    setEditingDept(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingDept(record)
    form.setFieldsValue({ name: record.name })
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    try {
      await departmentsAPI.delete(id)
      message.success('Deleted successfully')
      fetchDepartments()
    } catch (error) {
      message.error(error.message || 'Delete failed')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingDept) {
        await departmentsAPI.update(editingDept.id, values)
        message.success('Updated successfully')
      } else {
        await departmentsAPI.create(values)
        message.success('Created successfully')
      }
      setModalVisible(false)
      fetchDepartments()
    } catch (error) {
      if (error.errorFields) {
        return
      }
      message.error(error.message || 'Operation failed')
    }
  }

  const columns = [
    {
      title: 'Department Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>Edit</Button>
          <Popconfirm
            title="Delete this department?"
            description="Deleting will remove all tools and users under this department"
            onConfirm={() => handleDelete(record.id)}
            okText="Confirm"
            cancelText="Cancel"
          >
            <Button type="link" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Department Management</h2>
        {isSuperAdmin && (
          <Button type="primary" onClick={handleAdd}>Add Department</Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={departments}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingDept ? 'Edit Department' : 'Add Department'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="Confirm"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please enter department name' }]}
          >
            <Input placeholder="Enter department name" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DepartmentManagement