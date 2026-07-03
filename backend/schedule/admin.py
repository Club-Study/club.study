from django.contrib import admin

from schedule.models import ClubPaperSchedule, ReadingLog


@admin.register(ClubPaperSchedule)
class ClubPaperScheduleAdmin(admin.ModelAdmin):
    list_display = ("club", "paper", "week_start", "created_by")
    list_filter = ("club", "week_start")
    search_fields = ("paper__title", "club__name")


@admin.register(ReadingLog)
class ReadingLogAdmin(admin.ModelAdmin):
    list_display = ("schedule", "user", "read_at")
    list_filter = ("read_at",)
    search_fields = ("schedule__paper__title", "user__display_name")
