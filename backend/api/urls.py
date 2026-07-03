from django.urls import path

from api import views


urlpatterns = [
    path("health/", views.health, name="health"),
    path("csrf/", views.csrf, name="csrf"),
    path("auth/me/", views.current_user, name="current-user"),
    path("auth/sign-in/", views.sign_in, name="sign-in"),
    path("auth/sign-out/", views.sign_out, name="sign-out"),
    path("profile/", views.profile_detail, name="profile-detail"),
    path("profile/overview/", views.profile_overview, name="profile-overview"),
    path("clubs/", views.clubs, name="clubs"),
    path("clubs/<uuid:club_id>/", views.club_detail, name="club-detail"),
    path("clubs/<uuid:club_id>/members/", views.club_members, name="club-members"),
    path("clubs/<uuid:club_id>/invites/", views.club_invites, name="club-invites"),
    path("invites/<uuid:invite_id>/revoke/", views.revoke_invite, name="revoke-invite"),
    path("invites/accept/", views.accept_invite_view, name="accept-invite"),
    path("dashboard/schedule/", views.dashboard_schedule, name="dashboard-schedule"),
    path("arxiv/lookup/", views.lookup_arxiv, name="lookup-arxiv"),
    path("clubs/<uuid:club_id>/schedule/", views.club_schedule, name="club-schedule"),
    path(
        "clubs/<uuid:club_id>/schedule/progress/",
        views.club_schedule_progress,
        name="club-schedule-progress",
    ),
    path(
        "clubs/<uuid:club_id>/schedule/arxiv/",
        views.schedule_arxiv,
        name="schedule-arxiv",
    ),
    path(
        "clubs/<uuid:club_id>/schedule/manual/",
        views.schedule_manual,
        name="schedule-manual",
    ),
    path(
        "clubs/<uuid:club_id>/schedule/existing/",
        views.schedule_existing,
        name="schedule-existing",
    ),
    path("papers/personal/arxiv/", views.personal_arxiv_paper, name="personal-arxiv-paper"),
    path("papers/personal/manual/", views.personal_manual_paper, name="personal-manual-paper"),
    path("papers/<uuid:paper_id>/page-count/", views.paper_page_count, name="paper-page-count"),
    path(
        "personal-papers/<uuid:personal_paper_id>/read-status/",
        views.personal_paper_read_status,
        name="personal-paper-read-status",
    ),
    path(
        "personal-papers/<uuid:personal_paper_id>/status/",
        views.personal_paper_status,
        name="personal-paper-status",
    ),
    path(
        "personal-papers/<uuid:personal_paper_id>/reading-sessions/",
        views.personal_paper_reading_session,
        name="personal-paper-reading-session",
    ),
    path(
        "clubs/<uuid:club_id>/schedule/<uuid:schedule_id>/",
        views.club_schedule_detail,
        name="club-schedule-detail",
    ),
    path("schedule/<uuid:schedule_id>/", views.schedule_detail, name="schedule-detail"),
    path(
        "schedule/<uuid:schedule_id>/read-status/",
        views.read_status,
        name="read-status",
    ),
    path(
        "schedule/<uuid:schedule_id>/status/",
        views.schedule_status,
        name="schedule-status",
    ),
    path(
        "schedule/<uuid:schedule_id>/reading-sessions/",
        views.schedule_reading_session,
        name="schedule-reading-session",
    ),
    path(
        "schedule/<uuid:schedule_id>/comments/",
        views.comments,
        name="comments",
    ),
    path("comments/<uuid:comment_id>/", views.comment_detail, name="comment-detail"),
    path(
        "schedule/<uuid:schedule_id>/annotations/",
        views.annotations,
        name="annotations",
    ),
    path(
        "annotations/<uuid:annotation_id>/",
        views.annotation_detail,
        name="annotation-detail",
    ),
    path(
        "annotations/<uuid:annotation_id>/replies/",
        views.annotation_replies,
        name="annotation-replies",
    ),
]
