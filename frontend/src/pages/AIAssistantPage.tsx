
import React, { useState, useEffect } from 'react';

// Interface for chat messages
interface ChatMessage {
  isUser: boolean;
  text: string;
}

// Internal helper function for basic markdown formatting
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

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [summaryText, setSummaryText] = useState<string>('');
  const [summaryLoaded, setSummaryLoaded] = useState<boolean>(false);

  // Initialize automated summary on component load
  useEffect(() => {
    const loadLiveSummary = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        setSummaryText(
          'Your current cash position and liquidity are very stable and healthy, showing a positive cash flow surplus for January 2026. Operating expenses remain below the risk threshold.'
        );
      } catch (err) {
        setSummaryText('Failed to load automated summary. Make sure connection and journal data exist.');
      } finally {
        setSummaryLoaded(true);
      }
    };

    loadLiveSummary();
  }, []);

  // Send message / question handler
  const handleSendMessage = async (promptText?: string) => {
    const textToSend = promptText !== undefined ? promptText : userInput;
    const message = textToSend.trim();
    if (!message || isLoading) return;

    setMessages((prev) => [...prev, { isUser: true, text: message }]);
    if (promptText === undefined) {
      setUserInput('');
    }
    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      let aiReply = '';
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes('cash') || lowerMsg.includes('liquidity')) {
        aiReply =
          '**Liquidity Analysis:** Your total cash equivalent is safely recorded at **Rp 45,500,000**. The liquidity coverage ratio is excellent to cover short-term obligations over the next 3 months.';
      } else if (lowerMsg.includes('overspending') || lowerMsg.includes('expense')) {
        aiReply =
          '**Expense Alert:** The largest operating expense category is currently **Payroll & Office Rent**. No significant anomalies or overspending spikes have been detected yet.';
      } else if (lowerMsg.includes('net income') || lowerMsg.includes('revenue') || lowerMsg.includes('profit')) {
        aiReply =
          '**Revenue Forecast:** Estimated gross revenue for this period is **Rp 85,000,000** with a projected net profit of approximately **Rp 32,400,000** after expenses.';
      } else {
        aiReply =
          'Based on your accounting data for the active period, the system shows consistent financial stability. Would you like to perform an in-depth audit on adjusting entries?';
      }

      setMessages((prev) => [...prev, { isUser: false, text: aiReply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { isUser: false, text: 'Failed to connect to AI. Please try again later.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="ai-container">
      {/* Header */}
      <div className="ai-header">
        <div>
          <h3 className="ai-title">
            <i className="ti ti-robot ai-title-icon"></i> AI Financial Assistant
          </h3>
          <p className="ai-subtitle">Business analysis, expense detection, and instant financial advice.</p>
        </div>
      </div>

      {/* 1. AI LIVE INSIGHT (Auto Summary Box) */}
      <div className="ai-summary-card">
        <div className="ai-summary-header">
          <span className="ai-summary-badge">
            <i className="ti ti-bolt"></i> LIVE SUMMARY
          </span>
          {summaryLoaded && <span className="ai-summary-time">Updated just now</span>}
        </div>

        <p className="ai-summary-text">
          {!summaryLoaded ? (
            <>
              <span className="ai-spinner"></span>
              Analyzing your current cash flow &amp; transactions...
            </>
          ) : (
            summaryText
          )}
        </p>
      </div>

      {/* 2. PRESET PROMPT CARDS (Quick Questions) */}
      <div className="ai-quick-header">
        <h6 className="ai-quick-title">Recommended Quick Questions:</h6>
        <span className="ai-quick-hint">Click a card to ask instantly</span>
      </div>

      <div className="ai-preset-grid">
        <button
          className="ai-preset-card"
          disabled={isLoading}
          onClick={() => handleSendMessage('How is my cash position and liquidity looking right now?')}
        >
          <div className="ai-icon-badge ai-icon-primary">
            <i className="ti ti-cash-banknote"></i>
          </div>
          <div className="ai-preset-title">Cash Health</div>
          <div className="ai-preset-desc">Check current liquid cash safety</div>
        </button>

        <button
          className="ai-preset-card"
          disabled={isLoading}
          onClick={() => handleSendMessage('Are there any overspending areas or expenses that need review?')}
        >
          <div className="ai-icon-badge ai-icon-danger">
            <i className="ti ti-trending-up"></i>
          </div>
          <div className="ai-preset-title">Overspending Alert</div>
          <div className="ai-preset-desc">Detect highest expense categories</div>
        </button>

        <button
          className="ai-preset-card"
          disabled={isLoading}
          onClick={() => handleSendMessage('What is the estimated net income and revenue trend for this period?')}
        >
          <div className="ai-icon-badge ai-icon-success">
            <i className="ti ti-chart-pie"></i>
          </div>
          <div className="ai-preset-title">Profit Forecast</div>
          <div className="ai-preset-desc">Project net profit for active period</div>
        </button>

        <button
          className="ai-preset-card"
          disabled={isLoading}
          onClick={() => handleSendMessage('Give me 3 actionable tips to optimize financial performance.')}
        >
          <div className="ai-icon-badge ai-icon-warning">
            <i className="ti ti-bulb"></i>
          </div>
          <div className="ai-preset-title">Efficiency Tips</div>
          <div className="ai-preset-desc">Pragmatic cost-saving insights</div>
        </button>
      </div>

      {/* 3. INTERACTIVE CHAT BOX */}
      <div className="ai-chat-card">
        <div className="ai-chat-header">
          <h6 className="ai-chat-title">
            <i className="ti ti-messages" style={{ color: '#3b82f6' }}></i> Conversation
          </h6>
          <button className="ai-clear-btn" onClick={clearChat}>
            <i className="ti ti-trash"></i> Clear
          </button>
        </div>

        <div className="ai-chat-body">
          {/* Chat Container */}
          <div className="ai-message-container">
            {messages.length === 0 && (
              <div className="ai-empty-state">
                <i className="ti ti-robot ai-empty-icon"></i>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>
                  Click any card above or type a question below to start the discussion.
                </p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`ai-message-row ${msg.isUser ? 'ai-user-row' : 'ai-ai-row'}`}
              >
                <div className={`ai-bubble ${msg.isUser ? 'ai-user-bubble' : 'ai-ai-bubble'}`}>
                  <div dangerouslySetInnerHTML={formatMarkdown(msg.text)}></div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="ai-message-row ai-ai-row">
                <div className="ai-bubble ai-ai-bubble">
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
                    <span className="ai-spinner"></span> AI is analyzing data...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="ai-input-wrapper">
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Ask anything or request custom analysis..."
              disabled={isLoading}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <button
              className="ai-send-btn"
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage()}
            >
              <i className="ti ti-send"></i> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
