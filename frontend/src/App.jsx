import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLayout } from './layouts/AdminLayout'
import { AppLayout } from './layouts/AppLayout'
import { SiteLayout } from './layouts/SiteLayout'
import { Logo } from './components/Logo'
import { RequireAdmin } from './components/RequireAdmin'
import { useAuth } from './lib/auth'

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

// The admin control centre is a separate bundle: most sessions never open it,
// and it should not weigh on the workspace that everyone does load.
const AdminOverview = lazy(() => import('./pages/admin/Overview'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminProjects = lazy(() => import('./pages/admin/Projects'))
const AdminTasks = lazy(() => import('./pages/admin/Tasks'))
const AdminMaterials = lazy(() => import('./pages/admin/Materials'))
const AdminExpenses = lazy(() => import('./pages/admin/Expenses'))
const AdminDocuments = lazy(() => import('./pages/admin/Documents'))
const AdminSiteUpdates = lazy(() => import('./pages/admin/SiteUpdates'))
const AdminIntelligence = lazy(() => import('./pages/admin/Intelligence'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))
const AdminActivity = lazy(() => import('./pages/admin/Activity'))
const AdminSettings = lazy(() => import('./pages/admin/Settings'))

// The site experience is its own bundle. Someone on a phone at a gate should
// not download the portfolio charts to record a headcount.
const SiteDashboard = lazy(() => import('./pages/site/SiteDashboard'))
const SiteTasks = lazy(() => import('./pages/site/SiteTasks'))
const TodaysWork = lazy(() => import('./pages/site/TodaysWork'))
const ProgressUpdates = lazy(() => import('./pages/site/ProgressUpdates'))
const SitePhotos = lazy(() => import('./pages/site/SitePhotos'))
const SiteMaterials = lazy(() => import('./pages/site/SiteMaterials'))
const SiteIssues = lazy(() => import('./pages/site/SiteIssues'))
const DailyReports = lazy(() => import('./pages/site/DailyReports'))
const SiteDocuments = lazy(() => import('./pages/site/SiteDocuments'))
const SiteNotifications = lazy(() => import('./pages/site/SiteNotifications'))
const SiteProfile = lazy(() => import('./pages/site/SiteProfile'))

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Logo size={30} showWordmark={false} />
      <p className="text-tiny text-subtle">Loading…</p>
    </div>
  )
}

/**
 * Send a person to the surface their role actually works from.
 *
 * A site manager opening /app would land on a portfolio dashboard full of
 * budget figures they cannot act on, so /app redirects them to /site. The
 * reverse is not enforced: a project manager has every reason to open the
 * field app and see what their sites are reporting.
 */
function RoleHome({ children }) {
  const { status, home } = useAuth()
  if (status === 'authenticated' && home !== '/app') return <Navigate to={home} replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/app"
        element={
          <RoleHome>
            <Suspense fallback={<RouteFallback />}>
              <AppLayout />
            </Suspense>
          </RoleHome>
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

      {/* The field app: its own shell, its own navigation, its own bundle. */}
      <Route
        path="/site"
        element={
          <Suspense fallback={<RouteFallback />}>
            <SiteLayout />
          </Suspense>
        }
      >
        <Route index element={<SiteDashboard />} />
        <Route path="tasks" element={<SiteTasks />} />
        <Route path="today" element={<TodaysWork />} />
        <Route path="progress" element={<ProgressUpdates />} />
        <Route path="photos" element={<SitePhotos />} />
        <Route path="materials" element={<SiteMaterials />} />
        <Route path="issues" element={<SiteIssues />} />
        <Route path="reports" element={<DailyReports />} />
        <Route path="documents" element={<SiteDocuments />} />
        <Route path="notifications" element={<SiteNotifications />} />
        <Route path="profile" element={<SiteProfile />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Everything under /admin sits behind RequireAdmin. That is a
          courtesy to non-admins — the API refuses them regardless. */}
      <Route
        element={
          <Suspense fallback={<RouteFallback />}>
            <RequireAdmin />
          </Suspense>
        }
      >
        <Route
          path="/admin"
          element={
            <Suspense fallback={<RouteFallback />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="projects" element={<AdminProjects />} />
          <Route path="tasks" element={<AdminTasks />} />
          <Route path="materials" element={<AdminMaterials />} />
          <Route path="expenses" element={<AdminExpenses />} />
          <Route path="documents" element={<AdminDocuments />} />
          <Route path="site-updates" element={<AdminSiteUpdates />} />
          <Route path="ai" element={<AdminIntelligence />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
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
