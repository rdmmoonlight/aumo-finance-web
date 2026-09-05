// File: wwwroot/js/chartOfAccount.ts
export interface ChartOfAccount {
    id: number;
    referenceNumber: number;
    accountName: string;
    type: string;
    role: string;
    balance: number;
    isActive: boolean;
}