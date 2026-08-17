using System;

namespace AumoFinance.Models
{
    // Counter atomik untuk penomoran transaksi (GJ/AJ). Satu baris per
    // kombinasi user + jenis transaksi + periode (CounterKey = prefix +
    // YYMM, contoh "GJ2608"). LastSequence dinaikkan lewat UPSERT atomik
    // (INSERT ... ON CONFLICT DO UPDATE) di TransactionNumberService,
    // bukan MAX(TransactionNumber)+1 — supaya aman terhadap dua user atau
    // dua request yang membuat jurnal secara bersamaan.
    public class TransactionCounter
    {
        public int Id { get; set; }

        public Guid UserId { get; set; }

        [System.ComponentModel.DataAnnotations.Required]
        [System.ComponentModel.DataAnnotations.StringLength(10)]
        public string CounterKey { get; set; } = string.Empty;

        public int LastSequence { get; set; }
    }
}
