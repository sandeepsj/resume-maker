import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0">
        <div className="px-6 py-5 border-b border-slate-100">
          <Link href="/dashboard" className="text-lg font-semibold text-slate-900">
            ResumeMaker
          </Link>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarLink href="/dashboard" label="Dashboard" />
          <SidebarLink href="/resumes" label="My Resumes" />
          <div className="pt-4 pb-1">
            <p className="text-xs font-medium text-slate-400 px-3 uppercase tracking-wider mb-1">
              Career
            </p>
          </div>
          <SidebarLink href="/career/experience" label="Experience" />
          <SidebarLink href="/career/education" label="Education" />
          <SidebarLink href="/career/skills" label="Skills" />
          <SidebarLink href="/settings" label="Profile" />
        </nav>

        <div className="px-4 py-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            {session.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="w-7 h-7 rounded-full"
              />
            )}
            <span className="text-sm text-slate-700 truncate">{session.user?.name}</span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen">{children}</main>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"
    >
      {label}
    </Link>
  );
}
