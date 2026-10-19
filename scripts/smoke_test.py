"""End-to-end smoke test.

Phase 1 (sections 1-14): registers a user, logs in, creates a company, creates a
contact linked to it, lists contacts and asserts the nested company data comes back.

Phase 2 (sections 15-29): creates a deal and checks company inheritance, stage
transitions, terminal-stage locking, reopen, filters and the pipeline summary.

Phase 3 (sections 30-43): logs activities, checks immutability and ordering, runs
tasks through complete/cancel and the overdue view, exercises the contact-delete
guard, and confirms stage changes auto-log an activity.

Phase 4 (sections 44-51): checks an empty dashboard for a brand-new account, then
builds a known dataset and asserts every summary section against it, including
that auto-logged notes stay out of the activity feed.

Usage (server must already be running):
    python scripts/smoke_test.py
    python scripts/smoke_test.py --base-url http://127.0.0.1:8000
"""

import argparse
import sys
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx

PASSWORD = "SuperSecret123"


def check(condition: bool, message: str) -> None:
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {message}")
    if not condition:
        raise SystemExit(f"\nSmoke test failed: {message}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    email = f"smoke+{uuid.uuid4().hex[:10]}@example.com"

    with httpx.Client(base_url=args.base_url, timeout=15.0) as client:
        print(f"Base URL: {args.base_url}")

        print("\n1. Health check")
        r = client.get("/health")
        check(r.status_code == 200, f"GET /health -> {r.status_code}")

        print("\n2. Register")
        r = client.post(
            "/auth/register",
            json={"email": email, "password": PASSWORD, "full_name": "Smoke Tester"},
        )
        check(r.status_code == 201, f"POST /auth/register -> {r.status_code} (expected 201)")
        user = r.json()
        check(user["email"] == email, f"returned email is {user['email']}")
        check("hashed_password" not in user, "password hash is not exposed in the response")

        print("\n3. Duplicate registration is rejected")
        r = client.post(
            "/auth/register",
            json={"email": email, "password": PASSWORD, "full_name": "Smoke Tester"},
        )
        check(r.status_code == 400, f"duplicate email -> {r.status_code} (expected 400)")

        print("\n4. Login")
        r = client.post(
            "/auth/login",
            data={"username": email, "password": PASSWORD},
        )
        check(r.status_code == 200, f"POST /auth/login -> {r.status_code}")
        token = r.json()["access_token"]
        check(bool(token), "access token returned")
        auth_headers = {"Authorization": f"Bearer {token}"}

        print("\n5. Unauthenticated access is blocked")
        r = client.get("/companies")
        check(r.status_code == 401, f"GET /companies without token -> {r.status_code}")
        r = client.get("/companies", headers={"Authorization": "Bearer not-a-real-token"})
        check(r.status_code == 401, f"GET /companies with bad token -> {r.status_code}")

        print("\n6. Create company")
        r = client.post(
            "/companies",
            headers=auth_headers,
            json={
                "name": "Acme Studios",
                "industry": "Design",
                "website": "https://acme.example",
            },
        )
        check(r.status_code == 201, f"POST /companies -> {r.status_code} (expected 201)")
        company = r.json()
        company_id = company["id"]
        check(company["name"] == "Acme Studios", "company name round-trips")

        print("\n7. Create contact linked to the company")
        r = client.post(
            "/contacts",
            headers=auth_headers,
            json={
                "name": "Jane Rivera",
                "email": "jane@acme.example",
                "phone": "+1-555-0100",
                "company_id": company_id,
                "notes": "Met at the design conference.",
            },
        )
        check(r.status_code == 201, f"POST /contacts -> {r.status_code} (expected 201)")
        contact = r.json()
        contact_id = contact["id"]
        check(
            contact.get("company") is not None
            and contact["company"]["name"] == "Acme Studios",
            f"created contact carries nested company: {contact.get('company')}",
        )

        print("\n8. Create an unlinked contact")
        r = client.post(
            "/contacts",
            headers=auth_headers,
            json={"name": "Sam Unattached"},
        )
        check(r.status_code == 201, f"POST /contacts (no company) -> {r.status_code}")
        check(r.json()["company"] is None, "unlinked contact has company = null")

        print("\n9. List contacts and confirm nested company data")
        r = client.get("/contacts", headers=auth_headers)
        check(r.status_code == 200, f"GET /contacts -> {r.status_code}")
        contacts = r.json()
        check(len(contacts) == 2, f"got {len(contacts)} contacts (expected 2)")
        linked = next(c for c in contacts if c["id"] == contact_id)
        check(linked["company"] is not None, "listed contact includes nested company object")
        check(
            linked["company"]["name"] == "Acme Studios",
            f"nested company name = {linked['company']['name']}",
        )
        check(linked["company"]["id"] == company_id, "nested company id matches")

        print("\n10. Search and filter")
        r = client.get("/contacts", headers=auth_headers, params={"search": "rivera"})
        check(r.status_code == 200 and len(r.json()) == 1, "?search=rivera matches 1 contact")
        r = client.get("/contacts", headers=auth_headers, params={"search": "jane@acme"})
        check(r.status_code == 200 and len(r.json()) == 1, "?search on email matches 1 contact")
        r = client.get("/contacts", headers=auth_headers, params={"company_id": company_id})
        check(r.status_code == 200 and len(r.json()) == 1, "?company_id filter matches 1 contact")
        r = client.get("/companies", headers=auth_headers, params={"search": "acme"})
        check(r.status_code == 200 and len(r.json()) == 1, "?search=acme matches 1 company")

        print("\n11. Update")
        r = client.put(
            f"/contacts/{contact_id}",
            headers=auth_headers,
            json={"phone": "+1-555-0199"},
        )
        check(r.status_code == 200, f"PUT /contacts/{contact_id} -> {r.status_code}")
        check(r.json()["phone"] == "+1-555-0199", "phone updated")
        check(r.json()["name"] == "Jane Rivera", "omitted fields left untouched")

        print("\n12. Another user cannot see or touch this data")
        other_email = f"other+{uuid.uuid4().hex[:10]}@example.com"
        client.post(
            "/auth/register",
            json={"email": other_email, "password": PASSWORD, "full_name": "Other User"},
        )
        r = client.post("/auth/login", data={"username": other_email, "password": PASSWORD})
        other_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        r = client.get("/contacts", headers=other_headers)
        check(r.status_code == 200 and r.json() == [], "other user's contact list is empty")
        r = client.get(f"/contacts/{contact_id}", headers=other_headers)
        check(r.status_code == 404, f"other user GET contact -> {r.status_code} (expected 404)")
        r = client.get(f"/companies/{company_id}", headers=other_headers)
        check(r.status_code == 404, f"other user GET company -> {r.status_code} (expected 404)")
        r = client.delete(f"/contacts/{contact_id}", headers=other_headers)
        check(r.status_code == 404, f"other user DELETE contact -> {r.status_code} (expected 404)")
        r = client.post(
            "/contacts",
            headers=other_headers,
            json={"name": "Sneaky", "company_id": company_id},
        )
        check(
            r.status_code == 404,
            f"other user cannot link a contact to someone else's company -> {r.status_code}",
        )

        print("\n13. Not found and validation")
        r = client.get("/contacts/999999", headers=auth_headers)
        check(r.status_code == 404, f"GET /contacts/999999 -> {r.status_code}")
        r = client.post("/companies", headers=auth_headers, json={})
        check(r.status_code == 422, f"POST /companies with no name -> {r.status_code}")

        print("\n14. Delete")
        r = client.delete(f"/contacts/{contact_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /contacts/{contact_id} -> {r.status_code}")
        r = client.get(f"/contacts/{contact_id}", headers=auth_headers)
        check(r.status_code == 404, "deleted contact is gone")
        r = client.delete(f"/companies/{company_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /companies/{company_id} -> {r.status_code}")

        # ------------------------------------------------------------------ #
        # Phase 2 -- Deals / Pipeline
        # ------------------------------------------------------------------ #
        print("\n" + "-" * 46)
        print("PHASE 2: DEALS / PIPELINE")
        print("-" * 46)

        print("\n15. Fixtures for the deal tests")
        r = client.post(
            "/companies",
            headers=auth_headers,
            json={"name": "Globex Ltd", "industry": "Manufacturing"},
        )
        check(r.status_code == 201, f"POST /companies -> {r.status_code}")
        globex_id = r.json()["id"]

        r = client.post(
            "/contacts",
            headers=auth_headers,
            json={"name": "Hank Scorpio", "email": "hank@globex.example", "company_id": globex_id},
        )
        check(r.status_code == 201, f"POST /contacts -> {r.status_code}")
        hank_id = r.json()["id"]

        print("\n16. Create a deal -- company_id auto-inherits from the contact")
        r = client.post(
            "/deals",
            headers=auth_headers,
            json={
                "title": "Globex retainer",
                "value": "5000.00",
                "probability": 40,
                "expected_close_date": "2026-10-01",
                "contact_id": hank_id,
            },
        )
        check(r.status_code == 201, f"POST /deals -> {r.status_code} (expected 201)")
        deal = r.json()
        deal_id = deal["id"]
        check(
            deal["company_id"] == globex_id,
            f"company_id inherited from contact: {deal['company_id']} == {globex_id}",
        )
        check(deal["stage"] == "lead", f"stage defaults to lead (got {deal['stage']})")
        check(Decimal(deal["value"]) == Decimal("5000.00"), f"value round-trips: {deal['value']}")
        check(deal["won_at"] is None and deal["lost_at"] is None, "won_at/lost_at start null")
        check(
            deal["contact"] is not None and deal["contact"]["name"] == "Hank Scorpio",
            f"nested contact present: {deal['contact']}",
        )
        check(
            deal["company"] is not None and deal["company"]["name"] == "Globex Ltd",
            f"nested company present: {deal['company']}",
        )

        print("\n17. Validation")
        bad_payloads = [
            ({"title": "x", "contact_id": hank_id, "probability": 101}, "probability > 100"),
            ({"title": "x", "contact_id": hank_id, "probability": -1}, "probability < 0"),
            ({"title": "x", "contact_id": hank_id, "value": "-1.00"}, "value < 0"),
            ({"title": "x", "contact_id": hank_id, "stage": "banana"}, "invalid stage"),
            ({"contact_id": hank_id}, "missing title"),
        ]
        for payload, label in bad_payloads:
            r = client.post("/deals", headers=auth_headers, json=payload)
            check(r.status_code == 422, f"{label} -> {r.status_code} (expected 422)")

        r = client.post(
            "/deals", headers=auth_headers, json={"title": "x", "contact_id": 999999}
        )
        check(r.status_code == 404, f"unknown contact_id -> {r.status_code} (expected 404)")

        print("\n18. Move through non-terminal stages")
        for stage in ("contacted", "proposal_sent", "negotiation"):
            r = client.patch(
                f"/deals/{deal_id}/stage", headers=auth_headers, json={"stage": stage}
            )
            check(r.status_code == 200, f"PATCH stage -> {stage} returned {r.status_code}")
            check(r.json()["stage"] == stage, f"stage is now {r.json()['stage']}")
        check(r.json()["won_at"] is None, "won_at still null on a non-terminal stage")

        print("\n19. Close as won")
        r = client.patch(f"/deals/{deal_id}/stage", headers=auth_headers, json={"stage": "won"})
        check(r.status_code == 200, f"PATCH stage -> won returned {r.status_code}")
        won = r.json()
        check(won["stage"] == "won", "stage is won")
        check(won["won_at"] is not None, f"won_at is set: {won['won_at']}")
        check(won["lost_at"] is None, "lost_at remains null")

        print("\n20. A closed deal rejects further stage changes")
        r = client.patch(
            f"/deals/{deal_id}/stage", headers=auth_headers, json={"stage": "negotiation"}
        )
        check(r.status_code == 400, f"PATCH stage on won deal -> {r.status_code} (expected 400)")
        detail = r.json()["detail"]
        check(
            "already closed as won" in detail and f"/deals/{deal_id}/reopen" in detail,
            f"error message points at reopen: {detail!r}",
        )
        r = client.patch(f"/deals/{deal_id}/stage", headers=auth_headers, json={"stage": "lost"})
        check(r.status_code == 400, "won deal cannot be flipped to lost either")

        print("\n21. PUT still works on a closed deal, and cannot change stage")
        r = client.put(
            f"/deals/{deal_id}",
            headers=auth_headers,
            json={"title": "Globex retainer (annual)", "value": "7500.00"},
        )
        check(r.status_code == 200, f"PUT /deals/{deal_id} -> {r.status_code}")
        check(r.json()["title"] == "Globex retainer (annual)", "title updated on a closed deal")
        check(Decimal(r.json()["value"]) == Decimal("7500.00"), "value updated")
        check(r.json()["stage"] == "won", "stage untouched by PUT")
        check(r.json()["probability"] == 40, "omitted fields left untouched")

        r = client.put(f"/deals/{deal_id}", headers=auth_headers, json={"stage": "lead"})
        check(r.status_code == 422, f"PUT with stage in body -> {r.status_code} (expected 422)")

        print("\n22. Reopen")
        r = client.post(f"/deals/{deal_id}/reopen", headers=auth_headers)
        check(r.status_code == 200, f"POST /deals/{deal_id}/reopen -> {r.status_code}")
        reopened = r.json()
        check(
            reopened["stage"] == "negotiation",
            f"stage reset to negotiation (got {reopened['stage']})",
        )
        check(reopened["won_at"] is None, "won_at cleared")
        check(reopened["lost_at"] is None, "lost_at cleared")

        r = client.post(f"/deals/{deal_id}/reopen", headers=auth_headers)
        check(r.status_code == 400, f"reopen on an open deal -> {r.status_code} (expected 400)")

        print("\n23. Lost deals behave the same way")
        r = client.post(
            "/deals",
            headers=auth_headers,
            json={"title": "Globex pilot", "value": "1200.50", "contact_id": hank_id},
        )
        check(r.status_code == 201, f"POST /deals -> {r.status_code}")
        lost_deal_id = r.json()["id"]
        r = client.patch(
            f"/deals/{lost_deal_id}/stage", headers=auth_headers, json={"stage": "lost"}
        )
        check(r.status_code == 200 and r.json()["stage"] == "lost", "deal marked lost")
        check(r.json()["lost_at"] is not None, f"lost_at is set: {r.json()['lost_at']}")
        check(r.json()["won_at"] is None, "won_at remains null")
        r = client.patch(
            f"/deals/{lost_deal_id}/stage", headers=auth_headers, json={"stage": "won"}
        )
        check(r.status_code == 400, "lost deal rejects further stage changes")

        print("\n24. Explicit null company_id opts out of inheritance")
        r = client.post(
            "/deals",
            headers=auth_headers,
            json={"title": "Unattached deal", "contact_id": hank_id, "company_id": None},
        )
        check(r.status_code == 201, f"POST /deals -> {r.status_code}")
        check(r.json()["company_id"] is None, "explicit null is respected, not overwritten")
        check(r.json()["company"] is None, "nested company is null")
        unattached_deal_id = r.json()["id"]

        print("\n25. List filters")
        r = client.get("/deals", headers=auth_headers)
        check(r.status_code == 200 and len(r.json()) == 3, f"GET /deals -> {len(r.json())} deals")
        r = client.get("/deals", headers=auth_headers, params={"stage": "lost"})
        check(len(r.json()) == 1, f"?stage=lost -> {len(r.json())}")
        r = client.get("/deals", headers=auth_headers, params={"stage": "negotiation"})
        check(len(r.json()) == 1, f"?stage=negotiation -> {len(r.json())}")
        r = client.get("/deals", headers=auth_headers, params={"contact_id": hank_id})
        check(len(r.json()) == 3, f"?contact_id -> {len(r.json())}")
        r = client.get("/deals", headers=auth_headers, params={"company_id": globex_id})
        check(len(r.json()) == 2, f"?company_id -> {len(r.json())} (the unattached one excluded)")
        r = client.get("/deals", headers=auth_headers, params={"stage": "banana"})
        check(r.status_code == 422, f"?stage=banana -> {r.status_code} (expected 422)")

        print("\n26. Pipeline summary")
        r = client.get("/deals/pipeline-summary", headers=auth_headers)
        check(r.status_code == 200, f"GET /deals/pipeline-summary -> {r.status_code}")
        summary = r.json()
        check(len(summary) == 6, f"all 6 stages reported (got {len(summary)})")
        check(
            [s["stage"] for s in summary]
            == ["lead", "contacted", "proposal_sent", "negotiation", "won", "lost"],
            "stages come back in pipeline order",
        )
        by_stage = {s["stage"]: s for s in summary}
        check(
            by_stage["negotiation"]["count"] == 1
            and Decimal(by_stage["negotiation"]["total_value"]) == Decimal("7500.00"),
            f"negotiation: {by_stage['negotiation']}",
        )
        check(
            by_stage["lost"]["count"] == 1
            and Decimal(by_stage["lost"]["total_value"]) == Decimal("1200.50"),
            f"lost: {by_stage['lost']}",
        )
        check(
            by_stage["lead"]["count"] == 1
            and Decimal(by_stage["lead"]["total_value"]) == Decimal("0.00"),
            f"lead (the zero-value unattached deal): {by_stage['lead']}",
        )
        check(
            by_stage["won"]["count"] == 0
            and Decimal(by_stage["won"]["total_value"]) == Decimal("0"),
            f"empty stages are zero-filled: {by_stage['won']}",
        )
        check(
            sum(s["count"] for s in summary) == 3,
            "summary counts add up to the number of deals",
        )

        print("\n27. Deals are owner-scoped")
        r = client.get("/deals", headers=other_headers)
        check(r.status_code == 200 and r.json() == [], "other user's deal list is empty")
        r = client.get(f"/deals/{deal_id}", headers=other_headers)
        check(r.status_code == 404, f"other user GET deal -> {r.status_code} (expected 404)")
        r = client.patch(
            f"/deals/{deal_id}/stage", headers=other_headers, json={"stage": "won"}
        )
        check(r.status_code == 404, f"other user PATCH stage -> {r.status_code} (expected 404)")
        r = client.post(f"/deals/{deal_id}/reopen", headers=other_headers)
        check(r.status_code == 404, f"other user reopen -> {r.status_code} (expected 404)")
        r = client.delete(f"/deals/{deal_id}", headers=other_headers)
        check(r.status_code == 404, f"other user DELETE deal -> {r.status_code} (expected 404)")
        r = client.post(
            "/deals", headers=other_headers, json={"title": "Sneaky", "contact_id": hank_id}
        )
        check(r.status_code == 404, "other user cannot open a deal on someone else's contact")
        r = client.get("/deals/pipeline-summary", headers=other_headers)
        check(
            all(s["count"] == 0 for s in r.json()),
            "other user's pipeline summary is all zeroes",
        )
        r = client.get("/deals", headers={"Authorization": "Bearer nope"})
        check(r.status_code == 401, f"GET /deals with a bad token -> {r.status_code}")

        print("\n28. Delete a deal")
        r = client.delete(f"/deals/{unattached_deal_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /deals/{unattached_deal_id} -> {r.status_code}")
        r = client.get(f"/deals/{unattached_deal_id}", headers=auth_headers)
        check(r.status_code == 404, "deleted deal is gone")
        r = client.get("/deals", headers=auth_headers)
        check(len(r.json()) == 2, f"{len(r.json())} deals remain")

        print("\n29. Deleting a contact takes its deals with it")
        # Phase 3 note: the stage changes above auto-logged activities against
        # this contact, and Phase 3's delete guard refuses while those exist.
        # Clear them first, which also proves the guard fires here.
        r = client.delete(f"/contacts/{hank_id}", headers=auth_headers)
        check(
            r.status_code == 400,
            f"delete blocked by auto-logged activities -> {r.status_code} (expected 400)",
        )
        r = client.get("/activities", headers=auth_headers, params={"contact_id": hank_id})
        auto_logged = r.json()
        check(len(auto_logged) == 5, f"5 stage changes were auto-logged (got {len(auto_logged)})")
        for activity in auto_logged:
            client.delete(f"/activities/{activity['id']}", headers=auth_headers)

        r = client.delete(f"/contacts/{hank_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /contacts/{hank_id} -> {r.status_code}")
        r = client.get("/deals", headers=auth_headers)
        check(
            r.status_code == 200 and r.json() == [],
            f"deals cascaded away with the contact (got {len(r.json())})",
        )
        r = client.delete(f"/companies/{globex_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /companies/{globex_id} -> {r.status_code}")

        # ------------------------------------------------------------------ #
        # Phase 3 -- Activities & Tasks
        # ------------------------------------------------------------------ #
        print("\n" + "-" * 46)
        print("PHASE 3: ACTIVITIES & TASKS")
        print("-" * 46)

        now = datetime.now(timezone.utc)

        def iso(offset: timedelta) -> str:
            return (now + offset).isoformat()

        print("\n30. Fixtures for the activity and task tests")
        r = client.post("/companies", headers=auth_headers, json={"name": "Initech"})
        check(r.status_code == 201, f"POST /companies -> {r.status_code}")
        initech_id = r.json()["id"]

        r = client.post(
            "/contacts",
            headers=auth_headers,
            json={"name": "Alice Kim", "company_id": initech_id},
        )
        check(r.status_code == 201, f"POST /contacts (Alice) -> {r.status_code}")
        alice_id = r.json()["id"]

        r = client.post("/contacts", headers=auth_headers, json={"name": "Bob Vance"})
        check(r.status_code == 201, f"POST /contacts (Bob) -> {r.status_code}")
        bob_id = r.json()["id"]

        r = client.post(
            "/deals",
            headers=auth_headers,
            json={"title": "Initech rollout", "value": "9000.00", "contact_id": alice_id},
        )
        check(r.status_code == 201, f"POST /deals (Alice) -> {r.status_code}")
        alice_deal_id = r.json()["id"]

        r = client.post(
            "/deals", headers=auth_headers, json={"title": "Bob's deal", "contact_id": bob_id}
        )
        check(r.status_code == 201, f"POST /deals (Bob) -> {r.status_code}")
        bob_deal_id = r.json()["id"]

        print("\n31. Create an activity linked to a contact and a deal")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={
                "type": "meeting",
                "content": "Kickoff call, walked through scope",
                "occurred_at": iso(timedelta(hours=-2)),
                "contact_id": alice_id,
                "deal_id": alice_deal_id,
            },
        )
        check(r.status_code == 201, f"POST /activities -> {r.status_code} (expected 201)")
        act_meeting = r.json()
        act_meeting_id = act_meeting["id"]
        check(act_meeting["type"] == "meeting", "type round-trips")
        check(act_meeting["deal_id"] == alice_deal_id, "deal_id round-trips")
        check(
            act_meeting["contact"] is not None and act_meeting["contact"]["name"] == "Alice Kim",
            f"nested contact present: {act_meeting['contact']}",
        )

        r = client.post(
            "/activities",
            headers=auth_headers,
            json={"type": "note", "content": "occurred_at defaults to now", "contact_id": bob_id},
        )
        check(r.status_code == 201, "activity without occurred_at is accepted")
        check(r.json()["occurred_at"] is not None, "occurred_at defaulted server-side")
        bob_note_id = r.json()["id"]

        print("\n32. An activity's deal must belong to the same contact")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={
                "type": "call",
                "content": "Wrong deal",
                "contact_id": alice_id,
                "deal_id": bob_deal_id,
            },
        )
        check(r.status_code == 400, f"mismatched deal -> {r.status_code} (expected 400)")
        check(
            f"belongs to contact {bob_id}" in r.json()["detail"],
            f"error names the real owner: {r.json()['detail']!r}",
        )

        print("\n33. Activity validation")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={"type": "carrier_pigeon", "content": "x", "contact_id": alice_id},
        )
        check(r.status_code == 422, f"invalid type -> {r.status_code} (expected 422)")
        r = client.post(
            "/activities", headers=auth_headers, json={"type": "call", "contact_id": alice_id}
        )
        check(r.status_code == 422, f"missing content -> {r.status_code} (expected 422)")
        r = client.post(
            "/activities", headers=auth_headers, json={"type": "call", "content": "x"}
        )
        check(r.status_code == 422, f"missing contact_id -> {r.status_code} (expected 422)")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={"type": "call", "content": "x", "contact_id": 999999},
        )
        check(r.status_code == 404, f"unknown contact_id -> {r.status_code} (expected 404)")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={"type": "call", "content": "x", "contact_id": alice_id, "deal_id": 999999},
        )
        check(r.status_code == 404, f"unknown deal_id -> {r.status_code} (expected 404)")

        print("\n34. Listing is newest-first, with filters")
        r = client.post(
            "/activities",
            headers=auth_headers,
            json={
                "type": "call",
                "content": "Oldest -- three hours ago",
                "occurred_at": iso(timedelta(hours=-3)),
                "contact_id": alice_id,
            },
        )
        check(r.status_code == 201, "backdated activity accepted")
        act_call_id = r.json()["id"]

        r = client.post(
            "/activities",
            headers=auth_headers,
            json={
                "type": "email",
                "content": "Newest -- one hour ago",
                "occurred_at": iso(timedelta(hours=-1)),
                "contact_id": alice_id,
            },
        )
        check(r.status_code == 201, "second backdated activity accepted")
        act_email_id = r.json()["id"]

        r = client.get("/activities", headers=auth_headers, params={"contact_id": alice_id})
        check(r.status_code == 200, f"GET /activities?contact_id -> {r.status_code}")
        listed = r.json()
        check(len(listed) == 3, f"3 activities for Alice (got {len(listed)})")
        check(
            [a["id"] for a in listed] == [act_email_id, act_meeting_id, act_call_id],
            "ordered by occurred_at descending, not by insertion order",
        )
        check(
            all(a["contact"]["name"] == "Alice Kim" for a in listed),
            "every listed activity carries nested contact data",
        )
        r = client.get("/activities", headers=auth_headers, params={"deal_id": alice_deal_id})
        check(len(r.json()) == 1, f"?deal_id -> {len(r.json())} (expected 1)")
        r = client.get(
            "/activities", headers=auth_headers, params={"contact_id": alice_id, "type": "call"}
        )
        check(len(r.json()) == 1, f"?type=call -> {len(r.json())} (expected 1)")
        r = client.get("/activities", headers=auth_headers, params={"type": "carrier_pigeon"})
        check(r.status_code == 422, f"?type=carrier_pigeon -> {r.status_code} (expected 422)")

        print("\n35. Activities are immutable -- no PUT or PATCH")
        r = client.put(
            f"/activities/{act_meeting_id}", headers=auth_headers, json={"content": "edited"}
        )
        check(r.status_code == 405, f"PUT /activities/{{id}} -> {r.status_code} (expected 405)")
        r = client.patch(
            f"/activities/{act_meeting_id}", headers=auth_headers, json={"content": "edited"}
        )
        check(r.status_code == 405, f"PATCH /activities/{{id}} -> {r.status_code} (expected 405)")

        print("\n36. Delete an activity")
        r = client.delete(f"/activities/{act_call_id}", headers=auth_headers)
        check(r.status_code == 204, f"DELETE /activities/{act_call_id} -> {r.status_code}")
        r = client.get(f"/activities/{act_call_id}", headers=auth_headers)
        check(r.status_code == 404, "deleted activity is gone")
        r = client.get("/activities", headers=auth_headers, params={"contact_id": alice_id})
        check(len(r.json()) == 2, f"{len(r.json())} activities remain for Alice")

        print("\n37. Create and list tasks")
        r = client.post(
            "/tasks",
            headers=auth_headers,
            json={
                "title": "Send revised proposal",
                "description": "Include the phase 2 numbers",
                "due_date": iso(timedelta(days=3)),
                "contact_id": alice_id,
                "deal_id": alice_deal_id,
            },
        )
        check(r.status_code == 201, f"POST /tasks -> {r.status_code} (expected 201)")
        task = r.json()
        task_id = task["id"]
        check(task["status"] == "pending", f"status defaults to pending (got {task['status']})")
        check(task["completed_at"] is None, "completed_at starts null")
        check(
            task["contact"] is not None and task["contact"]["name"] == "Alice Kim",
            f"nested contact present: {task['contact']}",
        )

        r = client.post("/tasks", headers=auth_headers, json={"title": "Unlinked task"})
        check(r.status_code == 201, "task with no contact or deal is accepted")
        check(r.json()["contact"] is None, "nested contact is null when unlinked")
        unlinked_task_id = r.json()["id"]

        r = client.post(
            "/tasks",
            headers=auth_headers,
            json={"title": "Mismatched", "contact_id": alice_id, "deal_id": bob_deal_id},
        )
        check(r.status_code == 400, f"contact/deal mismatch -> {r.status_code} (expected 400)")
        r = client.post(
            "/tasks", headers=auth_headers, json={"title": "x", "contact_id": 999999}
        )
        check(r.status_code == 404, f"unknown contact_id -> {r.status_code} (expected 404)")
        r = client.post("/tasks", headers=auth_headers, json={})
        check(r.status_code == 422, f"missing title -> {r.status_code} (expected 422)")

        r = client.get("/tasks", headers=auth_headers, params={"contact_id": alice_id})
        check(len(r.json()) == 1, f"?contact_id -> {len(r.json())} (expected 1)")
        r = client.get("/tasks", headers=auth_headers, params={"deal_id": alice_deal_id})
        check(len(r.json()) == 1, f"?deal_id -> {len(r.json())} (expected 1)")
        r = client.get("/tasks", headers=auth_headers, params={"status": "pending"})
        check(len(r.json()) == 2, f"?status=pending -> {len(r.json())} (expected 2)")
        r = client.get("/tasks", headers=auth_headers, params={"status": "banana"})
        check(r.status_code == 422, f"?status=banana -> {r.status_code} (expected 422)")

        print("\n38. PUT edits details but never the status")
        r = client.put(
            f"/tasks/{task_id}",
            headers=auth_headers,
            json={"title": "Send revised proposal (v2)"},
        )
        check(r.status_code == 200, f"PUT /tasks/{task_id} -> {r.status_code}")
        check(r.json()["title"] == "Send revised proposal (v2)", "title updated")
        check(r.json()["status"] == "pending", "status untouched")
        check(r.json()["description"] == "Include the phase 2 numbers", "omitted field kept")
        r = client.put(f"/tasks/{task_id}", headers=auth_headers, json={"status": "completed"})
        check(r.status_code == 422, f"PUT with status in body -> {r.status_code} (expected 422)")
        r = client.put(f"/tasks/{task_id}", headers=auth_headers, json={"deal_id": bob_deal_id})
        check(r.status_code == 400, f"PUT to a mismatched deal -> {r.status_code} (expected 400)")

        print("\n39. Complete and cancel")
        r = client.patch(f"/tasks/{task_id}/complete", headers=auth_headers)
        check(r.status_code == 200, f"PATCH /tasks/{task_id}/complete -> {r.status_code}")
        check(r.json()["status"] == "completed", "status is completed")
        check(r.json()["completed_at"] is not None, f"completed_at set: {r.json()['completed_at']}")
        r = client.patch(f"/tasks/{task_id}/complete", headers=auth_headers)
        check(r.status_code == 400, f"completing twice -> {r.status_code} (expected 400)")
        check(
            "already completed" in r.json()["detail"], f"message: {r.json()['detail']!r}"
        )
        r = client.patch(f"/tasks/{task_id}/cancel", headers=auth_headers)
        check(r.status_code == 400, f"cancelling a completed task -> {r.status_code}")

        r = client.patch(f"/tasks/{unlinked_task_id}/cancel", headers=auth_headers)
        check(r.status_code == 200 and r.json()["status"] == "cancelled", "task cancelled")
        check(r.json()["completed_at"] is None, "cancelling does not set completed_at")
        r = client.patch(f"/tasks/{unlinked_task_id}/cancel", headers=auth_headers)
        check(r.status_code == 400, f"cancelling twice -> {r.status_code} (expected 400)")

        print("\n40. Overdue tasks")
        r = client.post(
            "/tasks",
            headers=auth_headers,
            json={
                "title": "Overdue follow-up",
                "due_date": iso(timedelta(days=-2)),
                "contact_id": bob_id,
            },
        )
        check(r.status_code == 201, "past-due task created")
        overdue_task_id = r.json()["id"]

        r = client.post(
            "/tasks",
            headers=auth_headers,
            json={"title": "Future task", "due_date": iso(timedelta(days=5))},
        )
        check(r.status_code == 201, "future task created")

        r = client.post("/tasks", headers=auth_headers, json={"title": "No due date"})
        check(r.status_code == 201, "task with no due date created")

        r = client.get("/tasks/overdue", headers=auth_headers)
        check(r.status_code == 200, f"GET /tasks/overdue -> {r.status_code} (not caught by /{{id}})")
        overdue = r.json()
        check(
            [t["id"] for t in overdue] == [overdue_task_id],
            f"only the past-due pending task is listed (got {[t['title'] for t in overdue]})",
        )
        check(
            overdue[0]["contact"] is not None and overdue[0]["contact"]["name"] == "Bob Vance",
            "overdue entries carry nested contact data",
        )
        r = client.get("/tasks", headers=auth_headers, params={"due_before": iso(timedelta())})
        check(
            [t["id"] for t in r.json()] == [overdue_task_id],
            "?due_before=now matches the same task",
        )

        r = client.patch(f"/tasks/{overdue_task_id}/complete", headers=auth_headers)
        check(r.status_code == 200, "completed the overdue task")
        r = client.get("/tasks/overdue", headers=auth_headers)
        check(r.json() == [], "a completed task drops out of /tasks/overdue")

        print("\n41. A contact with activities or tasks cannot be deleted")
        r = client.post("/contacts", headers=auth_headers, json={"name": "Carol Temp"})
        check(r.status_code == 201, "throwaway contact created")
        carol_id = r.json()["id"]

        r = client.delete(f"/contacts/{carol_id}", headers=auth_headers)
        check(r.status_code == 204, "a contact with nothing attached deletes fine")

        r = client.post("/contacts", headers=auth_headers, json={"name": "Carol Temp"})
        carol_id = r.json()["id"]
        activity_ids = []
        for i in range(3):
            r = client.post(
                "/activities",
                headers=auth_headers,
                json={"type": "note", "content": f"Note {i}", "contact_id": carol_id},
            )
            activity_ids.append(r.json()["id"])
        r = client.post(
            "/tasks", headers=auth_headers, json={"title": "Carol task", "contact_id": carol_id}
        )
        carol_task_id = r.json()["id"]

        r = client.delete(f"/contacts/{carol_id}", headers=auth_headers)
        check(r.status_code == 400, f"delete blocked -> {r.status_code} (expected 400)")
        detail = r.json()["detail"]
        check(
            "3 activities and 1 task reference it" in detail,
            f"message states both counts, correctly pluralised: {detail!r}",
        )

        for activity_id in activity_ids:
            client.delete(f"/activities/{activity_id}", headers=auth_headers)
        r = client.delete(f"/contacts/{carol_id}", headers=auth_headers)
        check(r.status_code == 400, "still blocked while the task remains")
        check(
            "1 task reference it" in r.json()["detail"]
            and "activit" not in r.json()["detail"],
            f"message now mentions only the task: {r.json()['detail']!r}",
        )

        client.delete(f"/tasks/{carol_task_id}", headers=auth_headers)
        r = client.delete(f"/contacts/{carol_id}", headers=auth_headers)
        check(r.status_code == 204, f"delete succeeds once cleared -> {r.status_code}")

        print("\n42. Stage changes are auto-logged as activities")
        before = client.get(
            "/activities", headers=auth_headers, params={"deal_id": alice_deal_id}
        ).json()
        r = client.patch(
            f"/deals/{alice_deal_id}/stage", headers=auth_headers, json={"stage": "proposal_sent"}
        )
        check(r.status_code == 200, f"PATCH stage -> {r.status_code}")
        after = client.get(
            "/activities", headers=auth_headers, params={"deal_id": alice_deal_id}
        ).json()
        check(len(after) == len(before) + 1, f"one activity added ({len(before)} -> {len(after)})")
        logged = after[0]
        check(
            logged["content"] == "Deal moved from lead to proposal_sent",
            f"auto-log content: {logged['content']!r}",
        )
        check(logged["type"] == "note", f"auto-log type is note (got {logged['type']})")
        check(logged["deal_id"] == alice_deal_id, "auto-log is linked to the deal")
        check(logged["contact_id"] == alice_id, "auto-log is linked to the deal's contact")

        r = client.patch(
            f"/deals/{alice_deal_id}/stage", headers=auth_headers, json={"stage": "won"}
        )
        check(r.status_code == 200, "moved to won")
        r = client.get("/activities", headers=auth_headers, params={"deal_id": alice_deal_id})
        check(
            r.json()[0]["content"] == "Deal moved from proposal_sent to won",
            f"second auto-log: {r.json()[0]['content']!r}",
        )
        logged_count = len(r.json())

        r = client.post(f"/deals/{alice_deal_id}/reopen", headers=auth_headers)
        check(r.status_code == 200, "deal reopened")
        r = client.get("/activities", headers=auth_headers, params={"deal_id": alice_deal_id})
        check(
            len(r.json()) == logged_count,
            f"reopen does not auto-log (still {len(r.json())} activities)",
        )

        print("\n43. Activities and tasks are owner-scoped")
        r = client.get("/activities", headers=other_headers)
        check(r.status_code == 200 and r.json() == [], "other user's activity list is empty")
        r = client.get("/tasks", headers=other_headers)
        check(r.status_code == 200 and r.json() == [], "other user's task list is empty")
        r = client.get("/tasks/overdue", headers=other_headers)
        check(r.status_code == 200 and r.json() == [], "other user's overdue list is empty")

        r = client.get(f"/activities/{act_meeting_id}", headers=other_headers)
        check(r.status_code == 404, f"other user GET activity -> {r.status_code} (expected 404)")
        r = client.delete(f"/activities/{act_meeting_id}", headers=other_headers)
        check(r.status_code == 404, f"other user DELETE activity -> {r.status_code}")
        r = client.post(
            "/activities",
            headers=other_headers,
            json={"type": "note", "content": "x", "contact_id": alice_id},
        )
        check(r.status_code == 404, "other user cannot log against someone else's contact")

        r = client.get(f"/tasks/{task_id}", headers=other_headers)
        check(r.status_code == 404, f"other user GET task -> {r.status_code} (expected 404)")
        r = client.put(f"/tasks/{task_id}", headers=other_headers, json={"title": "hijacked"})
        check(r.status_code == 404, f"other user PUT task -> {r.status_code} (expected 404)")
        r = client.patch(f"/tasks/{task_id}/complete", headers=other_headers)
        check(r.status_code == 404, f"other user complete task -> {r.status_code}")
        r = client.patch(f"/tasks/{task_id}/cancel", headers=other_headers)
        check(r.status_code == 404, f"other user cancel task -> {r.status_code}")
        r = client.delete(f"/tasks/{task_id}", headers=other_headers)
        check(r.status_code == 404, f"other user DELETE task -> {r.status_code}")
        r = client.post(
            "/tasks", headers=other_headers, json={"title": "x", "deal_id": alice_deal_id}
        )
        check(r.status_code == 404, "other user cannot attach a task to someone else's deal")

        r = client.get("/activities", headers={"Authorization": "Bearer nope"})
        check(r.status_code == 401, f"GET /activities with a bad token -> {r.status_code}")
        r = client.get("/tasks", headers={"Authorization": "Bearer nope"})
        check(r.status_code == 401, f"GET /tasks with a bad token -> {r.status_code}")

        check(
            client.get(f"/activities/{act_meeting_id}", headers=auth_headers).status_code == 200,
            "the owner can still read their own activity after all that",
        )
        check(
            client.get(f"/tasks/{task_id}", headers=auth_headers).status_code == 200,
            "the owner can still read their own task after all that",
        )
        check(
            client.get(f"/activities/{bob_note_id}", headers=auth_headers).status_code == 200,
            "Bob's note is still readable",
        )

        # ------------------------------------------------------------------ #
        # Phase 4 -- Dashboard
        # ------------------------------------------------------------------ #
        print("\n" + "-" * 46)
        print("PHASE 4: DASHBOARD")
        print("-" * 46)

        def day(offset: timedelta) -> str:
            return (now + offset).date().isoformat()

        # A dedicated user so the expected numbers are exact rather than
        # whatever earlier sections happened to leave behind.
        dash_email = f"dash+{uuid.uuid4().hex[:10]}@example.com"
        r = client.post(
            "/auth/register",
            json={"email": dash_email, "password": PASSWORD, "full_name": "Dash User"},
        )
        check(r.status_code == 201, f"registered a fresh dashboard user -> {r.status_code}")
        r = client.post("/auth/login", data={"username": dash_email, "password": PASSWORD})
        dash_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        print("\n44. A brand-new account gets an empty dashboard, not an error")
        r = client.get("/dashboard/summary", headers=dash_headers)
        check(r.status_code == 200, f"GET /dashboard/summary -> {r.status_code} (expected 200)")
        empty = r.json()
        check(
            set(empty) == {"pipeline", "tasks", "recent_activity", "totals", "deals_closing_soon"},
            f"all five sections present: {sorted(empty)}",
        )
        check(len(empty["pipeline"]) == 6, "pipeline is zero-filled to all 6 stages")
        check(
            all(s["count"] == 0 and Decimal(s["total_value"]) == 0 for s in empty["pipeline"]),
            "every pipeline stage reads zero",
        )
        check(
            empty["tasks"] == {"overdue_count": 0, "due_this_week_count": 0},
            f"task counts are zero: {empty['tasks']}",
        )
        check(empty["recent_activity"] == [], "recent_activity is an empty list")
        check(empty["deals_closing_soon"] == [], "deals_closing_soon is an empty list")
        check(
            empty["totals"]["contacts"] == 0 and empty["totals"]["companies"] == 0,
            f"totals are zero: {empty['totals']}",
        )
        check(
            empty["totals"]["open_deals"] == 0
            and Decimal(empty["totals"]["open_pipeline_value"]) == 0,
            "open deal totals are zero",
        )
        r = client.get("/dashboard/activity-feed", headers=dash_headers)
        check(r.status_code == 200 and r.json() == [], "empty activity feed")
        r = client.get("/dashboard/deals-closing-soon", headers=dash_headers)
        check(r.status_code == 200 and r.json() == [], "empty closing-soon list")

        print("\n45. Build a small realistic dataset")
        company_ids = {}
        for name in ("Northwind", "Contoso"):
            r = client.post("/companies", headers=dash_headers, json={"name": name})
            check(r.status_code == 201, f"created company {name}")
            company_ids[name] = r.json()["id"]

        contact_ids = {}
        for name, company in (
            ("Dana Ito", "Northwind"),
            ("Eli Novak", "Contoso"),
            ("Fay Osei", None),
        ):
            body = {"name": name}
            if company:
                body["company_id"] = company_ids[company]
            r = client.post("/contacts", headers=dash_headers, json=body)
            check(r.status_code == 201, f"created contact {name}")
            contact_ids[name] = r.json()["id"]

        deal_ids = {}
        for title, contact, stage, value, close_offset in (
            ("Renewal", "Dana Ito", "lead", "1000.00", timedelta(days=3)),
            ("Expansion", "Eli Novak", "negotiation", "2000.00", timedelta(days=30)),
            ("Big win", "Dana Ito", "won", "3000.00", timedelta(days=3)),
            ("Got away", "Fay Osei", "lost", "4000.00", timedelta(days=3)),
        ):
            r = client.post(
                "/deals",
                headers=dash_headers,
                json={
                    "title": title,
                    "contact_id": contact_ids[contact],
                    "stage": stage,
                    "value": value,
                    "expected_close_date": day(close_offset),
                },
            )
            check(r.status_code == 201, f"created deal {title!r} at stage {stage}")
            deal_ids[title] = r.json()["id"]

        # Five hand-logged activities, deliberately not created in time order.
        # The last one is type "note" whose content does NOT start with the
        # auto-log prefix -- it must survive the filter.
        activity_plan = [
            ("call", "Called Dana about the renewal", "Dana Ito", timedelta(hours=-1)),
            ("email", "Emailed Eli the revised scope", "Eli Novak", timedelta(hours=-2)),
            ("meeting", "On-site with Dana", "Dana Ito", timedelta(hours=-3)),
            ("call", "Cold call to Fay", "Fay Osei", timedelta(hours=-4)),
            ("note", "Renewal terms agreed verbally", "Eli Novak", timedelta(hours=-5)),
        ]
        activity_order = []
        for kind, content, contact, offset in activity_plan:
            r = client.post(
                "/activities",
                headers=dash_headers,
                json={
                    "type": kind,
                    "content": content,
                    "contact_id": contact_ids[contact],
                    "occurred_at": iso(offset),
                },
            )
            check(r.status_code == 201, f"logged {kind}: {content!r}")
            activity_order.append(r.json()["id"])

        for title, due_offset in (
            ("Call Dana back", timedelta(days=1)),
            ("Chase overdue invoice", timedelta(days=-2)),
            ("Quarterly review prep", timedelta(days=30)),
        ):
            r = client.post(
                "/tasks",
                headers=dash_headers,
                json={"title": title, "due_date": iso(due_offset)},
            )
            check(r.status_code == 201, f"created task {title!r}")

        r = client.post(
            "/tasks",
            headers=dash_headers,
            json={"title": "Already handled", "due_date": iso(timedelta(days=-1))},
        )
        done_task_id = r.json()["id"]
        r = client.patch(f"/tasks/{done_task_id}/complete", headers=dash_headers)
        check(r.status_code == 200, "completed a past-due task (must not count as overdue)")

        print("\n46. The summary reflects exactly what was created")
        r = client.get("/dashboard/summary", headers=dash_headers)
        check(r.status_code == 200, f"GET /dashboard/summary -> {r.status_code}")
        s = r.json()

        pipeline = {p["stage"]: p for p in s["pipeline"]}
        expected_pipeline = {
            "lead": (1, "1000.00"),
            "contacted": (0, "0.00"),
            "proposal_sent": (0, "0.00"),
            "negotiation": (1, "2000.00"),
            "won": (1, "3000.00"),
            "lost": (1, "4000.00"),
        }
        for stage, (count, total) in expected_pipeline.items():
            check(
                pipeline[stage]["count"] == count
                and Decimal(pipeline[stage]["total_value"]) == Decimal(total),
                f"pipeline[{stage}] = {pipeline[stage]['count']} / "
                f"{pipeline[stage]['total_value']} (expected {count} / {total})",
            )

        r2 = client.get("/deals/pipeline-summary", headers=dash_headers)
        check(
            r2.json() == s["pipeline"],
            "dashboard pipeline is byte-identical to /deals/pipeline-summary",
        )

        check(
            s["tasks"] == {"overdue_count": 1, "due_this_week_count": 1},
            f"task counts: {s['tasks']} (expected 1 overdue, 1 due this week)",
        )

        totals = s["totals"]
        check(totals["contacts"] == 3, f"totals.contacts = {totals['contacts']} (expected 3)")
        check(totals["companies"] == 2, f"totals.companies = {totals['companies']} (expected 2)")
        check(
            totals["open_deals"] == 2,
            f"totals.open_deals = {totals['open_deals']} (expected 2, won/lost excluded)",
        )
        check(
            Decimal(totals["open_pipeline_value"]) == Decimal("3000.00"),
            f"totals.open_pipeline_value = {totals['open_pipeline_value']} (expected 3000.00)",
        )

        check(
            [a["id"] for a in s["recent_activity"]] == activity_order,
            "recent_activity holds all 5 hand-logged entries, newest first",
        )
        check(
            all(a["contact"] is not None and a["contact"]["name"] for a in s["recent_activity"]),
            "each recent_activity entry carries nested contact data",
        )
        check(
            s["recent_activity"][0]["content"] == "Called Dana about the renewal",
            f"newest entry: {s['recent_activity'][0]['content']!r}",
        )

        closing = s["deals_closing_soon"]
        check(
            [d["id"] for d in closing] == [deal_ids["Renewal"]],
            f"deals_closing_soon holds only the open deal closing in 3 days "
            f"(got {[d['title'] for d in closing]})",
        )
        check(
            closing[0]["contact"]["name"] == "Dana Ito",
            "closing-soon entries carry nested contact data",
        )
        check(
            deal_ids["Big win"] not in [d["id"] for d in closing]
            and deal_ids["Got away"] not in [d["id"] for d in closing],
            "won and lost deals are excluded even though they close in 3 days",
        )

        print("\n47. Auto-logged stage changes stay out of the activity feed")
        r = client.patch(
            f"/deals/{deal_ids['Renewal']}/stage",
            headers=dash_headers,
            json={"stage": "contacted"},
        )
        check(r.status_code == 200, f"PATCH stage -> {r.status_code}")
        r = client.get(
            "/activities", headers=dash_headers, params={"deal_id": deal_ids["Renewal"]}
        )
        check(
            len(r.json()) == 1 and r.json()[0]["content"].startswith("Deal moved from "),
            "the auto-logged activity really was written",
        )

        r = client.get("/dashboard/summary", headers=dash_headers)
        s2 = r.json()
        check(
            [a["id"] for a in s2["recent_activity"]] == activity_order,
            "recent_activity is unchanged -- the auto-logged note is filtered out",
        )
        check(
            not any(
                a["content"].startswith("Deal moved from ") for a in s2["recent_activity"]
            ),
            "no auto-logged content leaked into the feed",
        )
        check(
            any(a["content"] == "Called Dana about the renewal" for a in s2["recent_activity"]),
            "the hand-logged call is still there",
        )
        check(
            any(a["type"] == "note" for a in s2["recent_activity"]),
            "a hand-written note survives the filter (it matches on content, not just type)",
        )
        check(
            s2["pipeline"][0]["count"] == 0 and s2["pipeline"][1]["count"] == 1,
            "the shared pipeline query picked up the stage move (lead 0, contacted 1)",
        )

        print("\n48. Activity feed pagination")
        r = client.get("/dashboard/activity-feed", headers=dash_headers)
        check(r.status_code == 200, f"GET /dashboard/activity-feed -> {r.status_code}")
        check(
            [a["id"] for a in r.json()] == activity_order,
            f"default page returns all 5 hand-logged entries (got {len(r.json())})",
        )
        r = client.get("/dashboard/activity-feed", headers=dash_headers, params={"limit": 2})
        check([a["id"] for a in r.json()] == activity_order[:2], "?limit=2 returns the first page")
        r = client.get(
            "/dashboard/activity-feed", headers=dash_headers, params={"skip": 2, "limit": 2}
        )
        check(
            [a["id"] for a in r.json()] == activity_order[2:4],
            "?skip=2&limit=2 returns the second page",
        )
        r = client.get(
            "/dashboard/activity-feed", headers=dash_headers, params={"skip": 4, "limit": 2}
        )
        check(
            [a["id"] for a in r.json()] == activity_order[4:],
            "the last page returns the remaining entry",
        )
        r = client.get("/dashboard/activity-feed", headers=dash_headers, params={"skip": 50})
        check(r.json() == [], "paging past the end returns an empty list")

        print("\n49. Deals closing soon, with a custom window")
        r = client.get("/dashboard/deals-closing-soon", headers=dash_headers)
        check(
            [d["id"] for d in r.json()] == [deal_ids["Renewal"]],
            "default 7-day window matches the summary",
        )
        r = client.get(
            "/dashboard/deals-closing-soon", headers=dash_headers, params={"days": 90}
        )
        check(
            [d["id"] for d in r.json()] == [deal_ids["Renewal"], deal_ids["Expansion"]],
            "?days=90 widens the window, ordered by expected_close_date ascending",
        )
        r = client.get(
            "/dashboard/deals-closing-soon", headers=dash_headers, params={"days": 1}
        )
        check(r.json() == [], "?days=1 is too narrow to catch anything")

        print("\n50. Query parameter validation")
        for params, label in (
            ({"days": 0}, "days=0"),
            ({"days": 91}, "days=91"),
            ({"days": -1}, "days=-1"),
        ):
            r = client.get("/dashboard/deals-closing-soon", headers=dash_headers, params=params)
            check(r.status_code == 422, f"{label} -> {r.status_code} (expected 422)")
        for params, label in (
            ({"limit": 0}, "limit=0"),
            ({"limit": 101}, "limit=101"),
            ({"skip": -1}, "skip=-1"),
        ):
            r = client.get("/dashboard/activity-feed", headers=dash_headers, params=params)
            check(r.status_code == 422, f"{label} -> {r.status_code} (expected 422)")

        print("\n51. The dashboard is scoped to its own user")
        r = client.get("/dashboard/summary", headers=other_headers)
        check(r.status_code == 200, f"other user GET /dashboard/summary -> {r.status_code}")
        other_summary = r.json()
        check(
            all(p["count"] == 0 for p in other_summary["pipeline"]),
            "other user's pipeline is empty despite two users having deals",
        )
        check(
            other_summary["totals"]["contacts"] == 0
            and other_summary["totals"]["companies"] == 0
            and other_summary["totals"]["open_deals"] == 0,
            f"other user's totals are all zero: {other_summary['totals']}",
        )
        check(other_summary["recent_activity"] == [], "other user sees no activity")
        check(other_summary["deals_closing_soon"] == [], "other user sees no closing deals")
        check(
            other_summary["tasks"] == {"overdue_count": 0, "due_this_week_count": 0},
            "other user's task counts are zero",
        )

        r = client.get("/dashboard/summary", headers=auth_headers)
        check(
            r.json()["totals"]["contacts"] > 0,
            "meanwhile the first user's dashboard still shows their own data",
        )
        check(
            r.json()["totals"]["contacts"] != totals["contacts"]
            or r.json()["totals"]["companies"] != totals["companies"],
            "the two populated users see different numbers",
        )

        for path in ("/dashboard/summary", "/dashboard/activity-feed", "/dashboard/deals-closing-soon"):
            r = client.get(path, headers={"Authorization": "Bearer nope"})
            check(r.status_code == 401, f"GET {path} with a bad token -> {r.status_code}")
            r = client.get(path)
            check(r.status_code == 401, f"GET {path} with no token -> {r.status_code}")

    print("\n" + "=" * 46)
    print("ALL SMOKE TESTS PASSED")
    print("=" * 46)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except httpx.ConnectError:
        sys.exit("Could not reach the API. Start it with: uvicorn app.main:app --reload")
