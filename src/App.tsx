import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'
import ItemFormPage from './features/items/ItemFormPage'
import ItemsListPage from './features/items/ItemsListPage'
import TodayPage from './features/today/TodayPage'

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
            path="/items"
            element={
              <ProtectedRoute>
                <ItemsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/new"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/items/:id/edit"
            element={
              <ProtectedRoute>
                <ItemFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <TodayPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
