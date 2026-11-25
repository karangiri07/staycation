"""Copy your local SQLite database (staycation.db) into a PostgreSQL database such as Neon.

Run it from the backend folder, with your local backend stopped:

    python tools/copy_to_postgres.py --source staycation.db --target "postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"

Safety:
  * The SQLite file is only read. Nothing in it is changed or deleted.
  * The copy runs as one transaction: either everything is copied or nothing is.
  * The target must be empty (a fresh Neon database). If it already has data the script stops without touching it.
    --wipe-target clears the copied tables of the TARGET first, and asks you to type YES.
  * Photos and reels stay on Cloudinary. Only their links are copied, so nothing is re-uploaded.
  * Not copied: the admin password/login data (the live admin uses ADMIN_PASSWORD from the server settings),
    wrong-password records and the error log.
"""
import argparse
import sys
from datetime import timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, func, inspect, select, text  # noqa: E402

from app.config import postgres_url  # noqa: E402
from app.models import Base  # noqa: E402

SKIP_TABLES = {"login_attempts", "error_logs"}
BATCH = 1000


def die(message, code=1):
    print("\nSTOPPED: " + message)
    sys.exit(code)


def count(conn, table):
    return conn.execute(select(func.count()).select_from(table)).scalar_one()


def main():
    parser = argparse.ArgumentParser(description="Copy a local SQLite staycation.db into PostgreSQL (Neon).")
    parser.add_argument("--source", required=True, help="path to the local SQLite file, for example staycation.db")
    parser.add_argument("--target", required=True, help="PostgreSQL address (put it in double quotes)")
    parser.add_argument("--wipe-target", action="store_true", help="clear the target tables first (asks for YES)")
    args = parser.parse_args()

    source_path = Path(args.source).expanduser().resolve()
    if not source_path.is_file():
        die(f"SQLite file not found: {source_path}")
    src = create_engine(f"sqlite:///{source_path.as_posix()}")
    dst = create_engine(postgres_url(args.target), pool_pre_ping=True)
    if dst.dialect.name != "postgresql":
        die("--target must be a PostgreSQL address (it starts with postgresql://).")
    shown = dst.url.render_as_string(hide_password=True)
    print(f"From : {source_path}\nTo   : {shown}")

    try:
        with dst.connect() as conn:
            conn.execute(text("select 1"))
    except Exception as exc:  # noqa: BLE001
        die("Could not connect to the PostgreSQL database. Check the address, the password and that it ends with ?sslmode=require.\n" + str(exc).splitlines()[0])

    Base.metadata.create_all(dst)
    tables = [t for t in Base.metadata.sorted_tables if t.name not in SKIP_TABLES]
    source_tables = set(inspect(src).get_table_names())

    with dst.connect() as conn:
        existing = {t.name: count(conn, t) for t in tables}
    if any(existing.values()):
        print("\nThe target database already has data:")
        for name, number in existing.items():
            if number:
                print(f"  {name}: {number} rows")
        if not args.wipe_target:
            die("Nothing was changed. Use a fresh empty database, or run again with --wipe-target to erase those rows first.", 2)
        if input("\nType YES to erase these rows in the TARGET database (your SQLite file stays untouched): ").strip() != "YES":
            die("Cancelled. Nothing was changed.", 2)

    report = []
    copied_ids = {}
    try:
        with dst.begin() as out:
            if args.wipe_target:
                for table in reversed(tables):
                    out.execute(table.delete())
            for table in tables:
                if table.name not in source_tables:
                    report.append((table.name, 0, 0, 0))
                    continue
                have = {c["name"] for c in inspect(src).get_columns(table.name)}
                columns = [c for c in table.columns if c.name in have]
                stamped = {c.name for c in columns if getattr(c.type, "timezone", False)}
                pk = next(iter(table.primary_key.columns)).name if len(table.primary_key.columns) == 1 else None
                seen = 0
                kept = 0
                skipped = 0
                batch = []
                with src.connect() as reader:
                    rows = reader.execute(select(*columns)).mappings()
                    for row in rows:
                        seen += 1
                        row = dict(row)
                        if table.name == "settings" and str(row.get("key", "")).startswith("admin."):
                            skipped += 1
                            continue
                        if "property_id" in row and row["property_id"] not in copied_ids.get("properties", set()):
                            skipped += 1  # points at a property that no longer exists
                            continue
                        for name in stamped:
                            if row.get(name) is not None and row[name].tzinfo is None:
                                row[name] = row[name].replace(tzinfo=timezone.utc)  # SQLite stores UTC without a label
                        if pk:
                            copied_ids.setdefault(table.name, set()).add(row[pk])
                        batch.append(row)
                        kept += 1
                        if len(batch) >= BATCH:
                            out.execute(table.insert(), batch)
                            batch = []
                if batch:
                    out.execute(table.insert(), batch)
                report.append((table.name, seen, kept, skipped))
            # The copied rows keep their original ids, so the counters that hand out the next id must continue after them.
            for table in tables:
                if "id" in table.c and table.c.id.primary_key:
                    out.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM {table.name}), 1), (SELECT MAX(id) IS NOT NULL FROM {table.name}))"
                    ))
    except Exception as exc:  # noqa: BLE001
        die("The copy failed, so NOTHING was written to the target (it is all-or-nothing).\n" + str(exc).splitlines()[0])

    print(f"\n{'table':<18}{'in SQLite':>10}{'copied':>9}{'skipped':>9}{'in Postgres':>13}")
    bad = False
    with dst.connect() as conn:
        for name, seen, kept, skipped in report:
            table = Base.metadata.tables[name]
            final = count(conn, table)
            flag = "" if final == kept else "   <-- MISMATCH"
            bad = bad or final != kept
            print(f"{name:<18}{seen:>10}{kept:>9}{skipped:>9}{final:>13}{flag}")
    if bad:
        die("Row counts do not match. Do not go live; send this output to your developer.", 3)
    if not copied_ids.get("properties"):
        print("\nNote: the SQLite file had no properties, so the live site will add its 6 sample stays on first start.")
    print("\nDONE. Everything matches. Next: deploy the backend with DATABASE_URL set to this same PostgreSQL address.")


if __name__ == "__main__":
    main()
