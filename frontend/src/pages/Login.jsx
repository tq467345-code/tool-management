import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, message, Card } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authAPI } from '../services/api'

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (values) => {
    setLoading(true)
    try {
      const result = await authAPI.login(values.username, values.password)
      if (result.success) {
        onLogin(result.user)
        message.success('Login successful')
        navigate('/tools')
      }
    } catch (error) {
      message.error(error.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Tool Management System</h2>

        <Form name="login" onFinish={handleLogin}>
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter employee ID' },
              { min: 1, max: 50, message: 'Employee ID length should be between 1-50' }
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Please enter employee ID"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter password' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Please enter password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
              LOGIN
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default Login