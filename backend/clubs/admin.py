from django.contrib import admin

from clubs.models import Club, ClubInvite, ClubMember


class ClubMemberInline(admin.TabularInline):
    model = ClubMember
    extra = 0


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    inlines = [ClubMemberInline]
    list_display = ("name", "slug", "created_by", "updated_at")
    search_fields = ("name", "slug", "description")


@admin.register(ClubInvite)
class ClubInviteAdmin(admin.ModelAdmin):
    list_display = ("club", "status", "created_by", "expires_at", "accepted_by")
    list_filter = ("status",)
    search_fields = ("club__name", "token_hash")
