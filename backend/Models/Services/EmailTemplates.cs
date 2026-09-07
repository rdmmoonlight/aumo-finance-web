namespace AumoFinance.Services
{
    /// <summary>
    /// Builds the HTML body for transactional auth emails (account
    /// confirmation, password reset). Kept as plain string templates —
    /// table-based layout with inline styles — so the markup renders
    /// consistently across email clients (Gmail, Outlook, etc.), which
    /// strip external stylesheets and most modern CSS.
    /// </summary>
    public static class EmailTemplates
    {
        private const string AccentColor = "#0d6efd";
        private const string DarkColor = "#181818";
        private const string MutedColor = "#6c757d";

        public static string EmailConfirmation(string? fullName, string confirmUrl)
        {
            var greetingName = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;

            var bodyHtml = $@"
                <p style=""margin:0 0 16px;"">Hi {greetingName},</p>
                <p style=""margin:0 0 16px;"">
                    Thanks for signing up for Aumo Finance. Confirm your email address to activate your account and start managing your finances.
                </p>
                <p style=""margin:0 0 8px;color:{MutedColor};font-size:13px;"">
                    This link will expire once used. If you didn't create this account, you can safely ignore this email.
                </p>";

            return Layout(
                previewText: "Confirm your email to activate your Aumo Finance account.",
                heading: "Confirm your email",
                bodyHtml: bodyHtml,
                buttonText: "Confirm Email Address",
                buttonUrl: confirmUrl);
        }

        public static string PasswordReset(string? fullName, string resetUrl)
        {
            var greetingName = string.IsNullOrWhiteSpace(fullName) ? "there" : fullName;

            var bodyHtml = $@"
                <p style=""margin:0 0 16px;"">Hi {greetingName},</p>
                <p style=""margin:0 0 16px;"">
                    We received a request to reset the password for your Aumo Finance account. Click the button below to choose a new password.
                </p>
                <p style=""margin:0 0 8px;color:{MutedColor};font-size:13px;"">
                    If you didn't request a password reset, you can safely ignore this email — your password won't be changed.
                </p>";

            return Layout(
                previewText: "Reset the password for your Aumo Finance account.",
                heading: "Reset your password",
                bodyHtml: bodyHtml,
                buttonText: "Reset Password",
                buttonUrl: resetUrl);
        }

        private static string Layout(string previewText, string heading, string bodyHtml, string buttonText, string buttonUrl)
        {
            return $@"
<!DOCTYPE html>
<html lang=""en"">
<head>
<meta charset=""utf-8"" />
<meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
<title>Aumo Finance</title>
</head>
<body style=""margin:0;padding:0;background-color:#f2f3f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;"">
    <!-- Preview text (hidden) -->
    <div style=""display:none;max-height:0;overflow:hidden;"">{previewText}</div>

    <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f2f3f5;padding:32px 16px;"">
        <tr>
            <td align=""center"">
                <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"">
                    <!-- Header -->
                    <tr>
                        <td style=""background-color:{DarkColor};padding:20px 32px;"">
                            <span style=""color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;"">Aumo Finance</span>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style=""padding:32px;color:#212529;font-size:15px;line-height:1.5;"">
                            <h1 style=""margin:0 0 20px;font-size:20px;font-weight:700;color:#212529;"">{heading}</h1>
                            {bodyHtml}
                            <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" style=""margin:24px 0 8px;"">
                                <tr>
                                    <td style=""border-radius:6px;background-color:{AccentColor};"">
                                        <a href=""{buttonUrl}"" style=""display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;"">{buttonText}</a>
                                    </td>
                                </tr>
                            </table>
                            <p style=""margin:16px 0 0;font-size:13px;color:{MutedColor};word-break:break-all;"">
                                Or copy and paste this link into your browser:<br />
                                <a href=""{buttonUrl}"" style=""color:{AccentColor};"">{buttonUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style=""padding:20px 32px;background-color:#f8f9fa;border-top:1px solid #e9ecef;"">
                            <p style=""margin:0;font-size:12px;color:{MutedColor};"">
                                &copy; {DateTime.UtcNow.Year} Aumo Finance. This is an automated message, please don't reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>";
        }
    }
}
