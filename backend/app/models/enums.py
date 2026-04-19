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
