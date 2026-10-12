from django.core.management.base import BaseCommand

from api.groupshare_reconcile import reconcile_groupshare


class Command(BaseCommand):
    help = "Sync GroupShare Profile annotations and NFS directories from the Django DB."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report differences without changing anything.")

    def handle(self, *args, **options):
        summary = reconcile_groupshare(dry_run=options["dry_run"])
        if summary["errors"]:
            raise SystemExit(1)
