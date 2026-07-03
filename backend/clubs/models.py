import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, RegexValidator
from django.db import models
from django.utils import timezone


class Club(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=64, unique=True)
    description = models.TextField(
        null=True,
        blank=True,
        validators=[MaxLengthValidator(500)],
    )
    created_by = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.PROTECT,
        related_name="created_clubs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "clubs"
        indexes = [
            models.Index(fields=["created_by"], name="clubs_created_by_idx"),
        ]

    def clean(self):
        super().clean()
        self.name = self.name.strip()
        if not self.name:
            raise ValidationError({"name": "Club name is required."})
        if self.description is not None:
            self.description = self.description.strip() or None

    def __str__(self) -> str:
        return self.name


class ClubMember(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        MEMBER = "member", "Member"

    club = models.ForeignKey(
        Club,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="club_memberships",
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "club_members"
        constraints = [
            models.UniqueConstraint(
                fields=["club", "user"],
                name="club_members_club_user_pk",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "club"],
                name="club_members_user_club_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.club_id}"


class ClubInvite(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name="invites")
    token_hash = models.CharField(max_length=64, unique=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_by = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.PROTECT,
        related_name="created_invites",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_by = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="accepted_invites",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "club_invites"
        constraints = [
            models.UniqueConstraint(
                fields=["club"],
                condition=models.Q(status="pending"),
                name="club_invites_one_pending_per_club_idx",
            ),
            models.CheckConstraint(
                check=(
                    models.Q(expires_at__isnull=True)
                    | models.Q(expires_at__gt=models.F("created_at"))
                ),
                name="club_invites_expires_after_created",
            ),
        ]
        indexes = [
            models.Index(
                fields=["club", "status"],
                name="club_invites_club_status_idx",
            ),
            models.Index(fields=["created_by"], name="club_invites_created_by_idx"),
            models.Index(fields=["accepted_by"], name="club_invites_accepted_by_idx"),
        ]

    def clean(self):
        super().clean()
        if self.expires_at is not None and self.expires_at <= timezone.now():
            raise ValidationError({"expires_at": "Invite expiry must be in the future."})
        if self.status == self.Status.ACCEPTED and not self.accepted_by_id:
            raise ValidationError({"accepted_by": "Accepted invites require a user."})

    def __str__(self) -> str:
        return f"{self.club_id} invite {self.status}"
