"""Standalone smoke test for the brochure renderer.

Run from the backend/ directory:
    python test_brochure.py

Output:
    test_output/brochure_test.pdf
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.pdf_service import generate_brochure


def main() -> str:
    services = [
        {"name": "Soch olish", "price": 50000, "duration_minutes": 45},
        {"name": "Soqol olish", "price": 30000, "duration_minutes": 20},
        {"name": "Soch + Soqol", "price": 70000, "duration_minutes": 60},
        {"name": "Bolalar soch", "price": 35000, "duration_minutes": 30},
    ]

    pdf_bytes = generate_brochure(
        business_name="Barber Akbar",
        business_slug="barber-akbar",
        business_category="barbershop",
        services=services,
        address="Toshkent, Chilonzor, 5-uy",
        phone="+998 90 123 45 67",
        schedule_text="Du-Ju: 9:00-20:00, Sh: 10:00-18:00",
    )

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "test_output")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "brochure_test.pdf")
    with open(out_path, "wb") as f:
        f.write(pdf_bytes)

    print(f"OK  wrote {out_path}  ({len(pdf_bytes):,} bytes)")
    return out_path


if __name__ == "__main__":
    main()
