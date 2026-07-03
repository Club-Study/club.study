from django.contrib import admin

from profiles.models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "avatar_id", "updated_at")
    search_fields = ("display_name", "user__email")
    list_filter = ("avatar_id",)
