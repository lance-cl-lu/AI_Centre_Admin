import os
import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        # Only the serving process reconciles: skip makemigrations/migrate/test and the
        # runserver autoreload parent (RUN_MAIN is set in the child that serves requests).
        if "runserver" not in sys.argv:
            return
        if os.environ.get("RUN_MAIN") != "true" and "--noreload" not in sys.argv:
            return
        from .groupshare_reconcile import start_background_reconciler

        start_background_reconciler()
