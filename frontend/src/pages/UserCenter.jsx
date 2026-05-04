import { useState, useEffect } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { usersAPI } from '../services/api'

function UserCenter({ currentUser }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [oldPasswordError, setOldPasswordError] = useState('')

  const handlePasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('New password does not match confirm password')
      return
    }

    setLoading(true)
    try {
      await usersAPI.changePassword(currentUser.id, values.oldPassword, values.newPassword)
      message.success('Password changed successfully, please login again')
      form.resetFields()
      setOldPasswordError('')
      localStorage.removeItem('token')
      localStorage.removeItem('currentUser')
      window.location.href = '/login'
    } catch (error) {
      if (error.message === 'Incorrect password') {
        setOldPasswordError('Incorrect password')
        message.error('Incorrect password')
      } else {
        message.error(error.message || 'Password change failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // Clear error when old password is entered
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const oldPassword = form.getFieldValue('oldPassword')
      if (oldPassword && oldPasswordError) {
        setOldPasswordError('')
      }
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [form.getFieldValue('oldPassword')])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card
        title={
          <span>
            <UserOutlined style={{ marginRight: 8 }} />
            User Center
          </span>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <h3>Account Information</h3>
          <p><strong>Username:</strong>{currentUser.username}</p>
          <p><strong>Name:</strong>{currentUser.realName}</p>
          <p><strong>Role:</strong>
            {currentUser.role === 'super_admin' ? 'Super Admin' :
             currentUser.role === 'dept_admin' ? 'Dept Admin' : 'Regular User'}
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <h3>Change Password</h3>

          <Form.Item
            name="oldPassword"
            label="Old Password"
            validateStatus={oldPasswordError ? 'error' : ''}
            help={oldPasswordError || null}
            rules={[{ required: true, message: 'Please enter old password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Please enter old password"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 6, message: 'New password must be at least 6 characters' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Please enter new password (at least 6 characters)"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            rules={[
              { required: true, message: 'Please confirm new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('The two passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Please enter new password again"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              Confirm Change
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default UserCenter