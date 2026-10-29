import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthContext'
import ProtectedRoute from './features/auth/ProtectedRoute'
import LoginPage from './features/auth/LoginPage'
import SignupPage from './features/auth/SignupPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import CoupleSetupPage from './features/couple/CoupleSetupPage'
import CategoriesPage from './features/categories/CategoriesPage'
import ItemFormPage from './features/items/ItemFormPage'
import ItemsListPage from './features/items/ItemsListPage'
import TodayPage from './features/today/TodayPage'
import AgendaPage from './features/agenda/AgendaPage'
import StatsPage from './features/stats/StatsPage'
import AppShell from './ui/AppShell'
import SettingsPage from './features/settings/SettingsPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/nova-senha" element={<ResetPasswordPage />} />
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
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<TodayPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/estatisticas" element={<StatsPage />} />
            <Route path="/items" element={<ItemsListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
