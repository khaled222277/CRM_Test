"""Filters for separating hand-logged activities from machine-generated ones.

!! COUPLING WARNING !!
`AUTO_LOG_CONTENT_PREFIX` must stay in step with the message that
`routers/deals.py::change_stage` writes when it auto-logs a stage change. That
hook builds its content as f"{AUTO_LOG_CONTENT_PREFIX}{old} to {new}", and this
module recognises auto-logged rows by matching that prefix back.

There is no foreign key or flag column marking a row as auto-generated -- the
content string *is* the marker. If the wording in that hook ever changes,
previously written rows keep the old wording, and this filter stops matching
them: they would silently reappear in the dashboard feed as if a user had typed
them. Changing the message therefore means either updating this prefix and
backfilling the old rows, or (better) adding a real column to mark them.
"""

from sqlalchemy import and_, not_
from sqlalchemy.sql.elements import ColumnElement

from app.models import Activity, ActivityType

AUTO_LOG_CONTENT_PREFIX = "Deal moved from "


def is_auto_logged() -> ColumnElement[bool]:
    """Matches activities written by the deal stage-change hook."""
    return and_(
        Activity.type == ActivityType.NOTE,
        Activity.content.startswith(AUTO_LOG_CONTENT_PREFIX, autoescape=True),
    )


def exclude_auto_logged() -> ColumnElement[bool]:
    """Matches everything a human actually logged."""
    return not_(is_auto_logged())
