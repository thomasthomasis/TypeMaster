import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuthStore } from './store/useAuthStore'
import { RequireAuth, RedirectIfSignedIn } from './components/RequireAuth'
import Login from './pages/Login'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import DiscordCallback from './pages/DiscordCallback'
import Account from './pages/Account'
import Home from './pages/Home'
import ChooseUsername from './pages/ChooseUsername'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <main className="app">
        <Routes>
          <Route element={<RedirectIfSignedIn />}>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>
          <Route path="/choose-username" element={<ChooseUsername />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth/discord/callback" element={<DiscordCallback />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Home />} />
            <Route path="/account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}