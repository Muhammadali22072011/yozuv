"""Business-clock helpers.

The product is run from Asia/Tashkent. Render hosts the backend in UTC,
so naive `date.today()` / `datetime.now()` calls drift by 5 hours and
flip the calendar day around 19:00 UTC — which is right when Tashkent
owners are still active. Always use these helpers for any date or
"today/tomorrow" comparison the user will see.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Tashkent")


def local_now() -> datetime:
    """Timezone-aware 'now' in the business timezone."""
    return datetime.now(TZ)


def local_today() -> date:
    """The calendar date the owner is currently looking at."""
    return local_now().date()
