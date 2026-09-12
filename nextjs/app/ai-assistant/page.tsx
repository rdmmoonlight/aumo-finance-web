'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconRobot,
  IconBolt,
  IconCashBanknote,
  IconTrendingUp,
  IconChartPie,
  IconBulb,
  IconMessages,
  IconTrash,
  IconSend,
  IconLoader2,
  IconSparkles,
} from '@tabler/icons-react';

interface ChatMessage {
  isUser: boolean;
  text: string;
}

function formatMarkdown(text: string): { __html: string } {
  let escaped = text
   .replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
   .replace(/'/g, '&#039;');
  escaped = escaped.replace(/\n/g, '<br>');
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return { __html: escaped };
}

const QUICK_PROMPTS = [
  {
    icon: IconCashBanknote,
    title: 'Cash Health',
    desc: 'Check current liquid cash safety',
    prompt: 'How is my cash position and liquidity looking right now?',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    icon: IconTrendingUp,
    title: 'Overspending Alert',
    desc: 'Detect highest expense categories',
    prompt: 'Are there any overspending areas or expenses that need review?',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  {
    icon: IconChartPie,
    title: 'Profit Forecast',
    desc: 'Project net profit for active period',
    prompt: 'What is the estimated net income and revenue trend for this period?',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    icon: IconBulb,
    title: 'Efficiency Tips',
    desc: 'Pragmatic cost-saving insights',
    prompt: 'Give me 3 actionable tips to optimize financial performance.',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadLiveSummary = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        setSummaryText(
          'Your current cash position and liquidity are very stable and healthy, showing a positive cash flow surplus for January 2026. Operating expenses remain below the risk threshold.'
        );
      } catch {
        setSummaryText('Failed to load automated summary. Make sure connection and journal data exist.');
      } finally {
        setSummaryLoaded(true);
      }
    };
    loadLiveSummary();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (promptText?: string) => {
    const textToSend = promptText?? userInput;
    const message = textToSend.trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { isUser: true, text: message }]);
    if (promptText === undefined) setUserInput('');
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const lower = message.toLowerCase();
      let reply = '';
      if (lower.includes('cash') || lower.includes('liquidity')) {
        reply = '**Liquidity Analysis:** Your total cash equivalent is safely recorded at **Rp 45,500,000**. The liquidity coverage ratio is excellent to cover short-term obligations over the next 3 months.';
      } else if (lower.includes('overspending') || lower.includes('expense')) {
        reply = '**Expense Alert:** The largest operating expense category is currently **Payroll & Office Rent**. No significant anomalies or overspending spikes have been detected yet.';
      } else if (lower.includes('net income') || lower.includes('revenue') || lower.includes('profit')) {
        reply = '**Revenue Forecast:** Estimated gross revenue for this period is **Rp 85,000,000** with a projected net profit of approximately **Rp 32,400,000** after expenses.';
      } else {
        reply = 'Based on your accounting data for the active period, the system shows consistent financial stability. Would you like to perform an in-depth audit on adjusting entries?';
      }
      setMessages((prev) => [...prev, { isUser: false, text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { isUser: false, text: 'Failed to connect to AI. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IconRobot className="h-5 w-5" />
          </span>
          AI Financial Assistant
        </h1>
        <p className="text-sm text-muted-foreground">Business analysis, expense detection, and instant financial advice.</p>
      </div>

      {/* LIVE SUMMARY */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="gap-1.5 font-mono text-">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <IconBolt className="h-3 w-3" /> LIVE SUMMARY
            </Badge>
            {summaryLoaded && <span className="text-xs text-muted-foreground">Updated just now</span>}
          </div>
        </CardHeader>
        <CardContent>
          {!summaryLoaded? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <IconLoader2 className="h-3 w-3 animate-spin" /> Analyzing your current cash flow & transactions...
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{summaryText}</p>
          )}
        </CardContent>
      </Card>

      {/* QUICK QUESTIONS */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recommended Quick Questions</h2>
          <span className="text-xs text-muted-foreground">Click a card to ask instantly</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_PROMPTS.map((item) => (
            <Card
              key={item.title}
              className="group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
              onClick={() =>!isLoading && handleSendMessage(item.prompt)}
            >
              <CardContent className="p-4">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${item.color}`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <Card className="flex h- flex-col">
        <CardHeader className="flex-row items-center justify-between space-y-0 py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconMessages className="h-4 w-4 text-primary" /> Conversation
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <IconTrash className="h-4 w-4" /> Clear
          </Button>
        </CardHeader>
        <Separator />
        <CardContent className="flex flex-1 flex-col gap-0 p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <IconSparkles className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="max-w- text-sm text-muted-foreground">
                    Click any card above or type a question below to start the discussion.
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.isUser? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.isUser? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                    <div dangerouslySetInnerHTML={formatMarkdown(msg.text)} />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
                    <IconLoader2 className="h-4 w-4 animate-spin" /> AI is analyzing data...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ask anything or request custom analysis..."
                disabled={isLoading}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button onClick={() => handleSendMessage()} disabled={isLoading ||!userInput.trim()}>
                <IconSend className="h-4 w-4" /> Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}