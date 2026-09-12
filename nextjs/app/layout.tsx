'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import './global.css';
import 'geist/font/sans';
import 'geist/font/mono';
import { cn } from "@/lib/utils";
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  IconHome, IconLayoutGrid, IconCalendarEvent, IconSitemap, IconRobot, IconBook2, IconFolder, IconShieldCheck, IconTools, IconSettings, IconLogout, IconX,
  IconCalendarOff, IconLock, IconCalendarCheck, IconSearch, IconDotsVertical, IconMoonStars, IconSun, IconShieldCheckFilled, IconCloudCheck, IconRefresh, IconCirclePlus, IconList, IconEyeOff
} from '@tabler/icons-react';

const themeInitScript = `
  (function() {
    try {
      const saved = localStorage.getItem('aumo_theme');
      const theme = (saved === 'light' || saved === 'dark')? saved : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-bs-theme', theme);
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    }
  })();
  window.aumoTheme = {
    get: function() { return document.documentElement.classList.contains('dark')? 'dark' : 'light'; },
    set: function(t) {
      const theme = t === 'light'? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-bs-theme', theme);
      document.documentElement.style.colorScheme = theme;
      localStorage.setItem('aumo_theme', theme);
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    },
    toggle: function() { const next = this.get() === 'dark'? 'light' : 'dark'; this.set(next); return next; }
  };
  window.setAppTheme = function(t){ window.aumoTheme.set(t); };
`;

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const NEXT_PUBLIC_API_URL = rawApiUrl.replace(/\/+$/, '');

const reportsNavList = [
  { href: '/reports/general-journal', label: 'General Journal' },
  { href: '/reports/general-ledger/permanent', label: 'GL (Permanent Accounts)' },
  { href: '/reports/general-ledger/temporary', label: 'GL (Temporary Accounts)' },
  { href: '/reports/trial-balance/unadjusted', label: 'Trial Balance' },
  { href: '/reports/adjusting-journal', label: 'Adjusting Journal' },
  { href: '/reports/trial-balance/adjusted', label: 'Adjusted Trial Balance' },
  { href: '/reports/worksheet', label: 'Worksheet' },
  { href: '/reports/income-statement', label: 'Income Statement' },
  { href: '/reports/retained-earnings', label: 'Retained Earnings' },
  { href: '/reports/statement-of-financial-position', label: 'Financial Position' },
  { href: '/reports/closing-journal', label: 'Closing Journal' },
  { href: '/reports/trial-balance/post-closing', label: 'Post-Closing TB' },
  { href: '/reports/statement-of-cash-flow', label: 'Cash Flow' },
];
const mainNav = [
  { href: '/dashboard', icon: IconLayoutGrid, label: 'Dashboard' },
  { href: '/periods', icon: IconCalendarEvent, label: 'Financial Periods' },
  { href: '/chart-of-accounts', icon: IconSitemap, label: 'Chart of Accounts' },
  { href: '/ai-assistant', icon: IconRobot, label: 'AI Assistant' },
  { href: '/journal-entry', icon: IconBook2, label: 'Journal Entry' },
  { href: '/guardian', icon: IconShieldCheck, label: 'Guardian' },
  { href: '/tools', icon: IconTools, label: 'Tools' },
];

const timeSlots = [0,85,169,254,339,424,508,593,678,762,847,932,1016,1101,1186,1271,1355];
function calculateAyahNumber(){const now=new Date();const s=new Date(now.getFullYear(),0,0);const day=Math.floor((now.getTime()-s.getTime())/(1000*60*60*24));const m=now.getHours()*60+now.getMinutes();let idx=0;for(let i=timeSlots.length-1;i>=0;i--)if(m>=timeSlots[i]){idx=i;break;}let n=(day-1)*17+idx+1;if(n>6236)n=((n-1)%6236)+1;return n;}
let cachedVerseText:string|null=null; let cachedVerseRef:string|null=null;
function QuranVerse(){
  const [verseText,setVerseText]=useState(cachedVerseText||'Loading verse...');
  const [verseRef,setVerseRef]=useState(cachedVerseRef||'--');
  useEffect(()=>{if(cachedVerseText&&cachedVerseRef){setVerseText(cachedVerseText);setVerseRef(cachedVerseRef);return;} (async()=>{try{const ayah=calculateAyahNumber();const res=await fetch(`https://api.alquran.cloud/v1/ayah/${ayah}/en.sahih`);const json=await res.json();if(json.code===200&&json.data){const t=`"${json.data.text}"`;const r=`QS. ${json.data.surah.englishName} ${json.data.surah.number}:${json.data.numberInSurah}`;cachedVerseText=t;cachedVerseRef=r;setT(t);setR(r);} }catch{setT('"Allah does not charge a soul except with that which He has given it."');setR('QS. At-Talaq 65:7');}})();},[]);
  return <div className="mx-auto flex w-full max-w-[95%] items-center justify-center gap-1.5 overflow-hidden px-1 text-center leading-[1.4] line-clamp-2"><span className="text- italic opacity-80">{verseText}</span><Badge variant="secondary" className="shrink-0 bg-blue-500/15 text- text-blue-500 hover:bg-blue-500/15">{verseRef}</Badge></div>;
}

function AppTopbar({ isAuthenticated, changeTheme, onPeriodChanged }: { isAuthenticated: boolean; changeTheme: (t:'dark'|'light')=>void; onPeriodChanged?:()=>void }){
  const router=useRouter(); const [hasActive,setHasActive]=useState(false); const [isClosed,setIsClosed]=useState(false); const [periodText,setPeriodText]=useState('No Period Selected'); const [loading,setLoading]=useState(false);
  const fetchSelectedPeriod=async()=>{if(!isAuthenticated)return; setLoading(true); try{const res=await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods`,{method:'GET',headers:{'Content-Type':'application/json'},credentials:'include'}); if(res.ok){const data=await res.json(); const periods=Array.isArray(data?.periods)?data.periods:[]; const selectedId=data?.selectedPeriodId; if(selectedId){const sel=periods.find((p:any)=>p.id===selectedId); if(sel){setHasActive(true);setIsClosed(sel.isClosed);setPeriodText(`Viewing: ${sel.periodName}`);return;}} const active=periods.find((p:any)=>!p.isClosed); if(active){setHasActive(true);setIsClosed(false);setPeriodText(active.periodName);} else if(periods.length>0){setHasActive(true);setIsClosed(periods[0].isClosed);setPeriodText(periods[0].periodName);} else{setHasActive(false);setIsClosed(false);setPeriodText('No Period Selected');}}}catch{}finally{setLoading(false);}};
  useEffect(()=>{fetchSelectedPeriod(); const h=()=>fetchSelectedPeriod(); window.addEventListener('periodChanged',h); return()=>window.removeEventListener('periodChanged',h);},[isAuthenticated]);
  const handleClear=async()=>{const res=await fetch(`${NEXT_PUBLIC_API_URL}/api/v1/periods/clear-selection`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include'}); if(res.ok){setHasActive(false);setIsClosed(false);setPeriodText('No Period Selected'); window.dispatchEvent(new Event('periodChanged')); onPeriodChanged?.(); router.refresh();}};
  return (<>
    <header className="topbar-solid sticky top-0 z-40 flex min-h- items-center justify-center border-b bg-white px-4 py-2 dark:bg-[#0f172a] dark:border-white/10"><div className="mx-auto w-full max-w-"><QuranVerse/></div></header>
    {isAuthenticated && (
      <div className="status-strip flex h-9 items-center justify-center gap-3 whitespace-nowrap border-b bg-white px-4 text- dark:bg-[#0a0f1c] dark:border-white/10">
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 gap-2 px-2 text-xs font-semibold">{!hasActive?<IconCalendarOff className="h-4 w-4 text-amber-500"/>:isClosed?<IconLock className="h-4 w-4 text-muted-foreground"/>:<IconCalendarCheck className="h-4 w-4 text-emerald-500"/>}<span className={cn(!hasActive&&"text-red-500")}>{loading?'Loading...':periodText}</span>{isClosed&&<Badge variant="outline" className="ml-1 font-mono text-">LOCKED</Badge>}</Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-52 text-xs"><DropdownMenuLabel className="text- uppercase tracking-widest">Accounting Period</DropdownMenuLabel><DropdownMenuItem asChild className="gap-2 font-semibold text-blue-500"><Link href="/periods"><IconCirclePlus className="h-4 w-4"/> Open New Period</Link></DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem asChild className="gap-2"><Link href="/periods"><IconList className="h-4 w-4"/> Manage All Periods</Link></DropdownMenuItem>{hasActive&&<DropdownMenuItem onClick={handleClear} className="gap-2 text-red-500"><IconEyeOff className="h-4 w-4"/> Stop Viewing</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu>
        <span className="text-muted-foreground/30">|</span>
        <div className="flex items-center gap-1"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><IconSearch className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Search (⌘K)</TooltipContent></Tooltip><span className="text-muted-foreground/30">/</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><IconDotsVertical className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel className="text- uppercase tracking-widest">Theme</DropdownMenuLabel><DropdownMenuItem onClick={()=>changeTheme('dark')} className="gap-2"><IconMoonStars className="h-4 w-4 text-amber-400"/> Dark Matte</DropdownMenuItem><DropdownMenuItem onClick={()=>changeTheme('light')} className="gap-2"><IconSun className="h-4 w-4 text-amber-400"/> Light Minimal</DropdownMenuItem></DropdownMenuContent></DropdownMenu><span className="text-muted-foreground/30">/</span><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500"><IconShieldCheckFilled className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Guardian Protected</TooltipContent></Tooltip><span className="text-muted-foreground/30">/</span><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-sky-500" onClick={fetchSelectedPeriod}><span className={cn(loading&&"animate-spin")}><IconCloudCheck className={cn("h-4 w-4",loading&&"hidden")}/><IconRefresh className={cn("h-4 w-4",!loading&&"hidden")}/></span></Button></TooltipTrigger><TooltipContent>Sync</TooltipContent></Tooltip></div>
      </div>
    )}
  </>);
}

function AppSidebar({ pathname, handleSignOut, showReportsFlyout: extShow, toggleReportsFlyout: extToggle, closeFlyout: extClose }: { pathname: string; currentUserEmail?: string; handleSignOut: ()=>void; showReportsFlyout?: boolean; toggleReportsFlyout?: ()=>void; closeFlyout?: ()=>void }){
  const [internalShow,setInternalShow]=useState(false);
  const showReportsFlyout=extShow??internalShow; const toggleReportsFlyout=extToggle??(()=>setInternalShow(p=>!p)); const closeFlyout=extClose??(()=>setInternalShow(false));
  return (
    <div className="sidebar-wrapper sticky top-0 h-screen flex shrink-0">
      <nav className="sidebar-icons flex w- flex-col items-center py-4">
        <Tooltip><TooltipTrigger asChild><Link href="/" onClick={closeFlyout} className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 hover:bg-amber-500/20"><IconHome size={20}/></Link></TooltipTrigger><TooltipContent side="right">Home</TooltipContent></Tooltip>
        <Separator className="my-3 w-8 bg-white/10" />
        <div className="flex w-full flex-1 flex-col items-center gap-1">
          {mainNav.map(item=>{const active=pathname===item.href||pathname.startsWith(item.href+'/'); return <Tooltip key={item.href}><TooltipTrigger asChild><Button asChild variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl text-white/60 hover:bg-white/10 hover:text-white",active&&"bg-white/10 text-white")}><Link href={item.href} onClick={closeFlyout}><item.icon size={20}/></Link></Button></TooltipTrigger><TooltipContent side="right">{item.label}</TooltipContent></Tooltip>})}
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleReportsFlyout} className={cn("h-10 w-10 rounded-xl text-white/60 hover:bg-white/10",showReportsFlyout&&"bg-amber-500/15 text-amber-500")}><IconFolder size={20}/></Button></TooltipTrigger><TooltipContent side="right">Reports</TooltipContent></Tooltip>
        </div>
        <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mt-auto h-10 w-10 rounded-xl text-white/60 hover:bg-white/10 data-[state=open]:bg-white/10"><IconSettings size={20}/></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent side="right">Settings</TooltipContent></Tooltip><DropdownMenuContent side="top" align="start" sideOffset={12} className="w-48"><DropdownMenuItem asChild><Link href="/settings" className="flex gap-2"><IconSettings size={16}/> Settings</Link></DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-500"><IconLogout size={16}/> Sign Out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </nav>
      {showReportsFlyout && (<div className="sidebar-flyout"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><span className="text- font-bold uppercase tracking-widest text-amber-500">Reports</span><Button variant="ghost" size="icon" className="h-6 w-6 text-white/50" onClick={closeFlyout}><IconX size={14}/></Button></div><div className="flex flex-col gap-0.5 p-2">{reportsNavList.map(item=><Link key={item.href} href={item.href} onClick={closeFlyout} className={cn("rounded-lg px-3 py-2 text- font-medium text-white/70 hover:bg-white/10 hover:pl-4",pathname===item.href&&"bg-white/10 text-white")}>{item.label}</Link>)}</div></div>)}
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname.startsWith('/auth') || pathname === '/login';
  const [isMounted,setIsMounted]=useState(false);
  const [isAuthenticated,setIsAuthenticated]=useState(false);
  const [currentUserEmail,setCurrentUserEmail]=useState('User');

  useEffect(()=>{setIsMounted(true); const token=localStorage.getItem('token'); const userId=localStorage.getItem('userId'); const userEmail=localStorage.getItem('userEmail'); const hasToken=Boolean(token||userId); setIsAuthenticated(hasToken); if(userEmail)setCurrentUserEmail(userEmail); if(!hasToken&&!isAuthRoute)router.push('/auth');},[pathname,isAuthRoute,router]);

  const changeTheme=(theme:'dark'|'light')=>{(window as any).aumoTheme?.set(theme);};
  const handleSignOut=()=>{localStorage.removeItem('token');localStorage.removeItem('userId');localStorage.removeItem('userEmail');setIsAuthenticated(false);setCurrentUserEmail('User');router.push('/auth');};

  if(!isMounted){return <html lang="en-US" className={cn("dark font-sans antialiased",geist.variable)} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeInitScript}}/></head><body className="bg-background text-foreground min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary"/></body></html>;}

  return (
<html lang="en-US" className="dark font-sans antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:themeInitScript}}/></head>
      <body className="bg-background text-foreground min-h-screen">
        <TooltipProvider delayDuration={0}>
          {isAuthRoute? (
            <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><div className="w-full max-w-">{children}</div></div>
          ) : (
            <div className="flex min-h-screen flex-col">
              <AppTopbar isAuthenticated={isAuthenticated} changeTheme={changeTheme}/>
              <div className="flex flex-1">
                {isAuthenticated && <AppSidebar pathname={pathname} currentUserEmail={currentUserEmail} handleSignOut={handleSignOut}/>}
                <main id="mainContent" className="flex flex-1 flex-col p-2 md:p-6">
                  <div className="flex-1">{children}</div>
                  <footer className="mt-auto border-t pt-3 text-center text- text-muted-foreground"><div className="font-medium text-foreground/80">Aumo Finance by rdmmonlight</div><div>© 2026 rdmmonlight. All rights reserved. Proprietary.</div></footer>
                </main>
              </div>
            </div>
          )}
        </TooltipProvider>
        <Analytics/><SpeedInsights/>
      </body>
    </html>
  );
}