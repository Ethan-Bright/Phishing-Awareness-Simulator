"""Grant (or create) an admin user for the dashboard.

Usage:
    python scripts/set_admin.py admin@eduvos.example
    python scripts/set_admin.py admin@eduvos.example --password "StrongPass123!"
    python scripts/set_admin.py admin@eduvos.example --project my-project-id

If the account does not exist and --password is given, it is created.
Admin rights are stored as a Firebase custom claim, not in Firestore.
The user must sign out and back in for the claim to take effect.
"""

import sys
import argparse
from firebase_admin import auth
from _init import get_app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("--password", default=None)
    parser.add_argument("--project", default=None)
    args = parser.parse_args()

    try:
        get_app(args.project)
    except Exception as exc:
        print("Could not authenticate with Firebase Admin SDK.")
        print("Option A (easiest): download a service account key from Firebase Console")
        print("  Project settings -> Service accounts -> Generate new private key")
        print("  Save as serviceAccount.json in the project root, then re-run this script.")
        print("Option B: gcloud Application Default Credentials")
        print("  gcloud auth application-default revoke")
        print("  gcloud auth application-default login")
        print("  On the Google consent page, click Allow for ALL requested permissions.")
        print(f"\nDetails: {exc}")
        sys.exit(1)

    try:
        user = auth.get_user_by_email(args.email)
        print(f"Found user {args.email} ({user.uid}).")
    except auth.UserNotFoundError:
        if not args.password:
            print(f"No user '{args.email}'. Re-run with --password to create one.")
            sys.exit(1)
        user = auth.create_user(email=args.email, password=args.password)
        print(f"Created user {args.email} ({user.uid}).")

    auth.set_custom_user_claims(user.uid, {"admin": True})
    print("Admin claim set. Sign out and back in for it to apply.")


if __name__ == "__main__":
    main()
