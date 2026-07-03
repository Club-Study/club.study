from datetime import date, datetime


def iso_datetime(value):
    if value is None:
        return None

    return value.isoformat().replace("+00:00", "Z")


def iso_date(value):
    if value is None:
        return None

    if isinstance(value, date):
        return value.isoformat()

    return value


def serialize_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
    }


def serialize_profile(profile):
    return {
        "id": str(profile.pk),
        "display_name": profile.display_name,
        "avatar_id": profile.avatar_id,
        "avatar_color": profile.avatar_color,
        "bio": profile.bio,
        "created_at": iso_datetime(profile.created_at),
        "updated_at": iso_datetime(profile.updated_at),
    }


def serialize_profile_summary(profile, include_bio=False):
    if profile is None:
        return None

    data = {
        "id": str(profile.pk),
        "display_name": profile.display_name,
        "avatar_id": profile.avatar_id,
        "avatar_color": profile.avatar_color,
    }

    if include_bio:
        data["bio"] = profile.bio

    return data


def serialize_club(club):
    return {
        "id": str(club.id),
        "name": club.name,
        "slug": club.slug,
        "description": club.description,
        "created_by": str(club.created_by_id),
        "created_at": iso_datetime(club.created_at),
        "updated_at": iso_datetime(club.updated_at),
    }


def serialize_club_summary(club, include_description=False):
    data = {
        "id": str(club.id),
        "name": club.name,
        "slug": club.slug,
    }

    if include_description:
        data["description"] = club.description

    return data


def serialize_member(member):
    return {
        "club_id": str(member.club_id),
        "user_id": str(member.user_id),
        "role": member.role,
        "created_at": iso_datetime(member.created_at),
        "profiles": serialize_profile_summary(member.user, include_bio=True),
    }


def serialize_invite(invite, token=None):
    data = {
        "id": str(invite.id),
        "club_id": str(invite.club_id),
        "token_hash": invite.token_hash,
        "status": invite.status,
        "created_by": str(invite.created_by_id),
        "expires_at": iso_datetime(invite.expires_at),
        "created_at": iso_datetime(invite.created_at),
        "accepted_by": str(invite.accepted_by_id) if invite.accepted_by_id else None,
        "accepted_at": iso_datetime(invite.accepted_at),
    }

    if token is not None:
        data["token"] = token

    return data


def serialize_paper(paper):
    if paper is None:
        return None

    return {
        "id": str(paper.id),
        "source_type": paper.source_type,
        "title": paper.title,
        "authors": paper.authors,
        "abstract": paper.abstract,
        "doi": paper.doi,
        "license": paper.license,
        "arxiv_id": paper.arxiv_id,
        "abstract_url": paper.abstract_url,
        "pdf_url": paper.pdf_url,
        "external_url": paper.external_url,
        "published_at": iso_datetime(paper.published_at),
        "source_updated_at": iso_datetime(paper.source_updated_at),
        "created_at": iso_datetime(paper.created_at),
        "updated_at": iso_datetime(paper.updated_at),
    }


def serialize_schedule(schedule, include_club=False):
    data = {
        "id": str(schedule.id),
        "club_id": str(schedule.club_id),
        "paper_id": str(schedule.paper_id),
        "week_start": iso_date(schedule.week_start),
        "notes": schedule.notes,
        "created_by": str(schedule.created_by_id),
        "created_at": iso_datetime(schedule.created_at),
        "papers": serialize_paper(schedule.paper),
        "suggested_by": serialize_profile_summary(schedule.created_by),
    }

    if include_club:
        data["clubs"] = serialize_club_summary(schedule.club)

    return data


def serialize_profile_scheduled_paper(schedule):
    return {
        "id": str(schedule.id),
        "club_id": str(schedule.club_id),
        "paper_id": str(schedule.paper_id),
        "week_start": iso_date(schedule.week_start),
        "clubs": serialize_club_summary(schedule.club),
        "papers": {
            "id": str(schedule.paper.id),
            "arxiv_id": schedule.paper.arxiv_id,
            "authors": schedule.paper.authors,
            "external_url": schedule.paper.external_url,
            "pdf_url": schedule.paper.pdf_url,
            "published_at": iso_datetime(schedule.paper.published_at),
            "source_type": schedule.paper.source_type,
            "title": schedule.paper.title,
        },
    }


def serialize_reading_log(log):
    return {
        "id": str(log.id),
        "read_at": iso_datetime(log.read_at),
        "schedule_id": str(log.schedule_id),
        "club_paper_schedule": serialize_profile_scheduled_paper(log.schedule),
    }


def serialize_comment(comment):
    return {
        "id": str(comment.id),
        "schedule_id": str(comment.schedule_id),
        "author_id": str(comment.author_id),
        "body": comment.body,
        "created_at": iso_datetime(comment.created_at),
        "updated_at": iso_datetime(comment.updated_at),
        "deleted_at": iso_datetime(comment.deleted_at),
        "profiles": serialize_profile_summary(comment.author),
    }


def serialize_annotation_reply(reply):
    return {
        "id": str(reply.id),
        "annotation_id": str(reply.annotation_id),
        "author_id": str(reply.author_id),
        "body": reply.body,
        "created_at": iso_datetime(reply.created_at),
        "updated_at": iso_datetime(reply.updated_at),
        "deleted_at": iso_datetime(reply.deleted_at),
        "profiles": serialize_profile_summary(reply.author),
    }


def serialize_annotation(annotation):
    replies = [
        serialize_annotation_reply(reply)
        for reply in annotation.replies.all()
        if reply.deleted_at is None
    ]

    return {
        "id": str(annotation.id),
        "schedule_id": str(annotation.schedule_id),
        "paper_id": str(annotation.paper_id),
        "author_id": str(annotation.author_id),
        "kind": annotation.kind,
        "page_number": annotation.page_number,
        "position": annotation.position,
        "quote": annotation.quote,
        "body": annotation.body,
        "color": annotation.color,
        "created_at": iso_datetime(annotation.created_at),
        "updated_at": iso_datetime(annotation.updated_at),
        "deleted_at": iso_datetime(annotation.deleted_at),
        "profiles": serialize_profile_summary(annotation.author),
        "paper_annotation_replies": replies,
    }
