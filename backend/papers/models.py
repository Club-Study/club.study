import uuid

from django.core.exceptions import ValidationError
from django.core.validators import URLValidator
from django.db import models


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
