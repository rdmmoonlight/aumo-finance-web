import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils"

export default function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans antialiased">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar />

        {/* Main Workspace Area with Shadcn ScrollArea */}
        <ScrollArea className="flex-1 bg-muted/30">
          <main className="p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-6">
              <Outlet />
            </div>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}