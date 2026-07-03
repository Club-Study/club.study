import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, URLValidator
from django.db import models
from django.utils import timezone


class Paper(models.Model):
    class SourceType(models.TextChoices):
        ARXIV = "arxiv", "arXiv"
        MANUAL = "manual", "Manual"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_type = models.CharField(max_length=16, choices=SourceType.choices)
    title = models.CharField(max_length=500)
    authors = models.JSONField(default=list)
    abstract = models.TextField(null=True, blank=True)
    doi = models.TextField(null=True, blank=True)
    license = models.TextField(null=True, blank=True)
    arxiv_id = models.TextField(null=True, blank=True)
    abstract_url = models.TextField(null=True, blank=True, validators=[URLValidator()])
    pdf_url = models.TextField(null=True, blank=True, validators=[URLValidator()])
    external_url = models.TextField(null=True, blank=True, validators=[URLValidator()])
    page_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
    )
    published_at = models.DateTimeField(null=True, blank=True)
    source_updated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "papers"
        constraints = [
            models.UniqueConstraint(
                fields=["arxiv_id"],
                condition=models.Q(arxiv_id__isnull=False),
                name="papers_arxiv_id_unique_idx",
            ),
            models.CheckConstraint(
                check=(
                    (
                        models.Q(source_type="arxiv")
                        & models.Q(arxiv_id__isnull=False)
                        & models.Q(abstract_url__isnull=False)
                        & models.Q(pdf_url__isnull=False)
                        & models.Q(external_url__isnull=True)
                    )
                    | (
                        models.Q(source_type="manual")
                        & models.Q(external_url__isnull=False)
                        & models.Q(arxiv_id__isnull=True)
                        & models.Q(abstract_url__isnull=True)
                        & models.Q(pdf_url__isnull=True)
                    )
                ),
                name="papers_source_metadata_check",
            ),
        ]

    def clean(self):
        super().clean()
        self.title = self.title.strip()
        if not self.title:
            raise ValidationError({"title": "Paper title is required."})
        if not isinstance(self.authors, list):
            raise ValidationError({"authors": "Authors must be a JSON array."})

        if self.source_type == self.SourceType.ARXIV:
            if not self.arxiv_id or not self.abstract_url or not self.pdf_url:
                raise ValidationError("arXiv papers require arxiv_id and arXiv URLs.")
            if self.external_url:
                raise ValidationError({"external_url": "arXiv papers cannot use external_url."})

        if self.source_type == self.SourceType.MANUAL:
            if not self.external_url:
                raise ValidationError({"external_url": "Manual papers require external_url."})
            if self.arxiv_id or self.abstract_url or self.pdf_url:
                raise ValidationError("Manual papers cannot use arXiv metadata fields.")

    def __str__(self) -> str:
        return self.title


class PersonalPaper(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        READING = "reading", "Reading"
        ON_HOLD = "on_hold", "On hold"
        DROPPED = "dropped", "Dropped"
        READ = "read", "Read"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="personal_papers",
    )
    paper = models.ForeignKey(
        Paper,
        on_delete=models.CASCADE,
        related_name="personal_saves",
    )
    read_at = models.DateTimeField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PLANNED,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "personal_papers"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "paper"],
                name="pers_paper_user_paper_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "created_at"], name="pers_paper_user_created_idx"),
            models.Index(fields=["user", "read_at"], name="pers_paper_user_read_idx"),
            models.Index(fields=["user", "deadline"], name="pers_paper_user_deadline_idx"),
            models.Index(fields=["user", "status"], name="pers_paper_user_status_idx"),
            models.Index(fields=["paper"], name="pers_paper_paper_idx"),
        ]

    def clean(self):
        super().clean()
        if self.status == self.Status.READ:
            self.read_at = self.read_at or timezone.now()
        else:
            self.read_at = None

    def __str__(self) -> str:
        return f"{self.user_id} saved {self.paper_id}"
