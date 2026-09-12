import { useState, useEffect } from 'react';
import { IconRobot, IconBolt, IconCashBanknote, IconTrendingUp, IconChartPie, IconBulb, IconTrash, IconSend, IconSparkles } from '@tabler/icons-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ChatMessage { isUser: boolean; text: string; }

function formatBold(text: string) {
  return text.split(/(\*\*.*?\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-foreground">{part.slice(2,-2)}</strong>
    }
    return part
  })
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoaded, setSummaryLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSummaryText('Your cash position and liquidity are very stable, positive surplus for Jan 2026. Operating expenses below risk threshold.');
      setSummaryLoaded(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const handleSendMessage = async (promptText?: string) => {
    const textToSend = promptText?? userInput;
    const message = textToSend.trim();
    if (!message || isLoading) return;

    setMessages(prev => [...prev, { isUser: true, text: message }]);
    if (!promptText) setUserInput('');
    setIsLoading(true);

    await new Promise(r => setTimeout(r, 1000));

    let aiReply = '';
    const low = message.toLowerCase();
    if (low.includes('cash') || low.includes('liquidity')) {
      aiReply = '**Liquidity Analysis:** Total cash equivalent **Rp 45,500,000**. Coverage ratio excellent for next 3 months.';
    } else if (low.includes('overspending') || low.includes('expense')) {
      aiReply = '**Expense Alert:** Largest expense is **Payroll & Office Rent**. No anomalies detected.';
    } else if (low.includes('net income') || low.includes('revenue') || low.includes('profit')) {
      aiReply = '**Revenue Forecast:** Gross revenue **Rp 85,000,000** with net profit **Rp 32,400,000**.';
    } else {
      aiReply = 'Based on active period data, financial stability is consistent. Want in-depth audit on adjusting entries?';
    }

    setMessages(prev => [...prev, { isUser: false, text: aiReply }]);
    setIsLoading(false);
  };

  const presets = [
    { icon: IconCashBanknote, title: 'Cash Health', desc: 'Check liquid cash safety', prompt: 'How is my cash position and liquidity looking right now?', color: 'text-blue-500 bg-blue-500/10' },
    { icon: IconTrendingUp, title: 'Overspending Alert', desc: 'Detect highest expense', prompt: 'Are there any overspending areas or expenses that need review?', color: 'text-red-500 bg-red-500/10' },
    { icon: IconChartPie, title: 'Profit Forecast', desc: 'Project net profit', prompt: 'What is the estimated net income and revenue trend for this period?', color: 'text-emerald-500 bg-emerald-500/10' },
    { icon: IconBulb, title: 'Efficiency Tips', desc: 'Cost-saving insights', prompt: 'Give me 3 actionable tips to optimize financial performance.', color: 'text-amber-500 bg-amber-500/10' },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <IconRobot size={26} className="text-primary" /> AI Financial Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Business analysis, expense detection, and instant financial advice.</p>
      </div>

      {/* LIVE SUMMARY */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
              <IconBolt size={12}/> LIVE SUMMARY
            </Badge>
            {summaryLoaded && <span className="text- text-muted-foreground">Updated just now</span>}
          </div>
        </CardHeader>
        <CardContent>
          {!summaryLoaded? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
              Analyzing your current cash flow & transactions...
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{summaryText}</p>
          )}
        </CardContent>
      </Card>

      {/* PRESETS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recommended Quick Questions</h3>
          <span className="text-xs text-muted-foreground">Click to ask instantly</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presets.map(p => (
            <Card key={p.title} className="cursor-pointer hover:bg-accent/50 transition-colors group" onClick={()=>handleSendMessage(p.prompt)}>
              <CardContent className="p-4">
                <div className={cn('w-9 h-9 rounded-lg grid place-items-center mb-3', p.color)}>
                  <p.icon size={18}/>
                </div>
                <div className="font-medium text-sm">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <Card className="flex flex-col h-">
        <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0 border-b">
          <CardTitle className="text-sm flex items-center gap-2"><IconSparkles size={16} className="text-primary"/> Conversation</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={()=>setMessages([])}><IconTrash size={14}/> Clear</Button>
        </CardHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {messages.length===0 && (
              <div className="py-16 text-center text-muted-foreground">
                <IconRobot size={36} className="mx-auto mb-3 opacity-20"/>
                <p className="text-sm">Click any card above or type a question below.</p>
              </div>
            )}
            {messages.map((m,i)=>(
              <div key={i} className={cn('flex', m.isUser? 'justify-end':'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  m.isUser? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                )}>
                  {formatBold(m.text)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
                  AI is analyzing data...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Ask anything or request custom analysis..."
            value={userInput}
            onChange={e=>setUserInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleSendMessage()}
            disabled={isLoading}
            className="h-10"
          />
          <Button onClick={()=>handleSendMessage()} disabled={isLoading} className="h-10 px-4 gap-1.5">
            <IconSend size={16}/> Send
          </Button>
        </div>
      </Card>
    </div>
  );
}