import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0">
        <div className="px-6 py-5 border-b border-slate-100">
          <Link to="/dashboard" className="text-lg font-semibold text-slate-900">
            ResumeMaker
          </Link>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarLink to="/dashboard" label="Dashboard" current={location.pathname} />
          <SidebarLink to="/resumes" label="My Resumes" current={location.pathname} />
          <div className="pt-4 pb-1">
            <p className="text-xs font-medium text-slate-400 px-3 uppercase tracking-wider mb-1">
              Career
            </p>
          </div>
          <SidebarLink to="/career/experience" label="Experience" current={location.pathname} />
          <SidebarLink to="/career/education" label="Education" current={location.pathname} />
          <SidebarLink to="/career/skills" label="Skills" current={location.pathname} />
          <SidebarLink to="/settings" label="Profile" current={location.pathname} />
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {user?.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm text-slate-700 truncate">{user?.name}</span>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarLink({ to, label, current }: { to: string; label: string; current: string }) {
  const isActive = current === to || current.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
        isActive
          ? "text-blue-600 bg-blue-50 font-medium"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
