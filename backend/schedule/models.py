import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, MinValueValidator
from django.db import models
from django.utils import timezone


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
    week_start = models.DateField(null=True, blank=True)
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
        indexes = [
            models.Index(fields=["paper"], name="club_paper_sched_paper_idx"),
            models.Index(
                fields=["created_by"],
                name="club_paper_sched_creator_idx",
            ),
        ]

    def clean(self):
        super().clean()
        if self.notes is not None:
            self.notes = self.notes.strip() or None

    def __str__(self) -> str:
        return f"{self.club_id} / {self.week_start or 'no deadline'}"


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


class SchedulePaperStatus(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        READING = "reading", "Reading"
        ON_HOLD = "on_hold", "On hold"
        DROPPED = "dropped", "Dropped"
        READ = "read", "Read"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        ClubPaperSchedule,
        on_delete=models.CASCADE,
        related_name="user_statuses",
    )
    user = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="schedule_paper_statuses",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PLANNED,
    )
    read_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "schedule_paper_statuses"
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "user"],
                name="sched_paper_status_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"], name="sched_status_user_idx"),
            models.Index(fields=["schedule", "status"], name="sched_status_sched_idx"),
        ]

    def clean(self):
        super().clean()
        if self.status == self.Status.READ:
            self.read_at = self.read_at or timezone.now()
        else:
            self.read_at = None

    def __str__(self) -> str:
        return f"{self.user_id} marked {self.schedule_id} {self.status}"


class ReadingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        ClubPaperSchedule,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reading_sessions",
    )
    personal_paper = models.ForeignKey(
        "papers.PersonalPaper",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="reading_sessions",
    )
    user = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="reading_sessions",
    )
    pages_read = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reading_sessions"
        constraints = [
            models.CheckConstraint(
                check=(
                    (
                        models.Q(schedule__isnull=False)
                        & models.Q(personal_paper__isnull=True)
                    )
                    | (
                        models.Q(schedule__isnull=True)
                        & models.Q(personal_paper__isnull=False)
                    )
                ),
                name="read_sess_one_context_chk",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "logged_at"],
                name="read_sess_user_logged_idx",
            ),
            models.Index(fields=["schedule"], name="read_sess_schedule_idx"),
            models.Index(
                fields=["personal_paper"],
                name="read_sess_personal_idx",
            ),
        ]

    def clean(self):
        super().clean()
        has_schedule = self.schedule_id is not None
        has_personal_paper = self.personal_paper_id is not None
        if has_schedule == has_personal_paper:
            raise ValidationError(
                "Reading session requires exactly one of schedule or personal_paper."
            )

    def __str__(self) -> str:
        return f"{self.user_id} read {self.pages_read} pages"
