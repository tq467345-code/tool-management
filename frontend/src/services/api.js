const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const getToken = () => localStorage.getItem('token');

// Decode JWT token to get payload
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// Check if token is valid (not expired)
const isTokenValid = () => {
  const token = getToken();
  if (!token) return false;

  const payload = decodeToken(token);
  if (!payload) return false;

  // Check if exp field exists and is not expired
  if (payload.exp) {
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  }

  return true;
};

// Clear token and redirect to login when token is invalid
const handleTokenInvalid = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  // Use window.location.replace to avoid history buildup
  window.location.replace('/login');
};

const request = async (url, options = {}) => {
  const token = getToken();

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    const data = await response.json().catch(() => null);

    // Even if status is not 200, check business-level success
    if (!response.ok || (data && data.success === false)) {
      // 401 with explicit success=false is auth failure, not expiry
      if (response.status === 401 && data && data.success === false) {
        const messages = {
          'User does not exist': { redirect: true, msg: 'Account has been deleted, please login again' },
          'Invalid token': { redirect: true, msg: 'Session expired, please login again' },
          'Login expired, please login again': { redirect: true, msg: 'Login expired, please login again' },
          'Your account has been logged in on another device, please login again': { redirect: true, msg: 'Your account has been logged in on another device, please login again' },
          'Account has been disabled, please contact administrator': { redirect: true, msg: 'Account has been disabled, please contact administrator' },
          'Incorrect password': { redirect: false, msg: 'Incorrect password' }
        };
        const msgConfig = messages[data.message];
        if (msgConfig && msgConfig.redirect) {
          localStorage.removeItem('token');
          localStorage.removeItem('currentUser');
          window.location.href = '/login';
        }
        throw new Error(data.message || 'Username or password incorrect');
      }
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        window.location.href = '/login';
        throw new Error('Login expired, please login again');
      }
      throw new Error(data?.message || `Request failed (${response.status})`);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network connection failed, please check if backend is running');
    }
    throw error;
  }
};

const createApi = (resource) => ({
  getAll: () => request(`/${resource}`),
  getById: (id) => request(`/${resource}/${id}`),
  create: (data) => request(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  exportFile: () => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/${resource}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => {
      if (res.status === 404) {
        return res.json().then(data => {
          throw new Error(data.message || 'No data to export');
        });
      }
      return res.blob();
    }).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resource}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  },
  import: (data) => request(`/${resource}/import`, { method: 'POST', body: JSON.stringify(data) }),
  exportTemplateFile: () => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/${resource}/export/template`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.blob()).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resource}_import_template.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    });
  }
});

const authAPI = {
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
    }
    return data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
  },
  // Real-time token validation (check user status, account disabled, logged in on another device, etc.)
  validate: async () => {
    return request('/auth/validate');
  }
};

const toolsAPI = {
  ...createApi('tools'),
  borrow: (id, userId, borrowReason, quantity = 1) =>
    request(`/tools/${id}/borrow`, { method: 'POST', body: JSON.stringify({ userId, borrowReason, quantity }) }),
  return: (id) => request(`/tools/${id}/return`, { method: 'POST' }),
  getPendingBorrows: () => request('/tools/pending-borrows'),
  approvePendingBorrow: (id, approvingUserId) =>
    request(`/tools/pending-borrows/${id}/approve`, { method: 'POST', body: JSON.stringify({ approvingUserId }) }),
  rejectPendingBorrow: (id) =>
    request(`/tools/pending-borrows/${id}/reject`, { method: 'POST' }),
  cancelPendingBorrow: (id) =>
    request(`/tools/pending-borrows/${id}`, { method: 'DELETE' })
};

const usersAPI = {
  ...createApi('users'),
  resetPassword: (id, adminPassword) =>
    request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ adminPassword }) }),
  changePassword: (id, oldPassword, newPassword) =>
    request(`/users/${id}/change-password`, { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) }),
  updateStatus: (id, status) =>
    request(`/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
};

const categoriesAPI = createApi('categories');

const departmentsAPI = createApi('departments');

const borrowsAPI = {
  ...createApi('borrows'),
  return: (id) => request(`/borrows/${id}/return`, { method: 'PUT' })
};

export { authAPI, toolsAPI, usersAPI, categoriesAPI, departmentsAPI, borrowsAPI, isTokenValid, handleTokenInvalid };
export default { auth: authAPI, tools: toolsAPI, users: usersAPI, categories: categoriesAPI, departments: departmentsAPI, borrows: borrowsAPI, isTokenValid, handleTokenInvalid };