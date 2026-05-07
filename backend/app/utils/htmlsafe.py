"""Tiny helper for Telegram HTML mode.

The bot sends almost every message with parse_mode=HTML so that templates
like ``<b>{name}</b>`` render with bold formatting. That makes any
interpolated user-controlled value an HTML injection: an owner's
welcome_text or a client's display name can include ``<a href="...">``
and Telegram will render it as a clickable link, ready-made phishing.

Use ``h()`` (or its alias ``escape``) on every user-controlled string
that goes into a Telegram message. Static template HTML stays as-is.
"""

from __future__ import annotations

import html


def h(value: object) -> str:
    """Escape ``value`` for safe interpolation into Telegram HTML mode."""
    return html.escape("" if value is None else str(value), quote=False)


# Friendlier alias for places where ``h()`` reads as cryptic.
escape = h


__all__ = ["h", "escape"]
