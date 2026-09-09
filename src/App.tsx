import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'

function Home() {
  return (
    <div>
      <h1>Rotina do Casal</h1>
      <nav>
        <Link to="/categories">Categorias</Link>
      </nav>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/couple-setup"
            element={
              <ProtectedRoute>
                <CoupleSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <CategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
