import bleach

# Allow zero HTML in user-supplied text that goes into PDF/email
_ALLOWED_TAGS: list[str] = []
_ALLOWED_ATTRS: dict = {}


def sanitize_text(value: str) -> str:
    """Strip all HTML tags from user input before rendering in PDF or email."""
    return bleach.clean(value, tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRS, strip=True)
