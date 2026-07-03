import hashlib
import secrets
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.text import slugify
from rest_framework.exceptions import (
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    ValidationError,
)

from annotations.models import PaperAnnotation, PaperAnnotationReply
from clubs.models import Club, ClubInvite, ClubMember
from comments.models import Comment
from papers.models import Paper
from profiles.models import Profile
from schedule.models import ClubPaperSchedule, ReadingLog


def current_profile(user):
    if not user.is_authenticated:
        raise NotAuthenticated("Sign in required.")

    try:
        return user.profile
    except Profile.DoesNotExist as error:
        raise NotFound("Signed-in user does not have a profile.") from error


def clean_and_save(instance):
    try:
        instance.full_clean()
    except DjangoValidationError as error:
        raise ValidationError(error.message_dict if hasattr(error, "message_dict") else error.messages)

    try:
        instance.save()
    except IntegrityError as error:
        raise ValidationError(str(error)) from error

    return instance


def ensure_member(profile, club_id):
    try:
        return ClubMember.objects.select_related("club", "user").get(
            club_id=club_id,
            user=profile,
        )
    except ClubMember.DoesNotExist as error:
        raise PermissionDenied("Club membership required.") from error


def ensure_owner(profile, club_id):
    membership = ensure_member(profile, club_id)

    if membership.role != ClubMember.Role.OWNER:
        raise PermissionDenied("Club owner role required.")

    return membership


def ensure_schedule_member(profile, schedule_id, club_id=None):
    schedules = ClubPaperSchedule.objects.select_related(
        "club",
        "paper",
        "created_by",
    )

    if club_id is not None:
        schedules = schedules.filter(club_id=club_id)

    try:
        schedule = schedules.get(id=schedule_id)
    except ClubPaperSchedule.DoesNotExist as error:
        raise NotFound("Scheduled paper not found.") from error

    ensure_member(profile, schedule.club_id)
    return schedule


def create_club(profile, name, description):
    club = Club(
        name=name,
        slug=generate_unique_slug(name),
        description=description,
        created_by=profile,
    )
    clean_and_save(club)
    ClubMember.objects.create(club=club, user=profile, role=ClubMember.Role.OWNER)
    return club


def generate_unique_slug(name):
    base = slugify(name).strip("-")[:57] or "club"

    for _attempt in range(20):
        suffix = secrets.token_hex(3)
        slug = "{}-{}".format(base[: 64 - len(suffix) - 1].strip("-") or "club", suffix)
        if not Club.objects.filter(slug=slug).exists():
            return slug

    raise ValidationError("Could not generate a unique club slug.")


def create_invite_link(profile, club_id):
    ensure_owner(profile, club_id)

    token = secrets.token_urlsafe(32)
    invite = ClubInvite(
        club_id=club_id,
        token_hash=hash_token(token),
        status=ClubInvite.Status.PENDING,
        created_by=profile,
        expires_at=timezone.now() + timedelta(days=14),
    )

    with transaction.atomic():
        ClubInvite.objects.filter(
            club_id=club_id,
            status=ClubInvite.Status.PENDING,
        ).update(status=ClubInvite.Status.REVOKED)
        clean_and_save(invite)

    return invite, token


def revoke_invite_link(profile, invite_id):
    try:
        invite = ClubInvite.objects.select_related("club").get(id=invite_id)
    except ClubInvite.DoesNotExist as error:
        raise NotFound("Invite not found.") from error

    ensure_owner(profile, invite.club_id)

    if invite.status != ClubInvite.Status.PENDING:
        raise ValidationError("Only pending invites can be revoked.")

    invite.status = ClubInvite.Status.REVOKED
    invite.save(update_fields=["status"])
    return invite


def accept_invite(profile, token):
    if not isinstance(token, str) or not token.strip():
        raise ValidationError("Invite token is required.")

    with transaction.atomic():
        try:
            invite = ClubInvite.objects.select_for_update().select_related("club").get(
                token_hash=hash_token(token.strip())
            )
        except ClubInvite.DoesNotExist as error:
            raise NotFound("Invite not found.") from error

        if invite.status != ClubInvite.Status.PENDING:
            raise ValidationError("Invite is not pending.")

        if invite.expires_at is not None and invite.expires_at <= timezone.now():
            invite.status = ClubInvite.Status.EXPIRED
            invite.save(update_fields=["status"])
            raise ValidationError("Invite has expired.")

        membership, _created = ClubMember.objects.get_or_create(
            club=invite.club,
            user=profile,
            defaults={"role": ClubMember.Role.MEMBER},
        )
        invite.status = ClubInvite.Status.ACCEPTED
        invite.accepted_by = profile
        invite.accepted_at = timezone.now()
        clean_and_save(invite)

    return membership


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def list_visible_clubs(profile):
    return Club.objects.filter(memberships__user=profile).order_by("-updated_at")


def get_visible_club(profile, club_id):
    ensure_member(profile, club_id)

    try:
        return Club.objects.get(id=club_id)
    except Club.DoesNotExist as error:
        raise NotFound("Club not found.") from error


def list_members(profile, club_id):
    ensure_member(profile, club_id)
    return (
        ClubMember.objects.select_related("user")
        .filter(club_id=club_id)
        .order_by("created_at")
    )


def list_invites(profile, club_id):
    ensure_owner(profile, club_id)
    return ClubInvite.objects.filter(club_id=club_id).order_by("-created_at")


def list_club_schedule(profile, club_id):
    ensure_member(profile, club_id)
    return (
        ClubPaperSchedule.objects.select_related("paper", "created_by")
        .filter(club_id=club_id)
        .order_by("-week_start")
    )


def list_dashboard_schedule(profile, from_week_start):
    week_start = parse_date_value(from_week_start, "from_week_start")
    return (
        ClubPaperSchedule.objects.select_related("club", "paper", "created_by")
        .filter(club__memberships__user=profile, week_start__gte=week_start)
        .order_by("week_start")[:20]
    )


def get_club_progress(profile, club_id):
    ensure_member(profile, club_id)
    schedules = ClubPaperSchedule.objects.filter(club_id=club_id).order_by("-week_start")
    total_members = ClubMember.objects.filter(club_id=club_id).count()
    read_counts = {
        str(row["schedule_id"]): row["count"]
        for row in ReadingLog.objects.filter(schedule__club_id=club_id)
        .values("schedule_id")
        .annotate(count=Count("id"))
    }
    current_reads = {
        str(schedule_id)
        for schedule_id in ReadingLog.objects.filter(
            schedule__club_id=club_id,
            user=profile,
        ).values_list("schedule_id", flat=True)
    }

    return [
        {
            "schedule_id": str(schedule.id),
            "total_members": total_members,
            "read_count": read_counts.get(str(schedule.id), 0),
            "current_user_read": str(schedule.id) in current_reads,
        }
        for schedule in schedules
    ]


def schedule_arxiv_paper(profile, club_id, week_start, metadata, notes=None):
    ensure_member(profile, club_id)
    paper = upsert_arxiv_paper(metadata)
    return create_schedule(profile, club_id, paper, week_start, notes)


def schedule_manual_paper(profile, club_id, week_start, metadata, notes=None):
    ensure_member(profile, club_id)
    paper = create_manual_paper(metadata)
    return create_schedule(profile, club_id, paper, week_start, notes)


def upsert_arxiv_paper(metadata):
    data = object_value(metadata, "metadata")
    arxiv_id = text_value(data, "arxiv_id")
    values = {
        "source_type": Paper.SourceType.ARXIV,
        "title": text_value(data, "title"),
        "authors": authors_value(data.get("authors")),
        "abstract": nullable_text(data.get("abstract")),
        "doi": nullable_text(data.get("doi")),
        "license": nullable_text(data.get("license")),
        "arxiv_id": arxiv_id,
        "abstract_url": text_value(data, "abstract_url"),
        "pdf_url": text_value(data, "pdf_url"),
        "external_url": None,
        "published_at": nullable_datetime(data.get("published_at"), "published_at"),
        "source_updated_at": nullable_datetime(data.get("updated_at"), "updated_at"),
    }
    paper, _created = Paper.objects.update_or_create(
        arxiv_id=arxiv_id,
        defaults=values,
    )
    return clean_and_save(paper)


def create_manual_paper(metadata):
    data = object_value(metadata, "metadata")
    paper = Paper(
        source_type=Paper.SourceType.MANUAL,
        title=text_value(data, "title"),
        authors=authors_value(data.get("authors")),
        abstract=nullable_text(data.get("abstract")),
        doi=nullable_text(data.get("doi")),
        license=nullable_text(data.get("license")),
        arxiv_id=None,
        abstract_url=None,
        pdf_url=None,
        external_url=text_value(data, "external_url"),
    )
    return clean_and_save(paper)


def create_schedule(profile, club_id, paper, week_start, notes):
    schedule = ClubPaperSchedule(
        club_id=club_id,
        paper=paper,
        week_start=parse_date_value(week_start, "week_start"),
        notes=nullable_text(notes),
        created_by=profile,
    )
    return clean_and_save(schedule)


def toggle_read_status(profile, schedule_id, read):
    schedule = ensure_schedule_member(profile, schedule_id)

    if read is True:
        log, _created = ReadingLog.objects.get_or_create(schedule=schedule, user=profile)
        return {
            "schedule_id": str(schedule.id),
            "read": True,
            "reading_log_id": str(log.id),
        }

    if read is False:
        ReadingLog.objects.filter(schedule=schedule, user=profile).delete()
        return {
            "schedule_id": str(schedule.id),
            "read": False,
            "reading_log_id": None,
        }

    raise ValidationError("Read must be true or false.")


def list_profile_overview(profile):
    memberships = (
        ClubMember.objects.select_related("club")
        .filter(user=profile)
        .order_by("created_at")
    )
    reading_logs = (
        ReadingLog.objects.select_related(
            "schedule",
            "schedule__club",
            "schedule__paper",
        )
        .filter(user=profile)
        .order_by("-read_at")
    )
    scheduled_papers = (
        ClubPaperSchedule.objects.select_related("club", "paper")
        .filter(club__memberships__user=profile)
        .order_by("-week_start")
    )

    return memberships, reading_logs, scheduled_papers


def list_comments(profile, schedule_id):
    schedule = ensure_schedule_member(profile, schedule_id)
    return (
        Comment.objects.select_related("author")
        .filter(schedule=schedule, deleted_at__isnull=True)
        .order_by("created_at")
    )


def create_comment(profile, schedule_id, body):
    schedule = ensure_schedule_member(profile, schedule_id)
    comment = Comment(schedule=schedule, author=profile, body=text_value({"body": body}, "body"))
    return clean_and_save(comment)


def update_comment(profile, comment_id, body):
    try:
        comment = Comment.objects.select_related("schedule").get(
            id=comment_id,
            deleted_at__isnull=True,
        )
    except Comment.DoesNotExist as error:
        raise NotFound("Comment not found.") from error

    ensure_schedule_member(profile, comment.schedule_id)

    if comment.author_id != profile.pk:
        raise PermissionDenied("Only the author can edit this comment.")

    comment.body = text_value({"body": body}, "body")
    return clean_and_save(comment)


def delete_comment(profile, comment_id):
    try:
        comment = Comment.objects.select_related("schedule").get(
            id=comment_id,
            deleted_at__isnull=True,
        )
    except Comment.DoesNotExist as error:
        raise NotFound("Comment not found.") from error

    membership = ensure_member(profile, comment.schedule.club_id)
    can_delete = comment.author_id == profile.pk or membership.role == ClubMember.Role.OWNER

    if not can_delete:
        raise PermissionDenied("Only the author or club owner can delete this comment.")

    comment.deleted_at = timezone.now()
    comment.save(update_fields=["deleted_at"])
    return comment


def list_annotations(profile, schedule_id, paper_id):
    schedule = ensure_schedule_member(profile, schedule_id)

    if str(schedule.paper_id) != str(paper_id):
        raise ValidationError("Paper does not belong to this schedule.")

    return (
        PaperAnnotation.objects.select_related("author")
        .prefetch_related("replies", "replies__author")
        .filter(schedule=schedule, paper_id=paper_id, deleted_at__isnull=True)
        .order_by("created_at")
    )


def create_annotation(profile, schedule_id, values):
    data = object_value(values, "annotation")
    schedule = ensure_schedule_member(profile, schedule_id)
    paper_id = text_value(data, "paper_id")

    if str(schedule.paper_id) != paper_id:
        raise ValidationError("Paper does not belong to this schedule.")

    annotation = PaperAnnotation(
        schedule=schedule,
        paper_id=paper_id,
        author=profile,
        kind=text_value(data, "kind"),
        page_number=positive_int_value(data.get("page_number"), "page_number"),
        position=object_value(data.get("position"), "position"),
        quote=nullable_text(data.get("quote")),
        body=nullable_text(data.get("body")),
        color=text_value(data, "color"),
    )
    return clean_and_save(annotation)


def create_annotation_reply(profile, annotation_id, body):
    try:
        annotation = PaperAnnotation.objects.select_related("schedule").get(
            id=annotation_id,
            deleted_at__isnull=True,
        )
    except PaperAnnotation.DoesNotExist as error:
        raise NotFound("Annotation not found.") from error

    ensure_schedule_member(profile, annotation.schedule_id)

    reply = PaperAnnotationReply(
        annotation=annotation,
        author=profile,
        body=text_value({"body": body}, "body"),
    )
    return clean_and_save(reply)


def update_annotation_body(profile, annotation_id, body):
    try:
        annotation = PaperAnnotation.objects.get(id=annotation_id, deleted_at__isnull=True)
    except PaperAnnotation.DoesNotExist as error:
        raise NotFound("Annotation not found.") from error

    ensure_schedule_member(profile, annotation.schedule_id)

    if annotation.author_id != profile.pk:
        raise PermissionDenied("Only the author can edit this annotation.")

    annotation.body = nullable_text(body)
    return clean_and_save(annotation)


def delete_annotation(profile, annotation_id):
    try:
        annotation = PaperAnnotation.objects.get(id=annotation_id, deleted_at__isnull=True)
    except PaperAnnotation.DoesNotExist as error:
        raise NotFound("Annotation not found.") from error

    membership = ensure_member(profile, annotation.schedule.club_id)
    can_delete = annotation.author_id == profile.pk or membership.role == ClubMember.Role.OWNER

    if not can_delete:
        raise PermissionDenied("Only the author or club owner can delete this annotation.")

    annotation.deleted_at = timezone.now()
    annotation.save(update_fields=["deleted_at"])
    return annotation


def parse_date_value(value, field_name):
    if not isinstance(value, str):
        raise ValidationError("{} must be a date string.".format(field_name))

    parsed = parse_date(value)
    if parsed is None:
        raise ValidationError("{} must be a valid date.".format(field_name))

    return parsed


def nullable_datetime(value, field_name):
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValidationError("{} must be a datetime string.".format(field_name))

    parsed = parse_datetime(value)
    if parsed is None:
        raise ValidationError("{} must be a valid datetime.".format(field_name))

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())

    return parsed


def object_value(value, field_name):
    if not isinstance(value, dict):
        raise ValidationError("{} must be an object.".format(field_name))

    return value


def text_value(data, field_name):
    value = data.get(field_name)

    if not isinstance(value, str) or not value.strip():
        raise ValidationError("{} is required.".format(field_name))

    return value.strip()


def nullable_text(value):
    if value is None:
        return None

    if not isinstance(value, str):
        raise ValidationError("Expected text or null.")

    return value.strip() or None


def authors_value(value):
    if not isinstance(value, list):
        raise ValidationError("authors must be an array.")

    authors = []
    for author in value:
        if not isinstance(author, str) or not author.strip():
            raise ValidationError("authors must contain only non-empty strings.")
        authors.append(author.strip())

    return authors


def positive_int_value(value, field_name):
    if not isinstance(value, int) or value < 1:
        raise ValidationError("{} must be a positive integer.".format(field_name))

    return value
