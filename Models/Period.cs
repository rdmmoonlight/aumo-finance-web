using System;
using System.ComponentModel.DataAnnotations;

namespace AumoFinance.Models
{
    public class Period
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string PeriodName { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public bool IsClosed { get; set; }
    }
}
