namespace AumoFinance.Models
{
    // Aturan klasifikasi akun akuntansi dipusatkan di satu tempat, supaya
    // Chart of Accounts, Journal Entry, General Journal, General Ledger, dan
    // General Ledger (Temporary Accounts) memakai definisi yang sama persis.
    public static class AccountClassification
    {
        private static readonly HashSet<string> PermanentTypes = new()
        {
            "Assets", "Liabilities", "Equity"
        };

        private static readonly HashSet<string> TemporaryTypes = new()
        {
            "OperatingIncome", "OperatingExpenses", "OtherIncome", "OtherExpenses"
        };

        private static readonly HashSet<string> NormalDebitTypes = new()
        {
            "Assets", "OperatingExpenses", "OtherExpenses"
        };

        // Akun riil/permanen (Neraca): saldo dibawa terus antar periode.
        public static bool IsPermanent(string type) => PermanentTypes.Contains(type);

        // Akun nominal/sementara (Laba Rugi): ditutup ke Equity/Retained
        // Earnings pada akhir periode.
        public static bool IsTemporary(string type) => TemporaryTypes.Contains(type);

        public static bool NormalBalanceIsDebit(string type) => NormalDebitTypes.Contains(type);

        public static int ValidRangeStart(string type) => type switch
        {
            "Assets" => 100,
            "Liabilities" => 200,
            "Equity" => 300,
            "OperatingIncome" => 400,
            "OperatingExpenses" => 500,
            "OtherIncome" => 600,
            "OtherExpenses" => 800,
            _ => 0
        };

        public static int ValidRangeEnd(string type) => type switch
        {
            "Assets" => 199,
            "Liabilities" => 299,
            "Equity" => 399,
            "OperatingIncome" => 499,
            "OperatingExpenses" => 599,
            "OtherIncome" => 799,
            "OtherExpenses" => 999,
            _ => 0
        };

        public static bool ValidateReferenceNumber(string type, int referenceNumber)
        {
            var start = ValidRangeStart(type);
            var end = ValidRangeEnd(type);
            return start != 0 && referenceNumber >= start && referenceNumber <= end;
        }

        // Kebalikan dari ValidRangeStart/End: dipakai saat auto-membuat akun
        // baru ke Chart of Accounts pada waktu import, supaya Type otomatis
        // mengikuti rentang nomor Ref yang diinput user (tidak perlu diminta
        // manual di template import).
        public static string? TypeFromReferenceNumber(int referenceNumber) => referenceNumber switch
        {
            >= 100 and <= 199 => "Assets",
            >= 200 and <= 299 => "Liabilities",
            >= 300 and <= 399 => "Equity",
            >= 400 and <= 499 => "OperatingIncome",
            >= 500 and <= 599 => "OperatingExpenses",
            >= 600 and <= 799 => "OtherIncome",
            >= 800 and <= 999 => "OtherExpenses",
            _ => null
        };
    }
}
