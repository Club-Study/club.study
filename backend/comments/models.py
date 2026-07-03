import uuid

from django.core.exceptions import ValidationError
from django.db import models


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        "schedule.ClubPaperSchedule",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "comments"
        indexes = [
            models.Index(fields=["author"], name="comments_author_id_idx"),
            models.Index(
                fields=["schedule", "created_at"],
                name="comments_schedule_active_idx",
                condition=models.Q(deleted_at__isnull=True),
            ),
        ]

    def clean(self):
        super().clean()
        self.body = self.body.strip()
        if not self.body:
            raise ValidationError({"body": "Comment body is required."})
        if len(self.body) > 5000:
            raise ValidationError({"body": "Comment body must be 5000 characters or less."})

    def __str__(self) -> str:
        return f"{self.author_id} on {self.schedule_id}"
