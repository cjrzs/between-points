from __future__ import annotations

import json
from typing import Any

from .core import clean_daily_record, create_user, hash_password, normalize_account, utc_now_iso, validate_daily_record, verify_password

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - exercised in Docker/runtime dependency checks
    psycopg = None
    dict_row = None


class PostgresRepository:
    def __init__(self, database_url: str, table_prefix: str = ""):
        if psycopg is None:
            raise RuntimeError("psycopg is required for PostgreSQL storage. Install backend/requirements.txt.")
        self.database_url = database_url
        self.table_prefix = table_prefix
        self.users_table = f"{table_prefix}users"
        self.records_table = f"{table_prefix}daily_records"
        self._init_db()

    def connect(self):
        return psycopg.connect(self.database_url, row_factory=dict_row)

    def _init_db(self) -> None:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    create table if not exists {self.users_table} (
                        id text primary key,
                        account text not null unique,
                        password_hash text,
                        display_name text not null,
                        language text not null default 'zh',
                        target_weight_kg double precision not null default 68,
                        created_at text not null
                    )
                    """
                )
                cur.execute(
                    f"""
                    create table if not exists {self.records_table} (
                        id text primary key,
                        user_id text not null references {self.users_table}(id) on delete cascade,
                        date text not null,
                        weight_kg double precision,
                        food_text text,
                        calories_in double precision,
                        protein_g double precision,
                        carbs_g double precision,
                        fat_g double precision,
                        food_items_json jsonb not null default '[]'::jsonb,
                        exercise_items_json jsonb not null default '[]'::jsonb,
                        exercise_calories double precision,
                        sleep_hours double precision,
                        tags_json jsonb not null default '[]'::jsonb,
                        note text,
                        created_at text not null,
                        updated_at text not null,
                        unique(user_id, date)
                    )
                    """
                )
                cur.execute(f"alter table {self.users_table} add column if not exists password_hash text")

    def reset_for_tests(self) -> None:
        if not self.table_prefix:
            raise RuntimeError("reset_for_tests requires a table prefix")
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"drop table if exists {self.records_table} cascade")
                cur.execute(f"drop table if exists {self.users_table} cascade")
        self._init_db()

    def login(self, account: str, password: str) -> dict[str, Any]:
        if not password:
            raise ValueError("password is required")
        normalized = normalize_account(account)
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"select * from {self.users_table} where account = %s", (normalized,))
                existing = cur.fetchone()
                if existing:
                    if existing.get("password_hash"):
                        if not verify_password(password, existing["password_hash"]):
                            raise PermissionError("invalid account or password")
                    else:
                        cur.execute(
                            f"update {self.users_table} set password_hash = %s where id = %s",
                            (hash_password(password), existing["id"]),
                        )
                    return self._user_from_row(existing)
                user = create_user(account)
                cur.execute(
                    f"""
                    insert into {self.users_table} (id, account, password_hash, display_name, language, target_weight_kg, created_at)
                    values (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (user["id"], user["account"], hash_password(password), user["displayName"], user["language"], user["targetWeightKg"], user["createdAt"]),
                )
                return user

    def get_user(self, user_id: str) -> dict[str, Any] | None:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"select * from {self.users_table} where id = %s", (user_id,))
                row = cur.fetchone()
                return self._user_from_row(row) if row else None

    def update_user(self, user_id: str, data: dict[str, Any]) -> dict[str, Any]:
        user = self.get_user(user_id)
        if not user:
            raise KeyError("user not found")
        language = data.get("language", user["language"])
        target = data.get("targetWeightKg", user["targetWeightKg"])
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"update {self.users_table} set language = %s, target_weight_kg = %s where id = %s",
                    (language, target, user_id),
                )
        updated = self.get_user(user_id)
        if not updated:
            raise KeyError("user not found")
        return updated

    def records_for_user(self, user_id: str) -> list[dict[str, Any]]:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"select * from {self.records_table} where user_id = %s order by date", (user_id,))
                return [self._record_from_row(row) for row in cur.fetchall()]

    def save_record(self, user_id: str, record: dict[str, Any]) -> dict[str, Any]:
        payload = clean_daily_record({**record, "userId": user_id})
        errors = validate_daily_record(payload)
        if errors:
            raise ValueError(",".join(errors))
        now = utc_now_iso()
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"select * from {self.records_table} where user_id = %s and date = %s", (user_id, payload["date"]))
                existing = cur.fetchone()
                created = existing["created_at"] if existing else now
                record_id = existing["id"] if existing else f"record-{user_id}-{payload['date']}"
                cur.execute(
                    f"""
                    insert into {self.records_table} (
                        id, user_id, date, weight_kg, food_text, calories_in, protein_g, carbs_g, fat_g,
                        food_items_json, exercise_items_json, exercise_calories, sleep_hours, tags_json,
                        note, created_at, updated_at
                    ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s::jsonb, %s, %s, %s)
                    on conflict(user_id, date) do update set
                        weight_kg=excluded.weight_kg,
                        food_text=excluded.food_text,
                        calories_in=excluded.calories_in,
                        protein_g=excluded.protein_g,
                        carbs_g=excluded.carbs_g,
                        fat_g=excluded.fat_g,
                        food_items_json=excluded.food_items_json,
                        exercise_items_json=excluded.exercise_items_json,
                        exercise_calories=excluded.exercise_calories,
                        sleep_hours=excluded.sleep_hours,
                        tags_json=excluded.tags_json,
                        note=excluded.note,
                        updated_at=excluded.updated_at
                    """,
                    (
                        record_id,
                        user_id,
                        payload["date"],
                        payload["weightKg"],
                        payload["foodText"],
                        payload["caloriesIn"],
                        payload["proteinG"],
                        payload["carbsG"],
                        payload["fatG"],
                        json.dumps(payload["foodItems"], ensure_ascii=False),
                        json.dumps(payload["exerciseItems"], ensure_ascii=False),
                        payload["exerciseCalories"],
                        payload["sleepHours"],
                        json.dumps(payload["tags"], ensure_ascii=False),
                        payload["note"],
                        created,
                        now,
                    ),
                )
                cur.execute(f"select * from {self.records_table} where user_id = %s and date = %s", (user_id, payload["date"]))
                return self._record_from_row(cur.fetchone())

    def delete_record(self, user_id: str, date: str) -> None:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(f"delete from {self.records_table} where user_id = %s and date = %s", (user_id, date))

    def _user_from_row(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "account": row["account"],
            "displayName": row["display_name"],
            "language": row["language"],
            "targetWeightKg": row["target_weight_kg"],
            "createdAt": row["created_at"],
        }

    def _record_from_row(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "userId": row["user_id"],
            "date": row["date"],
            "weightKg": row["weight_kg"],
            "foodText": row["food_text"] or "",
            "caloriesIn": row["calories_in"],
            "proteinG": row["protein_g"],
            "carbsG": row["carbs_g"],
            "fatG": row["fat_g"],
            "foodItems": row["food_items_json"] or [],
            "exerciseItems": row["exercise_items_json"] or [],
            "exerciseCalories": row["exercise_calories"] or 0,
            "sleepHours": row["sleep_hours"],
            "tags": row["tags_json"] or [],
            "note": row["note"] or "",
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
