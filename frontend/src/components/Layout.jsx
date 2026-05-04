import { useNavigate } from 'react-router-dom'
import { Layout as AntLayout, Menu, Button } from 'antd'
import { ToolOutlined, UserOutlined, FileTextOutlined, FolderOpenOutlined, LogoutOutlined, UserSwitchOutlined, TeamOutlined } from '@ant-design/icons'

const { Header, Sider, Content } = AntLayout

const menuItems = [
  { key: '/tools', label: 'Tool Management', icon: <ToolOutlined /> },
  { key: '/borrow', label: 'Borrow/Return', icon: <FileTextOutlined /> },
  { key: '/user-center', label: 'User Center', icon: <UserSwitchOutlined /> },
  { key: '/users', label: 'User Management', icon: <UserOutlined /> },
  { key: '/categories', label: 'Category Management', icon: <FolderOpenOutlined /> },
  { key: '/departments', label: 'Department Management', icon: <TeamOutlined /> },
]

function Layout({ children, currentUser, onLogout }) {
  const navigate = useNavigate()

  const handleMenuClick = (e) => {
    navigate(e.key)
  }

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const isDeptAdmin = currentUser?.role === 'dept_admin'

  let filteredMenuItems = menuItems
  if (!isSuperAdmin) {
    if (!isDeptAdmin) {
      filteredMenuItems = menuItems.filter(item => item.key !== '/tools' && item.key !== '/users' && item.key !== '/categories' && item.key !== '/departments')
    } else {
      filteredMenuItems = menuItems.filter(item => item.key !== '/categories' && item.key !== '/departments')
    }
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '100%' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '20px' }}>Tool Management System</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: 'rgba(255,255,255,0.85)' }}>
              {currentUser?.realName} ({currentUser?.role === 'super_admin' ? 'Super Admin' : currentUser?.role === 'dept_admin' ? 'Dept Admin' : 'Regular User'})
            </span>
            <Button
              type="primary"
              danger
              onClick={onLogout}
              icon={<LogoutOutlined />}
            >
              Logout
            </Button>
          </div>
        </div>
      </Header>
      <AntLayout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[window.location.pathname]}
            onClick={handleMenuClick}
            style={{ height: '100%', borderRight: 0 }}
            items={filteredMenuItems}
          />
        </Sider>
        <Content style={{ padding: '24px', background: '#f0f2f5', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout