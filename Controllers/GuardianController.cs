using Microsoft.AspNetCore.Mvc;
using AumoFinance.Models.Guardian;

namespace AurumFinance.Controllers;

public class GuardianController : Controller
{
    public IActionResult Index()
    {
        var model = BuildDashboard();

        return View(model);
    }

    public IActionResult Sessions()
    {
        var sessions = new List<ActiveSessionViewModel>
        {
            new()
            {
                DeviceName = "Windows PC",
                Browser = "Chrome",
                IpAddress = "192.168.1.15",
                Country = "Indonesia",
                LastActivity = DateTime.Now,
                IsCurrent = true
            },
            new()
            {
                DeviceName = "Samsung Galaxy",
                Browser = "Chrome Mobile",
                IpAddress = "10.10.0.15",
                Country = "Indonesia",
                LastActivity = DateTime.Now.AddHours(-5),
                IsCurrent = false
            }
        };

        return View(sessions);
    }

    public IActionResult Devices()
    {
        var devices = new List<TrustedDeviceViewModel>
        {
            new()
            {
                Name = "Windows PC",
                Browser = "Chrome",
                AddedOn = DateTime.Now.AddMonths(-3)
            },
            new()
            {
                Name = "Samsung Galaxy",
                Browser = "Chrome Mobile",
                AddedOn = DateTime.Now.AddDays(-12)
            }
        };

        return View(devices);
    }

    public IActionResult Activity()
    {
        var logs = new List<LoginActivityViewModel>
        {
            new()
            {
                Activity = "Successful Login",
                Device = "Windows PC",
                Browser = "Chrome",
                Country = "Indonesia",
                IpAddress = "192.168.1.15",
                OccurredAt = DateTime.Now
            },
            new()
            {
                Activity = "Password Changed",
                Device = "Windows PC",
                Browser = "Chrome",
                Country = "Indonesia",
                IpAddress = "192.168.1.15",
                OccurredAt = DateTime.Now.AddDays(-1)
            }
        };

        return View(logs);
    }

    public IActionResult RecoveryCodes()
    {
        var codes = new List<string>
        {
            "A3X9-BD11-KQ2P",
            "P7LK-991Q-WXZ2",
            "MM28-TUU7-ABCD",
            "QWE9-88LK-HG52",
            "ZXCV-888P-YTR1",
            "PLMK-774Q-WERT",
            "AA88-ZXCV-9988",
            "MNVB-111A-ZXC9"
        };

        return View(codes);
    }

    private static GuardianDashboardViewModel BuildDashboard()
    {
        return new GuardianDashboardViewModel
        {
            Username = "Moonlight",
            Email = "moonlight@example.com",

            Security = new SecurityStatusViewModel
            {
                EmailVerified = true,
                MultiFactorEnabled = false,
                RecoveryCodesAvailable = true,
                PasswordProtected = true
            },

            SecurityScore = 82,

            ActiveSessions = 2,

            TrustedDevices = 2,

            LastLogin = DateTime.Now.AddHours(-2),

            RecentActivities = new List<LoginActivityViewModel>
            {
                new()
                {
                    Activity="Successful Login",
                    Device="Windows PC",
                    Browser="Chrome",
                    Country="Indonesia",
                    IpAddress="192.168.1.15",
                    OccurredAt=DateTime.Now
                },
                new()
                {
                    Activity="Password Changed",
                    Device="Windows PC",
                    Browser="Chrome",
                    Country="Indonesia",
                    IpAddress="192.168.1.15",
                    OccurredAt=DateTime.Now.AddDays(-1)
                }
            }
        };
    }
}
