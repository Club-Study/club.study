from django.contrib import admin

from papers.models import Paper, PersonalPaper


@admin.register(Paper)
class PaperAdmin(admin.ModelAdmin):
    list_display = ("title", "source_type", "arxiv_id", "updated_at")
    list_filter = ("source_type",)
    search_fields = ("title", "arxiv_id", "doi")


@admin.register(PersonalPaper)
class PersonalPaperAdmin(admin.ModelAdmin):
    list_display = ("user", "paper", "status", "deadline", "read_at", "created_at")
    list_filter = ("status", "deadline", "read_at")
    search_fields = ("user__display_name", "paper__title", "paper__arxiv_id")
