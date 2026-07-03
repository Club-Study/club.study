import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models


class ClubPaperSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    club = models.ForeignKey(
        "clubs.Club",
        on_delete=models.CASCADE,
        related_name="scheduled_papers",
    )
    paper = models.ForeignKey(
        "papers.Paper",
        on_delete=models.CASCADE,
        related_name="club_schedules",
    )
    week_start = models.DateField()
    notes = models.TextField(
        null=True,
        blank=True,
        validators=[MaxLengthValidator(2000)],
    )
    created_by = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.PROTECT,
        related_name="created_schedules",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "club_paper_schedule"
        constraints = [
            models.UniqueConstraint(
                fields=["club", "week_start"],
                name="club_paper_schedule_club_week_unique",
            ),
            models.CheckConstraint(
                check=models.Q(week_start__week_day=2),
                name="club_paper_schedule_week_start_monday_check",
            ),
        ]
        indexes = [
            models.Index(fields=["paper"], name="club_paper_sched_paper_idx"),
            models.Index(
                fields=["created_by"],
                name="club_paper_sched_creator_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.week_start.weekday() != 0:
            raise ValidationError({"week_start": "Week start must be a Monday."})
        if self.notes is not None:
            self.notes = self.notes.strip() or None

    def __str__(self) -> str:
        return f"{self.club_id} / {self.week_start}"


class ReadingLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        ClubPaperSchedule,
        on_delete=models.CASCADE,
        related_name="reading_logs",
    )
    user = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="reading_logs",
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reading_logs"
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "user"],
                name="reading_logs_schedule_user_unique",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "read_at"],
                name="reading_logs_user_read_idx",
            ),
            models.Index(fields=["schedule"], name="reading_logs_schedule_id_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} read {self.schedule_id}"
