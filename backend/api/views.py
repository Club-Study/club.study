from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.arxiv import lookup_arxiv_metadata
from api.serializers import (
    serialize_annotation,
    serialize_annotation_reply,
    serialize_club,
    serialize_comment,
    serialize_invite,
    serialize_member,
    serialize_personal_paper,
    serialize_paper,
    serialize_profile,
    serialize_profile_scheduled_paper,
    serialize_reading_log,
    serialize_reading_session,
    serialize_schedule,
    serialize_user,
)
from api.services import (
    accept_invite,
    add_personal_arxiv_paper,
    add_personal_manual_paper,
    clean_and_save,
    create_annotation,
    create_annotation_reply,
    create_club,
    create_comment,
    create_invite_link,
    current_profile,
    delete_annotation,
    delete_comment,
    get_club_progress,
    get_visible_club,
    list_annotations,
    list_club_schedule,
    list_comments,
    list_dashboard_schedule,
    list_invites,
    list_members,
    list_profile_overview,
    list_visible_clubs,
    log_personal_paper_reading_session,
    log_schedule_reading_session,
    revoke_invite_link,
    schedule_arxiv_paper,
    schedule_existing_paper,
    schedule_manual_paper,
    set_personal_paper_status,
    set_schedule_paper_status,
    toggle_personal_paper_read_status,
    toggle_read_status,
    update_annotation_body,
    update_comment,
    update_paper_page_count,
)
from profiles.models import Profile


@api_view(["GET"])
@permission_classes([AllowAny])
def health(_request):
    return Response({"status": "ok"})


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(_request):
    return Response({"detail": "CSRF cookie set."})


@api_view(["GET"])
@permission_classes([AllowAny])
def current_user(request):
    if not request.user.is_authenticated:
        return Response({"user": None})

    return Response({"user": serialize_user(request.user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def sign_in(request):
    if not settings.PASSWORDLESS_AUTH_ENABLED:
        raise PermissionDenied("Passwordless auth is disabled.")

    email = string_payload(request.data, "email").lower()
    display_name = string_payload(request.data, "display_name")
    User = get_user_model()
    user, created = User.objects.get_or_create(email=email)

    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])

    profile, profile_created = Profile.objects.get_or_create(
        user=user,
        defaults={
            "display_name": display_name,
            "avatar_id": Profile.AvatarId.BOOKWORM,
            "avatar_color": "#65a30d",
        },
    )

    if profile_created:
        clean_and_save(profile)

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response({"user": serialize_user(user)})


@api_view(["POST"])
def sign_out(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "PATCH"])
def profile_detail(request):
    profile = current_profile(request.user)

    if request.method == "GET":
        return Response(serialize_profile(profile))

    data = request.data
    profile.display_name = string_payload(data, "display_name")
    profile.avatar_id = string_payload(data, "avatar_id")
    profile.avatar_color = string_payload(data, "avatar_color")
    profile.bio = nullable_string_payload(data, "bio")
    clean_and_save(profile)
    return Response(serialize_profile(profile))


@api_view(["GET"])
def profile_overview(request):
    profile = current_profile(request.user)
    (
        memberships,
        reading_logs,
        scheduled_papers,
        personal_papers,
        reading_sessions,
        schedule_statuses,
    ) = list_profile_overview(profile)
    return Response(
        {
            "memberships": [
                {
                    "club_id": str(membership.club_id),
                    "created_at": membership.created_at.isoformat().replace("+00:00", "Z"),
                    "role": membership.role,
                    "clubs": {
                        "id": str(membership.club.id),
                        "name": membership.club.name,
                        "slug": membership.club.slug,
                        "description": membership.club.description,
                    },
                }
                for membership in memberships
            ],
            "readingLogs": [serialize_reading_log(log) for log in reading_logs],
            "scheduledPapers": [
                serialize_profile_scheduled_paper(
                    schedule,
                    status=schedule_statuses.get(str(schedule.id), "planned"),
                )
                for schedule in scheduled_papers
            ],
            "personalPapers": [
                serialize_personal_paper(personal_paper)
                for personal_paper in personal_papers
            ],
            "readingSessions": [
                serialize_reading_session(session)
                for session in reading_sessions
            ],
        }
    )


@api_view(["GET", "POST"])
def clubs(request):
    profile = current_profile(request.user)

    if request.method == "GET":
        return Response([serialize_club(club) for club in list_visible_clubs(profile)])

    club = create_club(
        profile,
        string_payload(request.data, "name"),
        nullable_string_payload(request.data, "description"),
    )
    return Response(serialize_club(club), status=status.HTTP_201_CREATED)


@api_view(["GET"])
def club_detail(request, club_id):
    profile = current_profile(request.user)
    return Response(serialize_club(get_visible_club(profile, club_id)))


@api_view(["GET"])
def club_members(request, club_id):
    profile = current_profile(request.user)
    return Response([serialize_member(member) for member in list_members(profile, club_id)])


@api_view(["GET", "POST"])
def club_invites(request, club_id):
    profile = current_profile(request.user)

    if request.method == "GET":
        return Response([serialize_invite(invite) for invite in list_invites(profile, club_id)])

    invite, token = create_invite_link(profile, club_id)
    return Response(serialize_invite(invite, token=token), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def revoke_invite(request, invite_id):
    profile = current_profile(request.user)
    invite = revoke_invite_link(profile, invite_id)
    return Response(serialize_invite(invite))


@api_view(["POST"])
def accept_invite_view(request):
    profile = current_profile(request.user)
    membership = accept_invite(profile, string_payload(request.data, "token"))
    return Response(serialize_member(membership))


@api_view(["GET"])
def dashboard_schedule(request):
    profile = current_profile(request.user)
    from_week_start = request.query_params.get("from_week_start")

    if from_week_start is None:
        raise ValidationError("from_week_start query parameter is required.")

    return Response(
        [
            serialize_schedule(schedule, include_club=True)
            for schedule in list_dashboard_schedule(profile, from_week_start)
        ]
    )


@api_view(["GET"])
def club_schedule(request, club_id):
    profile = current_profile(request.user)
    return Response(
        [
            serialize_schedule(schedule)
            for schedule in list_club_schedule(profile, club_id)
        ]
    )


@api_view(["GET"])
def schedule_detail(request, schedule_id):
    profile = current_profile(request.user)
    from api.services import ensure_schedule_member

    schedule = ensure_schedule_member(profile, schedule_id)
    return Response(serialize_schedule(schedule, include_club=True))


@api_view(["GET"])
def club_schedule_detail(request, club_id, schedule_id):
    profile = current_profile(request.user)
    from api.services import ensure_schedule_member

    schedule = ensure_schedule_member(profile, schedule_id, club_id=club_id)
    return Response(serialize_schedule(schedule))


@api_view(["GET"])
def club_schedule_progress(request, club_id):
    profile = current_profile(request.user)
    return Response(get_club_progress(profile, club_id))


@api_view(["POST"])
def lookup_arxiv(request):
    return Response(lookup_arxiv_metadata(string_payload(request.data, "input")))


@api_view(["POST"])
def schedule_arxiv(request, club_id):
    profile = current_profile(request.user)
    schedule = schedule_arxiv_paper(
        profile,
        club_id,
        nullable_string_payload(request.data, "week_start"),
        object_payload(request.data, "metadata"),
        nullable_string_payload(request.data, "notes"),
    )
    return Response(serialize_schedule(schedule), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def schedule_manual(request, club_id):
    profile = current_profile(request.user)
    schedule = schedule_manual_paper(
        profile,
        club_id,
        nullable_string_payload(request.data, "week_start"),
        object_payload(request.data, "metadata"),
        nullable_string_payload(request.data, "notes"),
    )
    return Response(serialize_schedule(schedule), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def schedule_existing(request, club_id):
    profile = current_profile(request.user)
    schedule = schedule_existing_paper(
        profile,
        club_id,
        string_payload(request.data, "paper_id"),
        nullable_string_payload(request.data, "week_start"),
        nullable_string_payload(request.data, "notes"),
    )
    return Response(serialize_schedule(schedule), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def personal_arxiv_paper(request):
    profile = current_profile(request.user)
    personal_paper = add_personal_arxiv_paper(
        profile,
        object_payload(request.data, "metadata"),
        nullable_string_payload(request.data, "deadline"),
    )
    return Response(serialize_personal_paper(personal_paper), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def personal_manual_paper(request):
    profile = current_profile(request.user)
    personal_paper = add_personal_manual_paper(
        profile,
        object_payload(request.data, "metadata"),
        nullable_string_payload(request.data, "deadline"),
    )
    return Response(serialize_personal_paper(personal_paper), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def personal_paper_read_status(request, personal_paper_id):
    profile = current_profile(request.user)
    personal_paper = toggle_personal_paper_read_status(
        profile,
        personal_paper_id,
        request.data.get("read"),
    )
    return Response(serialize_personal_paper(personal_paper))


@api_view(["POST"])
def personal_paper_status(request, personal_paper_id):
    profile = current_profile(request.user)
    personal_paper = set_personal_paper_status(
        profile,
        personal_paper_id,
        string_payload(request.data, "status"),
    )
    return Response(serialize_personal_paper(personal_paper))


@api_view(["PATCH"])
def paper_page_count(request, paper_id):
    profile = current_profile(request.user)
    paper = update_paper_page_count(profile, paper_id, request.data.get("page_count"))
    return Response(serialize_paper(paper))


@api_view(["POST"])
def read_status(request, schedule_id):
    profile = current_profile(request.user)
    return Response(toggle_read_status(profile, schedule_id, request.data.get("read")))


@api_view(["POST"])
def schedule_status(request, schedule_id):
    profile = current_profile(request.user)
    return Response(
        set_schedule_paper_status(
            profile,
            schedule_id,
            string_payload(request.data, "status"),
        )
    )


@api_view(["POST"])
def schedule_reading_session(request, schedule_id):
    profile = current_profile(request.user)
    session = log_schedule_reading_session(
        profile,
        schedule_id,
        request.data.get("pages_read"),
    )
    return Response(serialize_reading_session(session), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def personal_paper_reading_session(request, personal_paper_id):
    profile = current_profile(request.user)
    session = log_personal_paper_reading_session(
        profile,
        personal_paper_id,
        request.data.get("pages_read"),
    )
    return Response(serialize_reading_session(session), status=status.HTTP_201_CREATED)


@api_view(["GET", "POST"])
def comments(request, schedule_id):
    profile = current_profile(request.user)

    if request.method == "GET":
        return Response(
            [serialize_comment(comment) for comment in list_comments(profile, schedule_id)]
        )

    comment = create_comment(profile, schedule_id, string_payload(request.data, "body"))
    return Response(serialize_comment(comment), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
def comment_detail(request, comment_id):
    profile = current_profile(request.user)

    if request.method == "PATCH":
        comment = update_comment(profile, comment_id, string_payload(request.data, "body"))
        return Response(serialize_comment(comment))

    comment = delete_comment(profile, comment_id)
    return Response(serialize_comment(comment))


@api_view(["GET", "POST"])
def annotations(request, schedule_id):
    profile = current_profile(request.user)

    if request.method == "GET":
        paper_id = request.query_params.get("paper_id")
        if paper_id is None:
            raise ValidationError("paper_id query parameter is required.")

        return Response(
            [
                serialize_annotation(annotation)
                for annotation in list_annotations(profile, schedule_id, paper_id)
            ]
        )

    values = request.data.copy()
    values["schedule_id"] = str(schedule_id)
    annotation = create_annotation(profile, schedule_id, values)
    return Response(serialize_annotation(annotation), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
def annotation_detail(request, annotation_id):
    profile = current_profile(request.user)

    if request.method == "PATCH":
        annotation = update_annotation_body(
            profile,
            annotation_id,
            nullable_string_payload(request.data, "body"),
        )
        return Response(serialize_annotation(annotation))

    annotation = delete_annotation(profile, annotation_id)
    return Response(serialize_annotation(annotation))


@api_view(["POST"])
def annotation_replies(request, annotation_id):
    profile = current_profile(request.user)
    reply = create_annotation_reply(
        profile,
        annotation_id,
        string_payload(request.data, "body"),
    )
    return Response(serialize_annotation_reply(reply), status=status.HTTP_201_CREATED)


def string_payload(data, key):
    value = data.get(key)

    if not isinstance(value, str) or not value.strip():
        raise ValidationError("{} is required.".format(key))

    return value.strip()


def nullable_string_payload(data, key):
    value = data.get(key)

    if value is None:
        return None

    if not isinstance(value, str):
        raise ValidationError("{} must be a string or null.".format(key))

    return value.strip() or None


def object_payload(data, key):
    value = data.get(key)

    if not isinstance(value, dict):
        raise ValidationError("{} must be an object.".format(key))

    return value
