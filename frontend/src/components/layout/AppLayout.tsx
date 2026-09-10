import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* SIDEBAR - versi native tanpa ScrollArea */}
      <aside className="w-64 border-r bg-white flex flex-col shrink-0">
        <div className="h-16 px-5 border-b flex items-center gap-3 font-bold">
          <div className="w-9 h-9 rounded-xl bg-black text-white grid place-items-center">A</div>
          Aumo Finance
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavLink to="/dashboard" className={({isActive}) => isActive ? "block bg-black text-white p-2 rounded" : "block p-2 text-gray-500"}>Dashboard</NavLink>
          <NavLink to="/chart-of-accounts" className={({isActive}) => isActive ? "block bg-black text-white p-2 rounded" : "block p-2 text-gray-500"}>Chart of Accounts</NavLink>
          <NavLink to="/reports/general-journal" className={({isActive}) => isActive ? "block bg-black text-white p-2 rounded" : "block p-2 text-gray-500"}>General Journal</NavLink>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="h-16 border-b bg-white px-6 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-500">{useLocation().pathname}</div>
          <Link to="/auth" className="text-xs">Logout</Link>
        </header>
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
