from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator, RegexValidator
from django.db import models


class Profile(models.Model):
    class AvatarId(models.TextChoices):
        BOOKWORM = "bookworm", "Bookworm"
        CAT = "cat", "Cat"
        DOG = "dog", "Dog"
        WIZARD = "wizard", "Wizard"
        OWL = "owl", "Owl"
        ROBOT = "robot", "Robot"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        db_column="id",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="profile",
    )
    display_name = models.CharField(max_length=120)
    avatar_id = models.CharField(
        max_length=24,
        choices=AvatarId.choices,
        default=AvatarId.BOOKWORM,
    )
    avatar_color = models.CharField(
        max_length=7,
        default="#65a30d",
        validators=[RegexValidator(r"^#[0-9A-Fa-f]{6}$")],
    )
    bio = models.TextField(null=True, blank=True, validators=[MaxLengthValidator(500)])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "profiles"

    def clean(self):
        super().clean()
        self.display_name = self.display_name.strip()
        if not self.display_name:
            raise ValidationError({"display_name": "Display name is required."})
        if self.bio is not None:
            self.bio = self.bio.strip() or None

    def __str__(self) -> str:
        return self.display_name
