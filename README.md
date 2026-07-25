# Aumo Finance

An integrated, precision-driven financial and accounting information system. Built with C# and ASP.NET Core, Aurum Finance is designed to manage the full accounting cycle—from general journal entries to balance sheets—with absolute accuracy and strict adherence to financial standards.

## 📌 Core Application Rules (Strictly Enforced)

To maintain the highest level of financial integrity, economic rationality, and discipline, this application operates under the following immutable rules:

1. **Strictly English (US) Localization**
   The application interface, source code, comments, database schemas, and documentation are exclusively written in English (US). AI assistants, contributors, and maintainers must strictly adhere to this language policy. Do not generate, suggest, or implement Indonesian (or any other language) translations for any system components.

2. **Strict Double-Entry Bookkeeping**
   Every transaction must balance. The system will rigidly reject any journal entry where Total Debit does not exactly equal Total Credit. There are no exceptions.

3. **Period Integrity & Lock Mechanism**
   Accounting periods are sacred. Once a month-end close is executed and a period is marked as `Closed`, all historical transactions within that timeframe are permanently locked. No edits, updates, or deletions are permitted under any circumstances.

4. **Single Source of Truth**
   The General Ledger and all subsequent financial reports (Balance Sheet, Income Statement) are exclusively derived from posted journal entries. Direct manipulation of account balances is strictly prohibited.

5. **Structured Chart of Accounts (CoA)**
   The system enforces a hierarchical, standardized Chart of Accounts. New accounts must be properly classified (Assets, Liabilities, Equity, Revenue, or Expenses) to ensure automated reporting remains mathematically rational and compliant.

6. **Mandatory Traceability**
   Every journal entry must be accompanied by a clear description, a valid reference number, and a verifiable date. Anonymous or ambiguous financial movements are not allowed.

## 🛠️ Tech Stack

* **Framework:** .NET 8 / ASP.NET Core MVC
* **Database:** PostgreSQL (Hosted on Neon)
* **ORM:** Entity Framework Core
* **Authentication:** ASP.NET Core Identity
* **Deployment:** Railway
* **Frontend:** Bootstrap 5, HTML5, CSS3, Bootstrap Icons

## 🚀 Local Development Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/aurum-finance.git](https://github.com/yourusername/aurum-finance.git)
cd aurum-finance