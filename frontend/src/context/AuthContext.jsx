import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as loginApi, signup as signupApi, getMe, getToken, setToken, removeToken } from '../services/auth'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in on mount
    const token = getToken()
    if (token) {
      // Verify token and get user info
      getMe(token)
        .then(response => {
          setUser(response.data)
        })
        .catch(() => {
          // Token invalid, remove it
          removeToken()
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    try {
      const response = await loginApi(email, password)
      const { token, user } = response.data
      setToken(token)
      setUser(user)
      navigate('/')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed'
      }
    }
  }

  const signup = async (email, password, name) => {
    try {
      const response = await signupApi(email, password, name)
      const { token, user } = response.data
      setToken(token)
      setUser(user)
      navigate('/')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Signup failed'
      }
    }
  }

  const logout = () => {
    removeToken()
    setUser(null)
    navigate('/login')
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

