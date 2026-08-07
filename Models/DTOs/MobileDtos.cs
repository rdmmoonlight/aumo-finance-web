namespace AumoFinance.Models.DTOs;

public class MobileLoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class MobileLoginResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
}

public class AccountDto
{
    public int Id { get; set; }
    public int ReferenceNumber { get; set; }
    public string AccountName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}

public class PeriodDto
{
    public int Id { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsClosed { get; set; }
    public bool IsSelected { get; set; }
}

public class CreateJournalEntryRequest
{
    public DateTime EntryDate { get; set; }
    public string JournalType { get; set; } = "GJ"; // GJ = General Journal
    public string? MobileNote { get; set; }
    public List<CreateJournalEntryLineRequest> Lines { get; set; } = new();
}

public class CreateJournalEntryLineRequest
{
    public int AccountId { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string? LineDescription { get; set; }
    public int LineOrder { get; set; }
}
