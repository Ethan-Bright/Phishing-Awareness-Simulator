"""Issue (or create) a participant login for the portal.

Usage:
    python scripts/set_participant.py student@eduvos.example --role student --code STU-0001 --password "TempPass123!"
    python scripts/set_participant.py lecturer@eduvos.example --role lecturer --code LEC-0001

Participant access is a Firebase custom claim: {participant, role, code}.
The code must be the same anonymised code used in campaigns. Setting this claim removes any
admin claim on the account: participants must never hold admin rights.
The user must sign out and back in for the claim to take effect.
"""

import sys
import argparse
from firebase_admin import auth
from _init import get_app

ROLES = ["student", "staff", "lecturer", "sales", "consultant"]


def issue(email, role, code, password=None, display_name=None):
    """Create the account if needed and set participant claims. Returns the user."""
    try:
        user = auth.get_user_by_email(email)
        print(f"Found user {email} ({user.uid}).")
        if password:
            auth.update_user(user.uid, password=password)
        if display_name:
            auth.update_user(user.uid, display_name=display_name)
    except auth.UserNotFoundError:
        if not password:
            print(f"No user '{email}'. Re-run with --password to create one.")
            sys.exit(1)
        user = auth.create_user(email=email, password=password, display_name=display_name)
        print(f"Created user {email} ({user.uid}).")

    auth.set_custom_user_claims(user.uid, {"participant": True, "role": role, "code": code})
    return user


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--role", required=True, choices=ROLES)
    parser.add_argument("--code", required=True, help="Anonymised participant code, e.g. STU-0001")
    parser.add_argument("--password", default=None)
    parser.add_argument("--name", default=None, help="Display name shown in the portal")
    parser.add_argument("--project", default=None)
    args = parser.parse_args()

    try:
        get_app(args.project)
    except Exception as exc:
        print("Could not authenticate with Firebase Admin SDK. See scripts/set_admin.py for setup.")
        print(f"\nDetails: {exc}")
        sys.exit(1)

    issue(args.email, args.role, args.code.strip(), args.password, args.name)
    print(f"Participant claim set (role={args.role}, code={args.code}). Sign out and back in for it to apply.")


if __name__ == "__main__":
    main()
