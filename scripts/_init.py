"""Shared Firebase Admin initialisation for the helper scripts.

Credentials are resolved in this order:
  1. A service-account JSON at ./serviceAccount.json (git-ignored), or the path
     in the GOOGLE_APPLICATION_CREDENTIALS environment variable.
  2. Application Default Credentials (run `gcloud auth application-default login`).

Project id comes from --project, the FIREBASE_PROJECT / GOOGLE_CLOUD_PROJECT
environment variable, or the default project in .firebaserc.
"""

import json
import os
import firebase_admin
from firebase_admin import credentials

_app = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _default_project_id() -> str | None:
    """Read the default Firebase project from .firebaserc in the repo root."""
    path = os.path.join(ROOT, ".firebaserc")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("projects", {}).get("default")
    except (OSError, json.JSONDecodeError, AttributeError):
        return None


def get_app(project: str | None = None):
    global _app
    if _app is not None:
        return _app

    project = (
        project
        or os.environ.get("FIREBASE_PROJECT")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or _default_project_id()
    )
    if not project:
        raise RuntimeError(
            "No Firebase project id. Pass --project, set FIREBASE_PROJECT, "
            "or add a default project in .firebaserc."
        )
    opts = {"projectId": project}

    env_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    candidates = [env_path, os.path.join(ROOT, "serviceAccount.json")] if env_path else [os.path.join(ROOT, "serviceAccount.json")]
    sa_path = next((p for p in candidates if p and os.path.exists(p)), None)

    if sa_path:
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault()

    _app = firebase_admin.initialize_app(cred, opts)
    return _app
