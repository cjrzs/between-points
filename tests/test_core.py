import unittest

from backend.core import (
    apply_import_rows,
    build_chart_series,
    compute_moving_average,
    create_user,
    generate_prediction,
    hash_password,
    normalize_account,
    parse_csv_records,
    parse_excel_records,
    summarize_goal_progress,
    upsert_daily_record,
    validate_daily_record,
    verify_password,
)


class CoreTests(unittest.TestCase):
    def test_normalizes_account_names_for_login_as_register(self):
        self.assertEqual(normalize_account("  CJR@Example.COM  "), "cjr@example.com")
        with self.assertRaises(ValueError):
            normalize_account("   ")

    def test_creates_stable_lightweight_user_profiles(self):
        user = create_user("  CJR  ", "2026-06-07T06:00:00Z")

        self.assertEqual(user["account"], "cjr")
        self.assertEqual(user["displayName"], "CJR")
        self.assertEqual(user["createdAt"], "2026-06-07T06:00:00Z")
        self.assertTrue(user["id"].startswith("user-cjr-"))

    def test_hashes_and_verifies_passwords(self):
        password_hash = hash_password("secret-123", salt="fixed-salt")

        self.assertTrue(password_hash.startswith("pbkdf2_sha256$"))
        self.assertTrue(verify_password("secret-123", password_hash))
        self.assertFalse(verify_password("wrong", password_hash))
        with self.assertRaises(ValueError):
            hash_password("")

    def test_validates_numeric_weight_and_sleep_fields(self):
        self.assertEqual(validate_daily_record({"date": "2026-06-07", "weightKg": 72.4, "sleepHours": 7}), [])
        self.assertEqual(
            validate_daily_record({"date": "2026-06-07", "weightKg": "heavy", "sleepHours": "long"}),
            ["weightKg", "sleepHours"],
        )

    def test_upserts_daily_records_and_keeps_created_at(self):
        first = upsert_daily_record([], {"userId": "u1", "date": "2026-06-07", "weightKg": 72.4}, "2026-06-07T08:00:00Z")
        updated = upsert_daily_record(first, {"userId": "u1", "date": "2026-06-07", "weightKg": 72.1}, "2026-06-07T09:00:00Z")

        self.assertEqual(len(updated), 1)
        self.assertEqual(updated[0]["weightKg"], 72.1)
        self.assertEqual(updated[0]["createdAt"], "2026-06-07T08:00:00Z")
        self.assertEqual(updated[0]["updatedAt"], "2026-06-07T09:00:00Z")

    def test_computes_moving_average_only_after_enough_data_exists(self):
        self.assertEqual(compute_moving_average([70, 71, 72, 73], 3), [None, None, 71, 72])

    def test_builds_shared_date_chart_series(self):
        series = build_chart_series([
            {"date": "2026-06-01", "weightKg": 70, "exerciseCalories": 100, "sleepHours": 7},
            {"date": "2026-06-02", "weightKg": 69.8, "exerciseCalories": 180, "sleepHours": 6.5},
            {"date": "2026-06-03", "weightKg": 69.7, "exerciseCalories": 0, "sleepHours": 8},
        ])

        self.assertEqual(series["dates"], ["2026-06-01", "2026-06-02", "2026-06-03"])
        self.assertEqual(series["weights"], [70, 69.8, 69.7])
        self.assertEqual(series["exerciseCalories"], [100, 180, 0])
        self.assertEqual(series["sleepHours"], [7, 6.5, 8])
        self.assertEqual(series["ma7"], [None, None, None])

    def test_summarizes_goal_progress(self):
        summary = summarize_goal_progress([
            {"date": "2026-06-01", "weightKg": 75},
            {"date": "2026-06-07", "weightKg": 72},
        ], 68)

        self.assertEqual(summary["currentWeightKg"], 72)
        self.assertEqual(summary["distanceKg"], 4)
        self.assertEqual(summary["completionPercent"], 43)

    def test_generates_explainable_prediction_ranges(self):
        prediction = generate_prediction([
            {"date": "2026-06-01", "weightKg": 72.6, "sleepHours": 7, "tags": []},
            {"date": "2026-06-02", "weightKg": 72.4, "sleepHours": 7, "tags": []},
            {"date": "2026-06-03", "weightKg": 72.3, "sleepHours": 6.5, "tags": []},
            {"date": "2026-06-04", "weightKg": 72.2, "sleepHours": 5.5, "tags": ["highSalt", "highCarb"]},
        ], "en")

        self.assertEqual(len(prediction), 2)
        self.assertEqual(prediction[0]["targetDate"], "2026-06-05")
        self.assertLess(prediction[0]["minWeightKg"], prediction[0]["maxWeightKg"])
        self.assertTrue(any("salt" in factor or "carb" in factor for factor in prediction[0]["factors"]))
        self.assertRegex(prediction[0]["suggestion"], r"water weight|fluctuation")

    def test_parses_csv_records_into_import_rows(self):
        rows = parse_csv_records("date,weightKg,foodText,exerciseCalories,sleepHours,tags\n2026-06-07,72.4,hot pot,320,6.5,highSalt;diningOut")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["date"], "2026-06-07")
        self.assertEqual(rows[0]["weightKg"], 72.4)
        self.assertEqual(rows[0]["tags"], ["highSalt", "diningOut"])

    def test_parses_excel_records_into_import_rows(self):
        try:
            from openpyxl import Workbook
        except ImportError:
            self.skipTest("openpyxl is not installed")
        from io import BytesIO

        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["date", "weightKg", "foodText", "exerciseCalories", "sleepHours", "note"])
        sheet.append(["2026-06-07", 72.4, "hot pot", 320, 6.5, "excel row"])
        buffer = BytesIO()
        workbook.save(buffer)

        rows = parse_excel_records(buffer.getvalue())

        self.assertEqual(rows[0]["date"], "2026-06-07")
        self.assertEqual(rows[0]["weightKg"], 72.4)
        self.assertEqual(rows[0]["note"], "excel row")

    def test_applies_confirmed_import_rows(self):
        result = apply_import_rows([], "u1", [
            {"date": "2026-06-07", "weightKg": 72.4, "foodText": "rice", "exerciseCalories": 120, "sleepHours": 7}
        ], "2026-06-07T12:00:00Z")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["userId"], "u1")
        self.assertEqual(result[0]["foodText"], "rice")


if __name__ == "__main__":
    unittest.main()
