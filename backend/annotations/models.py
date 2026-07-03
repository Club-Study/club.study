import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, RegexValidator
from django.db import models


class PaperAnnotation(models.Model):
    class Kind(models.TextChoices):
        HIGHLIGHT = "highlight", "Highlight"
        QUESTION = "question", "Question"
        EXPLANATION = "explanation", "Explanation"
        NOTE = "note", "Note"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        "schedule.ClubPaperSchedule",
        on_delete=models.CASCADE,
        related_name="annotations",
    )
    paper = models.ForeignKey(
        "papers.Paper",
        on_delete=models.CASCADE,
        related_name="annotations",
    )
    author = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="paper_annotations",
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    page_number = models.PositiveIntegerField()
    position = models.JSONField()
    quote = models.TextField(
        null=True,
        blank=True,
        validators=[MaxLengthValidator(5000)],
    )
    body = models.TextField(
        null=True,
        blank=True,
        validators=[MaxLengthValidator(5000)],
    )
    color = models.CharField(
        max_length=7,
        default="#facc15",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$")],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "paper_annotations"
        indexes = [
            models.Index(
                fields=["schedule", "paper", "page_number", "created_at"],
                name="paper_ann_page_active_idx",
                condition=models.Q(deleted_at__isnull=True),
            ),
            models.Index(fields=["author"], name="paper_ann_author_idx"),
        ]

    def clean(self):
        super().clean()
        if not isinstance(self.position, dict):
            raise ValidationError({"position": "Annotation position must be an object."})
        if self.quote is not None:
            self.quote = self.quote.strip() or None
        if self.body is not None:
            self.body = self.body.strip() or None

    def __str__(self) -> str:
        return f"{self.kind} on page {self.page_number}"


class PaperAnnotationReply(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    annotation = models.ForeignKey(
        PaperAnnotation,
        on_delete=models.CASCADE,
        related_name="replies",
    )
    author = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="annotation_replies",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "paper_annotation_replies"
        indexes = [
            models.Index(
                fields=["annotation", "created_at"],
                name="ann_reply_created_active_idx",
                condition=models.Q(deleted_at__isnull=True),
            ),
            models.Index(
                fields=["author"],
                name="ann_reply_author_idx",
            ),
        ]

    def clean(self):
        super().clean()
        self.body = self.body.strip()
        if not self.body:
            raise ValidationError({"body": "Reply body is required."})
        if len(self.body) > 5000:
            raise ValidationError({"body": "Reply body must be 5000 characters or less."})

    def __str__(self) -> str:
        return f"{self.author_id} reply to {self.annotation_id}"
