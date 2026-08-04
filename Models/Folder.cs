using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AumoFinance.Models;

public class Folder
{
    [Key]
    public Guid Id { get; set; }

    // Pemilik folder ini — folder terisolasi per user, sama seperti dokumen.
    public Guid UserId { get; set; }

    [Required, StringLength(150)]
    public string Name { get; set; } = string.Empty;

    // Null berarti folder berada di root (bukan sub-folder).
    public Guid? ParentFolderId { get; set; }

    [ForeignKey(nameof(ParentFolderId))]
    public Folder? ParentFolder { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
