import { useState, useEffect } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ToolManagement from './pages/ToolManagement'
import UserManagement from './pages/UserManagement'
import BorrowRecords from './pages/BorrowRecords'
import CategoryManagement from './pages/CategoryManagement'
import DepartmentManagement from './pages/DepartmentManagement'
import UserCenter from './pages/UserCenter'
import { isTokenValid, handleTokenInvalid, authAPI } from './services/api'

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser')
    if (savedUser) {
      try {
        return JSON.parse(savedUser)
      } catch (e) {
        localStorage.removeItem('currentUser')
        return null
      }
    }
    return null
  })

  // Function to validate and sync user
  const validateAndSyncUser = () => {
    const savedUser = localStorage.getItem('currentUser')
    // If current page is login, don't redirect for token validation
    if (window.location.pathname === '/login') {
      return true
    }
    if (!isTokenValid()) {
      // Token invalid, clear state and redirect
      handleTokenInvalid()
      setCurrentUser(null)
      return false
    }
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
      } catch {
        localStorage.removeItem('currentUser')
        setCurrentUser(null)
      }
    }
    return true
  }

  useEffect(() => {
    // Validate token on page load
    validateAndSyncUser()

    // Real-time token validation (call backend API every 5 seconds)
    const tokenCheckInterval = setInterval(async () => {
      // Only validate on non-login pages
      if (window.location.pathname === '/login') {
        return
      }
      try {
        await authAPI.validate()
      } catch (error) {
        // Token invalid, clear state and redirect
        handleTokenInvalid()
      }
    }, 5000)

    // Check token immediately when page resumes from background (user switches back to tab)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && window.location.pathname !== '/login') {
        try {
          await authAPI.validate()
        } catch (error) {
          handleTokenInvalid()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleStorageChange = (e) => {
      if (e.key === 'currentUser') {
        if (e.newValue) {
          try {
            setCurrentUser(JSON.parse(e.newValue))
          } catch {
            setCurrentUser(null)
          }
        } else {
          setCurrentUser(null)
        }
      }
      // If another tab clears the token, also redirect to login
      if (e.key === 'token' && e.newValue === null) {
        handleTokenInvalid()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      clearInterval(tokenCheckInterval)
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
  }

  const PrivateRoute = ({ children }) => {
    if (!currentUser) {
      return <Navigate to="/login" replace />
    }
    return children
  }

  const AdminRoute = ({ children }) => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'dept_admin')) {
      return <Navigate to="/borrow" replace />
    }
    return children
  }

  const SuperAdminRoute = ({ children }) => {
    if (!currentUser || currentUser.role !== 'super_admin') {
      return <Navigate to="/borrow" replace />
    }
    return children
  }

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <Navigate to="/tools" replace />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/tools" element={
        <AdminRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <ToolManagement currentUser={currentUser} />
          </Layout>
        </AdminRoute>
      } />
      <Route path="/users" element={
        <AdminRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <UserManagement currentUser={currentUser} />
          </Layout>
        </AdminRoute>
      } />
      <Route path="/borrow" element={
        <PrivateRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <BorrowRecords currentUser={currentUser} />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/user-center" element={
        <PrivateRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <UserCenter currentUser={currentUser} />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/categories" element={
        <AdminRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <CategoryManagement />
          </Layout>
        </AdminRoute>
      } />
      <Route path="/departments" element={
        <SuperAdminRoute>
          <Layout currentUser={currentUser} onLogout={handleLogout}>
            <DepartmentManagement currentUser={currentUser} />
          </Layout>
        </SuperAdminRoute>
      } />
    </Routes>
  )
}

export default App