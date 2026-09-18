"""CIBIL-style credit report endpoint: shape, determinism, auth, 404s."""
import re


def _report(c, bid="B90001"):
    r = c.get(f"/api/ls/borrowers/{bid}/cibil")
    assert r.status_code == 200, r.text
    return r.json()


def test_guest_can_fetch_report(guest):
    d = _report(guest)
    assert d["borrower_id"] == "B90001"
    assert d["name"] == "Test Borrower"
    assert 300 <= d["score"] <= 900
    assert d["band"] in {"EXCELLENT", "GOOD", "FAIR", "POOR", "VERY_POOR"}
    assert d["model_version"] == "lendsure-cibil-est-v1.0"
    assert d["is_official_cibil"] is False
    assert "not an official" in d["disclaimer"].lower()
    assert len(d["components"]) == 5
    assert sum(c["max_points"] for c in d["components"]) == 600
    assert sum(c["weight_pct"] for c in d["components"]) == 100
    assert d["factors"] and d["accounts"] is not None
    assert isinstance(d["payment_timeline"], list)
    assert isinstance(d["enquiries"], dict)


def test_deterministic_same_input_same_score(guest):
    assert _report(guest)["score"] == _report(guest)["score"]


def test_lender_gets_unscrubbed_profile(lender):
    d = _report(lender)
    # Lenders see PII the guest view scrubs; the report carries the name.
    assert d["name"] == "Test Borrower"


def test_unknown_borrower_404(guest):
    r = guest.get("/api/ls/borrowers/NOPE123/cibil")
    assert r.status_code == 404


def test_seed_borrower_penalised_for_late_payment(guest):
    # Seed row: 1 late payment + 20 DPD + DTI 0.83 -> cannot be top-band.
    d = _report(guest)
    assert d["band"] in {"FAIR", "POOR", "VERY_POOR", "GOOD"}
    assert d["score"] < 900
    codes = {f["code"] for f in d["factors"]}
    assert {"pay_late", "util_dti", "len_history"} <= codes


def test_borrower_id_format_accepted(guest):
    assert re.match(r"^B\d+$", _report(guest)["borrower_id"])
