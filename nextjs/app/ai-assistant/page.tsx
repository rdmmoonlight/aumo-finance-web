'use client';

import React, { useState, useEffect } from 'react';

// Interface untuk pesan obrolan
interface ChatMessage {
  isUser: boolean;
  text: string;
}

// Fungsi helper internal (tanpa kata kunci export)
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

  // Inisialisasi Ringkasan Otomatis saat Komponen Dimuat
  useEffect(() => {
    const loadLiveSummary = async () => {
      try {
        // Simulasi panggilan API analitik AI
        await new Promise((resolve) => setTimeout(resolve, 1400));
        setSummaryText(
          'Posisi kas dan likuiditas Anda saat ini dalam kondisi sangat stabil dan sehat dengan surplus arus kas positif pada periode Januari 2026. Belanja operasional berada di bawah ambang batas risiko.'
        );
      } catch (err) {
        setSummaryText('Failed to load automated summary. Make sure connection and journal data exist.');
      } finally {
        setSummaryLoaded(true);
      }
    };

    loadLiveSummary();
  }, []);

  // Handler Kirim Pesan / Pertanyaan
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
      // Simulasi respons AI
      await new Promise((resolve) => setTimeout(resolve, 1200));

      let aiReply = '';
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes('cash') || lowerMsg.includes('liquidity')) {
        aiReply =
          '**Analisis Likuiditas:** Total setara kas Anda tercatat aman sebesar **Rp 45.500.000**. Rasio kecukupan likuiditas sangat baik untuk menutupi kewajiban jangka pendek selama 3 bulan ke depan.';
      } else if (lowerMsg.includes('overspending') || lowerMsg.includes('expense')) {
        aiReply =
          '**Peringatan Pengeluaran:** Kategori beban operasional terbesar saat ini adalah **Beban Gaji & Sewa Kantor**. Belum ditemukan lonjakan anomali atau pengeluaran berlebih yang signifikan.';
      } else if (lowerMsg.includes('net income') || lowerMsg.includes('revenue') || lowerMsg.includes('profit')) {
        aiReply =
          '**Proyeksi Pendapatan:** Estimasi total pendapatan kotor untuk periode ini adalah **Rp 85.000.000** dengan proyeksi laba bersih sekitar **Rp 32.400.000** setelah dikurangi beban.';
      } else {
        aiReply =
          'Berdasarkan data akuntansi Anda pada periode aktif, sistem mendapati stabilitas finansial yang konsisten. Apakah Anda ingin melakukan audit mendalam pada jurnal penyesuaian?';
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
    <div className="container-fluid py-4 px-4 text-white">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="fw-bold text-white mb-1">
            <i className="bi bi-robot text-primary me-2"></i> AI Financial Assistant
          </h3>
          <p className="text-white-50 small mb-0">Business analysis, expense detection, and instant financial advice.</p>
        </div>
      </div>

      {/* 1. AI LIVE INSIGHT (Auto Summary Box) */}
      <div className="card glass-card border-0 shadow-sm bg-primary bg-gradient text-white mb-4 rounded-4 overflow-hidden">
        <div className="card-body p-4 position-relative">
          <div className="d-flex align-items-center mb-2">
            <span
              className="badge bg-white text-primary fw-bold px-2 py-1 rounded-pill me-2 shadow-sm"
              style={{ fontSize: '0.75rem' }}
            >
              <i className="bi bi-lightning-charge-fill me-1"></i> LIVE SUMMARY
            </span>
            {summaryLoaded && <small className="text-white-50">Updated just now</small>}
          </div>

          <p className="card-text fs-6 fw-normal mb-0 opacity-95 leading-relaxed">
            {!summaryLoaded ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Analyzing your current cash flow &amp; transactions...
              </>
            ) : (
              summaryText
            )}
          </p>
        </div>
      </div>

      {/* 2. PRESET PROMPT CARDS (Quick Question Boxes) */}
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h6 className="fw-bold text-secondary mb-0">Recommended Quick Questions:</h6>
        <span className="text-white-50 small" style={{ fontSize: '0.8rem' }}>Click a card to ask instantly</span>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <button
            className="card h-100 w-100 border-0 shadow-sm p-3 preset-card rounded-4 text-start bg-body text-white"
            disabled={isLoading}
            onClick={() => handleSendMessage('How is my cash position and liquidity looking right now?')}
          >
            <div className="badge bg-primary-subtle text-primary p-2 rounded-3 mb-2 fit-content">
              <i className="bi bi-cash-stack fs-5"></i>
            </div>
            <div className="fw-bold text-white small mb-1">Cash Health</div>
            <div className="text-white-50 text-truncate w-100" style={{ fontSize: '0.75rem' }}>Check current liquid cash safety</div>
          </button>
        </div>

        <div className="col-md-3 col-6">
          <button
            className="card h-100 w-100 border-0 shadow-sm p-3 preset-card rounded-4 text-start bg-body text-white"
            disabled={isLoading}
            onClick={() => handleSendMessage('Are there any overspending areas or expenses that need review?')}
          >
            <div className="badge bg-danger-subtle text-danger p-2 rounded-3 mb-2 fit-content">
              <i className="bi bi-graph-up-arrow fs-5"></i>
            </div>
            <div className="fw-bold text-white small mb-1">Overspending Alert</div>
            <div className="text-white-50 text-truncate w-100" style={{ fontSize: '0.75rem' }}>Detect highest expense categories</div>
          </button>
        </div>

        <div className="col-md-3 col-6">
          <button
            className="card h-100 w-100 border-0 shadow-sm p-3 preset-card rounded-4 text-start bg-body text-white"
            disabled={isLoading}
            onClick={() => handleSendMessage('What is the estimated net income and revenue trend for this period?')}
          >
            <div className="badge bg-success-subtle text-success p-2 rounded-3 mb-2 fit-content">
              <i className="bi bi-pie-chart-fill fs-5"></i>
            </div>
            <div className="fw-bold text-white small mb-1">Profit Forecast</div>
            <div className="text-white-50 text-truncate w-100" style={{ fontSize: '0.75rem' }}>Project net profit for active period</div>
          </button>
        </div>

        <div className="col-md-3 col-6">
          <button
            className="card h-100 w-100 border-0 shadow-sm p-3 preset-card rounded-4 text-start bg-body text-white"
            disabled={isLoading}
            onClick={() => handleSendMessage('Give me 3 actionable tips to optimize financial performance.')}
          >
            <div className="badge bg-warning-subtle text-warning p-2 rounded-3 mb-2 fit-content">
              <i className="bi bi-lightbulb-fill fs-5"></i>
            </div>
            <div className="fw-bold text-white small mb-1">Efficiency Tips</div>
            <div className="text-white-50 text-truncate w-100" style={{ fontSize: '0.75rem' }}>Pragmatic cost-saving insights</div>
          </button>
        </div>
      </div>

      {/* 3. INTERACTIVE CHAT BOX */}
      <div className="card glass-card border-0 shadow-sm rounded-4">
        <div className="card-header bg-transparent border-bottom border-secondary border-opacity-25 pt-4 px-4 pb-3 d-flex align-items-center justify-content-between">
          <h6 className="fw-bold text-white mb-0">
            <i className="bi bi-chat-dots me-2 text-primary"></i> Conversation
          </h6>
          <button className="btn btn-sm btn-outline-secondary rounded-pill px-3" onClick={clearChat}>
            <i className="bi bi-trash me-1"></i> Clear
          </button>
        </div>
        <div className="card-body p-4">
          {/* Chat Container */}
          <div className="mb-3 pe-2 overflow-y-auto style-scrollbar" style={{ height: '380px' }}>
            {messages.length === 0 && (
              <div className="text-center text-white-50 my-5 py-4">
                <i className="bi bi-robot fs-1 text-secondary opacity-50 d-block mb-2"></i>
                <p className="small mb-0">Click any card above or type a question below to start the discussion.</p>
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`d-flex mb-3 ${msg.isUser ? 'justify-content-end' : 'justify-content-start'}`}>
                <div
                  className={`p-3 rounded-4 shadow-sm ${
                    msg.isUser
                      ? 'bg-primary text-white'
                      : 'bg-body-tertiary border border-secondary border-opacity-25 text-white'
                  }`}
                  style={{
                    maxWidth: '85%',
                    borderBottomRightRadius: msg.isUser ? '4px' : '16px',
                    borderBottomLeftRadius: !msg.isUser ? '4px' : '16px',
                  }}
                >
                  <div
                    className="small leading-relaxed"
                    dangerouslySetInnerHTML={formatMarkdown(msg.text)}
                  ></div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="d-flex justify-content-start mb-3">
                <div
                  className="bg-body-tertiary border border-secondary border-opacity-25 text-white p-3 rounded-4 shadow-sm"
                  style={{ borderBottomLeftRadius: '4px' }}
                >
                  <div className="d-flex align-items-center small text-white-50">
                    <span className="spinner-border spinner-border-sm me-2"></span> AI is analyzing data...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <div className="input-group bg-body-tertiary p-2 rounded-4 border border-secondary border-opacity-25">
            <input
              type="text"
              className="form-control border-0 bg-transparent shadow-none text-white"
              placeholder="Ask anything or request custom analysis..."
              disabled={isLoading}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
            />
            <button
              className="btn btn-primary rounded-3 px-4 fw-semibold shadow-sm"
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage()}
            >
              <i className="bi bi-send-fill me-1"></i> Send
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .preset-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }
        .preset-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }
        .fit-content {
          width: fit-content;
        }
        .style-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .style-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
