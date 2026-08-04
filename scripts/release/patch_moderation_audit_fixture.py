from pathlib import Path

path = Path("services/api/tests/integration/test_scoped_moderation_real_db.py")
content = path.read_text(encoding="utf-8")
old = """                      review_moderation.sanctions,
                      identity.authorization_audit_events,
"""
new = """                      review_moderation.sanctions,
                      audit.event_facts,
                      identity.authorization_audit_events,
"""
if content.count(old) != 1:
    raise SystemExit("moderation cleanup target did not match exactly once")
path.write_text(content.replace(old, new, 1), encoding="utf-8")
