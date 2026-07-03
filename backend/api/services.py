import hashlib
import secrets
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, F, Q, Sum
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
from papers.models import Paper, PersonalPaper
from profiles.models import Profile
from schedule.models import (
    ClubPaperSchedule,
    ReadingLog,
    ReadingSession,
    SchedulePaperStatus,
)


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
        .order_by(F("week_start").desc(nulls_last=True), "-created_at")
    )


def list_dashboard_schedule(profile, from_week_start):
    week_start = parse_date_value(from_week_start, "from_week_start")
    return (
        ClubPaperSchedule.objects.select_related("club", "paper", "created_by")
        .filter(
            Q(week_start__gte=week_start) | Q(week_start__isnull=True),
            club__memberships__user=profile,
        )
        .order_by(F("week_start").asc(nulls_last=True), "-created_at")[:20]
    )


def get_club_progress(profile, club_id):
    ensure_member(profile, club_id)
    schedules = ClubPaperSchedule.objects.filter(club_id=club_id).order_by(
        F("week_start").desc(nulls_last=True),
        "-created_at",
    )
    total_members = ClubMember.objects.filter(club_id=club_id).count()
    read_counts = {
        str(row["schedule_id"]): row["count"]
        for row in SchedulePaperStatus.objects.filter(
            schedule__club_id=club_id,
            status=SchedulePaperStatus.Status.READ,
        )
        .values("schedule_id")
        .annotate(count=Count("id"))
    }
    current_statuses = {
        str(row["schedule_id"]): row["status"]
        for row in SchedulePaperStatus.objects.filter(
            schedule__club_id=club_id,
            user=profile,
        ).values("schedule_id", "status")
    }
    current_sessions = {
        str(row["schedule_id"]): {
            "pages_read": row["pages_read"] or 0,
            "session_count": row["session_count"],
        }
        for row in ReadingSession.objects.filter(
            schedule__club_id=club_id,
            user=profile,
        )
        .values("schedule_id")
        .annotate(
            pages_read=Sum("pages_read"),
            session_count=Count("id"),
        )
    }

    progress = []
    for schedule in schedules:
        status = current_statuses.get(
            str(schedule.id),
            SchedulePaperStatus.Status.PLANNED,
        )
        progress.append(
            {
                "schedule_id": str(schedule.id),
                "total_members": total_members,
                "read_count": read_counts.get(str(schedule.id), 0),
                "current_user_read": status == SchedulePaperStatus.Status.READ,
                "current_user_status": status,
                "current_user_pages_read": current_sessions.get(str(schedule.id), {}).get(
                    "pages_read",
                    0,
                ),
                "current_user_session_count": current_sessions.get(str(schedule.id), {}).get(
                    "session_count",
                    0,
                ),
            }
        )

    return progress


def schedule_arxiv_paper(profile, club_id, week_start, metadata, notes=None):
    ensure_member(profile, club_id)
    paper = upsert_arxiv_paper(metadata)
    return create_schedule(profile, club_id, paper, week_start, notes)


def schedule_manual_paper(profile, club_id, week_start, metadata, notes=None):
    ensure_member(profile, club_id)
    paper = create_manual_paper(metadata)
    return create_schedule(profile, club_id, paper, week_start, notes)


def schedule_existing_paper(profile, club_id, paper_id, week_start, notes=None):
    ensure_member(profile, club_id)
    paper = get_visible_paper(profile, paper_id)
    return create_schedule(profile, club_id, paper, week_start, notes)


def add_personal_arxiv_paper(profile, metadata, deadline=None):
    paper = upsert_arxiv_paper(metadata)
    parsed_deadline = nullable_date_value(deadline, "deadline")
    personal_paper, created = PersonalPaper.objects.get_or_create(
        user=profile,
        paper=paper,
        defaults={"deadline": parsed_deadline},
    )
    if not created and parsed_deadline is not None:
        personal_paper.deadline = parsed_deadline
        personal_paper = clean_and_save(personal_paper)

    return personal_paper


def add_personal_manual_paper(profile, metadata, deadline=None):
    paper = create_manual_paper(metadata)
    personal_paper = PersonalPaper(
        user=profile,
        paper=paper,
        deadline=nullable_date_value(deadline, "deadline"),
    )
    return clean_and_save(personal_paper)


def get_visible_paper(profile, paper_id):
    try:
        paper = Paper.objects.get(id=paper_id)
    except (Paper.DoesNotExist, DjangoValidationError) as error:
        raise NotFound("Paper not found.") from error

    if PersonalPaper.objects.filter(user=profile, paper=paper).exists():
        return paper

    if ClubPaperSchedule.objects.filter(
        paper=paper,
        club__memberships__user=profile,
    ).exists():
        return paper

    raise PermissionDenied("Paper is not in your profile lists.")


def update_paper_page_count(profile, paper_id, page_count):
    paper = get_visible_paper(profile, paper_id)
    paper.page_count = positive_int_value(page_count, "page_count")
    return clean_and_save(paper)


def ensure_personal_paper(profile, personal_paper_id):
    try:
        return PersonalPaper.objects.select_related("paper").get(
            id=personal_paper_id,
            user=profile,
        )
    except PersonalPaper.DoesNotExist as error:
        raise NotFound("Personal paper not found.") from error


def schedule_status(profile, schedule):
    try:
        return SchedulePaperStatus.objects.get(
            schedule=schedule,
            user=profile,
        ).status
    except SchedulePaperStatus.DoesNotExist:
        return SchedulePaperStatus.Status.PLANNED


def unread_schedule_status(profile, schedule):
    if ReadingSession.objects.filter(schedule=schedule, user=profile).exists():
        return SchedulePaperStatus.Status.READING

    return SchedulePaperStatus.Status.PLANNED


def unread_personal_paper_status(profile, personal_paper):
    if ReadingSession.objects.filter(
        personal_paper=personal_paper,
        user=profile,
    ).exists():
        return PersonalPaper.Status.READING

    return PersonalPaper.Status.PLANNED


def schedule_status_value(value):
    valid_statuses = {choice[0] for choice in SchedulePaperStatus.Status.choices}
    if value not in valid_statuses:
        raise ValidationError(
            "Status must be one of: {}.".format(", ".join(sorted(valid_statuses)))
        )

    return value


def personal_paper_status_value(value):
    valid_statuses = {choice[0] for choice in PersonalPaper.Status.choices}
    if value not in valid_statuses:
        raise ValidationError(
            "Status must be one of: {}.".format(", ".join(sorted(valid_statuses)))
        )

    return value


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
        week_start=nullable_date_value(week_start, "week_start"),
        notes=nullable_text(notes),
        created_by=profile,
    )
    return clean_and_save(schedule)


def toggle_read_status(profile, schedule_id, read):
    if read is True:
        return set_schedule_paper_status(
            profile,
            schedule_id,
            SchedulePaperStatus.Status.READ,
        )

    if read is False:
        schedule = ensure_schedule_member(profile, schedule_id)
        status = unread_schedule_status(profile, schedule)
        return set_schedule_paper_status(profile, schedule_id, status)

    raise ValidationError("Read must be true or false.")


def set_schedule_paper_status(profile, schedule_id, status):
    schedule = ensure_schedule_member(profile, schedule_id)
    normalized_status = schedule_status_value(status)
    status_row, _created = SchedulePaperStatus.objects.get_or_create(
        schedule=schedule,
        user=profile,
    )
    status_row.status = normalized_status
    status_row = clean_and_save(status_row)

    reading_log_id = None
    if normalized_status == SchedulePaperStatus.Status.READ:
        log, _created = ReadingLog.objects.get_or_create(schedule=schedule, user=profile)
        reading_log_id = str(log.id)
    else:
        ReadingLog.objects.filter(schedule=schedule, user=profile).delete()

    return {
        "schedule_id": str(schedule.id),
        "status": status_row.status,
        "read": status_row.status == SchedulePaperStatus.Status.READ,
        "reading_log_id": reading_log_id,
    }


def toggle_personal_paper_read_status(profile, personal_paper_id, read):
    if read is True:
        return set_personal_paper_status(
            profile,
            personal_paper_id,
            PersonalPaper.Status.READ,
        )

    if read is False:
        personal_paper = ensure_personal_paper(profile, personal_paper_id)
        status = unread_personal_paper_status(profile, personal_paper)
        return set_personal_paper_status(profile, personal_paper_id, status)

    raise ValidationError("Read must be true or false.")


def set_personal_paper_status(profile, personal_paper_id, status):
    personal_paper = ensure_personal_paper(profile, personal_paper_id)
    personal_paper.status = personal_paper_status_value(status)
    return clean_and_save(personal_paper)


def log_schedule_reading_session(profile, schedule_id, pages_read):
    schedule = ensure_schedule_member(profile, schedule_id)
    session = ReadingSession(
        schedule=schedule,
        user=profile,
        pages_read=positive_int_value(pages_read, "pages_read"),
    )
    session = clean_and_save(session)
    if schedule_status(profile, schedule) != SchedulePaperStatus.Status.READ:
        set_schedule_paper_status(
            profile,
            schedule.id,
            SchedulePaperStatus.Status.READING,
        )

    return session


def log_personal_paper_reading_session(profile, personal_paper_id, pages_read):
    personal_paper = ensure_personal_paper(profile, personal_paper_id)

    session = ReadingSession(
        personal_paper=personal_paper,
        user=profile,
        pages_read=positive_int_value(pages_read, "pages_read"),
    )
    session = clean_and_save(session)
    if personal_paper.status != PersonalPaper.Status.READ:
        set_personal_paper_status(
            profile,
            personal_paper.id,
            PersonalPaper.Status.READING,
        )

    return session


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
        .order_by(F("week_start").desc(nulls_last=True), "-created_at")
    )
    personal_papers = (
        PersonalPaper.objects.select_related("paper")
        .filter(user=profile)
        .order_by("-created_at")
    )
    reading_sessions = (
        ReadingSession.objects.select_related("schedule", "personal_paper")
        .filter(user=profile)
        .order_by("-logged_at")
    )
    schedule_statuses = {
        str(row["schedule_id"]): row["status"]
        for row in SchedulePaperStatus.objects.filter(
            user=profile,
            schedule__club__memberships__user=profile,
        ).values("schedule_id", "status")
    }

    return (
        memberships,
        reading_logs,
        scheduled_papers,
        personal_papers,
        reading_sessions,
        schedule_statuses,
    )


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


def nullable_date_value(value, field_name):
    if value is None:
        return None

    return parse_date_value(value, field_name)


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
