import os
import unittest

from backend.storage import PostgresRepository


class StorageTests(unittest.TestCase):
    def setUp(self):
        database_url = os.environ.get("TEST_DATABASE_URL")
        if not database_url:
            self.skipTest("TEST_DATABASE_URL is not set")
        self.repo = PostgresRepository(database_url, table_prefix="test_bp_")
        self.repo.reset_for_tests()

    def test_login_creates_user_and_reuses_existing_account(self):
        first = self.repo.login("  CJR  ", "secret-123")
        second = self.repo.login("cjr", "secret-123")

        self.assertEqual(first["id"], second["id"])
        self.assertEqual(first["account"], "cjr")
        with self.assertRaises(PermissionError):
            self.repo.login("cjr", "wrong")

    def test_records_are_isolated_by_user(self):
        u1 = self.repo.login("alpha", "secret-123")
        u2 = self.repo.login("beta", "secret-123")
        self.repo.save_record(u1["id"], {"date": "2026-06-07", "weightKg": 72.4, "sleepHours": 7})
        self.repo.save_record(u2["id"], {"date": "2026-06-07", "weightKg": 61, "sleepHours": 8})

        self.assertEqual(len(self.repo.records_for_user(u1["id"])), 1)
        self.assertEqual(self.repo.records_for_user(u1["id"])[0]["weightKg"], 72.4)
        self.assertEqual(self.repo.records_for_user(u2["id"])[0]["weightKg"], 61)


if __name__ == "__main__":
    unittest.main()
