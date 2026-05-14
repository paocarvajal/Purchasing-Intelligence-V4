"""
Cleanup Odoo Phantom Products "(1)"
====================================
Archives product.template records that have no Internal Reference (default_code).
These are ghost variants created during bulk imports.

Usage:
  python cleanup_odoo_phantoms.py

Before running, set your Odoo credentials below.
"""

import xmlrpc.client
import sys
import time

# ============================================================
# CONFIGURATION — Fill in your Odoo details
# ============================================================
ODOO_URL    = "https://herramaxplus.odoo.com"   # Your Odoo URL
ODOO_DB     = "herramaxplus"                     # Database name (usually same as subdomain)
ODOO_USER   = "herramaxplus@gmail.com"           # Your login email
ODOO_PASS   = "YOUR_API_KEY_OR_PASSWORD"         # API key or password

# Safety settings
DRY_RUN     = True     # Set to False to actually archive
BATCH_SIZE  = 200      # Records per batch to avoid timeout
# ============================================================


def connect():
    """Connect to Odoo via XML-RPC and return uid."""
    common = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/common")
    print(f"Odoo version: {common.version()['server_version']}")
    uid = common.authenticate(ODOO_DB, ODOO_USER, ODOO_PASS, {})
    if not uid:
        print("❌ Authentication failed. Check credentials.")
        sys.exit(1)
    print(f"✅ Authenticated as UID {uid}")
    return uid


def find_phantoms(models, uid):
    """Find product.template records with no default_code (Internal Reference)."""
    # Search for products where default_code is False/empty
    domain = [
        ('default_code', '=', False),
        ('active', '=', True),
    ]
    ids = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'product.template', 'search',
        [domain],
    )
    print(f"Found {len(ids)} product templates with no Internal Reference")
    return ids


def preview_phantoms(models, uid, phantom_ids):
    """Show a preview of what will be archived."""
    # Read first 10 records to confirm they're the right ones
    preview = models.execute_kw(
        ODOO_DB, uid, ODOO_PASS,
        'product.template', 'read',
        [phantom_ids[:10]],
        {'fields': ['id', 'name', 'default_code', 'categ_id', 'list_price', 'standard_price']},
    )
    print("\n--- PREVIEW (first 10 records to be archived) ---")
    for rec in preview:
        print(f"  ID {rec['id']:>6} | Name: {str(rec['name'])[:60]:<60} | Cost: {rec['standard_price']}")
    print("---")


def archive_in_batches(models, uid, phantom_ids, batch_size=200):
    """Archive records in batches to prevent timeout."""
    total = len(phantom_ids)
    archived = 0
    errors = 0

    print(f"\nArchiving {total} records in batches of {batch_size}...")

    for i in range(0, total, batch_size):
        batch = phantom_ids[i:i + batch_size]
        try:
            models.execute_kw(
                ODOO_DB, uid, ODOO_PASS,
                'product.template', 'write',
                [batch, {'active': False}],
            )
            archived += len(batch)
            pct = (archived / total) * 100
            print(f"  ✅ Batch {i // batch_size + 1}: archived {len(batch)} records ({archived}/{total} = {pct:.1f}%)")
        except Exception as e:
            errors += len(batch)
            print(f"  ❌ Batch {i // batch_size + 1} failed: {e}")

        # Small delay to avoid overwhelming the server
        time.sleep(0.5)

    print(f"\n{'='*50}")
    print(f"DONE: {archived} archived, {errors} errors")
    print(f"{'='*50}")
    return archived


def main():
    print("=" * 60)
    print("  Odoo Phantom Product Cleanup")
    print("  Mode:", "🔍 DRY RUN (preview only)" if DRY_RUN else "🔴 LIVE (will archive)")
    print("=" * 60)

    models = xmlrpc.client.ServerProxy(f"{ODOO_URL}/xmlrpc/2/object")
    uid = connect()

    phantom_ids = find_phantoms(models, uid)

    if not phantom_ids:
        print("✅ No phantom records found. Database is clean!")
        return

    preview_phantoms(models, uid, phantom_ids)

    if DRY_RUN:
        print(f"\n🔍 DRY RUN: Would archive {len(phantom_ids)} records.")
        print("   To execute, set DRY_RUN = False in the script and run again.")
        return

    confirm = input(f"\n⚠️  Archive {len(phantom_ids)} records? Type 'YES' to confirm: ")
    if confirm.strip() != "YES":
        print("Cancelled.")
        return

    archive_in_batches(models, uid, phantom_ids, BATCH_SIZE)


if __name__ == "__main__":
    main()
