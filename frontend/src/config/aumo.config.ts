export interface AumoConfig {
  appName: string;
  appVersion: string;
  description: string;
  apiBaseUrl: string;
  defaultCurrency: string;
  fiscalYearStartMonth: number; // 1 = Januari
  features: {
    enableAiAssistant: boolean;
    enableGuardian: boolean;
    enableAdvancedReports: boolean;
  };
}

export const aumoConfig: AumoConfig = {
  appName: "Aumo Finance",
  appVersion: "9.0.0",
  description: "Independent Accounting & Financial Management System",
  apiBaseUrl: (import.meta as any).env.API_BASE_URL || "http://localhost:8080/api",
  defaultCurrency: "IDR",
  fiscalYearStartMonth: 1,
  features: {
    enableAiAssistant: true,
    enableGuardian: true,
    enableAdvancedReports: true,
  },
};

export default aumoConfig;