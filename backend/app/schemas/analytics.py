from pydantic import BaseModel


class SummaryAnalytics(BaseModel):
    bookings_count: int
    revenue: int
    clients_count: int


class RevenuePoint(BaseModel):
    date: str
    amount: int


class BookingsPoint(BaseModel):
    date: str
    bookings: int


class PopularService(BaseModel):
    service_id: str
    name: str
    bookings: int
