Aumo Finance

An integrated, precision-driven financial and accounting information system. Built with **C# (.NET 10)** and **ASP.NET Core Web API**, Aumo Finance is designed to manage the full accounting cycle—from general journal entries to balance sheets—with absolute accuracy and strict adherence to financial standards.

## 📌 Core Application Rules (Strictly Enforced)

To maintain the highest level of financial integrity, economic rationality, and discipline, this application operates under the following immutable rules:

1. **Strict Double-Entry Bookkeeping** — Total debits must equal total credits for every transaction.
2. **Period Integrity & Lock Mechanism** — Closed accounting periods are strictly read-only to prevent historical tampering.
3. **Single Source of Truth** — Backend API controls all transaction validation, business rules, and state persistence.
4. **Structured Chart of Accounts (CoA)** — Strict account classification and numbering system.
5. **Mandatory Traceability** — Every transaction is backed by audit trails and generated transaction numbers.

---

## 🛠️ Architecture & Tech Stack

Aumo Finance uses a **Decoupled Monorepo** architecture separating backend services, the primary modern web application, and the legacy interface:

### ⚙️ Core Backend (`/backend`)

* **Framework:** ASP.NET Core Web API (.NET 10)
* **ORM:** Entity Framework Core 10 (EF Core) + Raw ADO.NET for high-performance operations
* **Database:** PostgreSQL (Hosted on Supabase / Neon)
* **Authentication:** ASP.NET Core Identity & JWT Bearer Token
* **Containerization & Hosting:** Docker on Render

### 🌐 Primary Frontend (`/frontend`)

* **Framework:** Next.js (React)
* **Communication:** REST API / JSON over HTTP

### 🏛️ Legacy Interface (`/blazor`) — *In Process of Archiving*

* **Framework:** Blazor Server / Interactive Components (.NET 10)
* **UI Libraries:** Bootstrap 5 & Custom CSS

---

## 📁 Repository Structure

```text
/ (Root Repositori)
├── .github/
│   └── workflows/              # CI/CD Workflows
├── backend/                    # ASP.NET Core Web API (.NET 10)
│   ├── Controllers/
│   ├── Migrations/
│   ├── Models/
│   ├── Services/
│   ├── AumoBackend.csproj
│   └── Dockerfile
├── frontend/                   # Next.js App (Primary Client)
├── blazor/                     # Legacy Blazor App (Referencing Backend)
│   ├── Components/
│   ├── AumoBlazor.csproj
│   └── Dockerfile
└── AumoFinance.sln             # Visual Studio Solution File

```
