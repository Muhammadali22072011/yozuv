import enum


class BusinessCategory(str, enum.Enum):
    BARBERSHOP = "barbershop"
    SALON = "salon"
    DENTIST = "dentist"
    TUTOR = "tutor"
    PHOTO = "photo"
    MASSAGE = "massage"
    FITNESS = "fitness"
    CLINIC = "clinic"
    OTHER = "other"


class ConfirmationMode(str, enum.Enum):
    AUTO = "AUTO"
    MANUAL = "MANUAL"
    PREPAYMENT = "PREPAYMENT"


class LanguageCode(str, enum.Enum):
    UZ = "UZ"
    RU = "RU"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"
    # Auto-flipped by the nightly task when a confirmed/pending booking
    # passes its end_time without being marked COMPLETED. Owner can
    # still override it back to COMPLETED if it was an oversight.
    NO_SHOW = "NO_SHOW"


class PaymentStatus(str, enum.Enum):
    UNPAID = "UNPAID"
    PAID = "PAID"
    REFUNDED = "REFUNDED"


class SubscriptionPlan(str, enum.Enum):
    TRIAL = "TRIAL"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class PaymentProvider(str, enum.Enum):
    PAYME = "PAYME"
    CLICK = "CLICK"
    CARD = "CARD"


class PaymentRecordStatus(str, enum.Enum):
    PENDING = "PENDING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class AuthProvider(str, enum.Enum):
    """External login method backing an auth_identities row.

    One User (the account) can have several linked identities — at most
    one per provider. Stored as the lowercase .value in a String(16)
    column, matching the MembershipRole pattern (no native DB enum).
    """

    TELEGRAM = "telegram"
    GOOGLE = "google"
    PASSWORD = "password"
    APPLE = "apple"  # reserved; no code path yet


class MembershipRole(str, enum.Enum):
    """Permission level a user has against a business.

    OWNER  — full control, including billing and transfer of ownership.
    MANAGER — read/write everything except billing and ownership.
    STAFF  — read most, write only own bookings/availability (the
             corresponding Staff row, if any, controls visibility).
    """

    OWNER = "OWNER"
    MANAGER = "MANAGER"
    STAFF = "STAFF"
