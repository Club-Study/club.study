from django.contrib import admin

from annotations.models import PaperAnnotation, PaperAnnotationReply


class PaperAnnotationReplyInline(admin.TabularInline):
    model = PaperAnnotationReply
    extra = 0


@admin.register(PaperAnnotation)
class PaperAnnotationAdmin(admin.ModelAdmin):
    inlines = [PaperAnnotationReplyInline]
    list_display = ("kind", "schedule", "paper", "author", "page_number", "deleted_at")
    list_filter = ("kind", "deleted_at")
    search_fields = ("body", "quote", "author__display_name", "paper__title")
