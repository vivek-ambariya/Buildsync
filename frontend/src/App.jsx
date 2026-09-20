import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './layouts/AppLayout'
import { Logo } from './components/Logo'

// Landing and login load eagerly; the application shell is split off so the
// public page stays light.
import Landing from './pages/Landing'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Documents = lazy(() => import('./pages/Documents'))
const SiteUpdates = lazy(() => import('./pages/SiteUpdates'))
const Assistant = lazy(() => import('./pages/Assistant'))
const Insights = lazy(() => import('./pages/Insights'))
const Reports = lazy(() => import('./pages/Reports'))
const Team = lazy(() => import('./pages/Team'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Logo size={30} showWordmark={false} />
      <p className="text-tiny text-subtle">Loading…</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <Suspense fallback={<RouteFallback />}>
            <AppLayout />
          </Suspense>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="documents" element={<Documents />} />
        <Route path="site-updates" element={<SiteUpdates />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="insights" element={<Insights />} />
        <Route path="reports" element={<Reports />} />
        <Route path="team" element={<Team />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route
        path="*"
        element={
          <Suspense fallback={<RouteFallback />}>
            <NotFound standalone />
          </Suspense>
        }
      />
    </Routes>
  )
}
