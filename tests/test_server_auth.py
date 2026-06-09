import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer

from backend.server import BetweenPointsHandler


class FakeRepository:
    def __init__(self):
        self.user = {
            "id": "user-1",
            "account": "cjr",
            "displayName": "CJR",
            "language": "zh",
            "targetWeightKg": 68,
            "createdAt": "2026-06-08T00:00:00Z",
        }
        self.records = []
        self.saved = []

    def login(self, account, password):
        self.user = {**self.user, "account": account.strip().lower(), "displayName": account.strip()}
        return self.user

    def login_wechat(self, openid, display_name="微信用户"):
        self.user = {
            **self.user,
            "id": "user-wechat-1",
            "account": f"wechat:{openid}",
            "displayName": display_name,
        }
        return self.user

    def create_session(self, user_id):
        return {"token": f"session-for-{user_id}", "expiresAt": "2026-07-08T00:00:00Z"}

    def user_id_for_session(self, token):
        if token == "session-for-user-1":
            return "user-1"
        if token == "session-for-user-wechat-1":
            return "user-wechat-1"
        return None

    def get_user(self, user_id):
        return self.user if user_id in {"user-1", "user-wechat-1"} else None

    def records_for_user(self, user_id):
        return self.records

    def save_record(self, user_id, record):
        saved = {"id": f"record-{user_id}-{record['date']}", "userId": user_id, **record}
        self.saved.append(saved)
        self.records.append(saved)
        return saved


class ServerAuthTests(unittest.TestCase):
    def setUp(self):
        self.repo = FakeRepository()

        class TestHandler(BetweenPointsHandler):
            repo = self.repo

            @staticmethod
            def wechat_code_to_openid(code):
                return f"openid-{code}"

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), TestHandler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()

    def test_password_login_returns_session_and_bearer_state(self):
        login = self.request("POST", "/api/login", {"account": " CJR ", "password": "secret-123"})

        self.assertEqual(login["session"]["token"], "session-for-user-1")
        self.assertEqual(login["user"]["account"], "cjr")

        state = self.request("GET", "/api/state", headers={"Authorization": "Bearer session-for-user-1"})

        self.assertEqual(state["user"]["id"], "user-1")
        self.assertEqual(state["records"], [])

    def test_wechat_login_exchanges_code_and_returns_session(self):
        payload = self.request("POST", "/api/wechat/login", {"code": "abc123", "displayName": "CJR"})

        self.assertEqual(payload["user"]["id"], "user-wechat-1")
        self.assertEqual(payload["user"]["account"], "wechat:openid-abc123")
        self.assertEqual(payload["session"]["token"], "session-for-user-wechat-1")

    def test_bearer_token_can_save_record_without_user_id(self):
        payload = self.request(
            "POST",
            "/api/records",
            {"date": "2026-06-08", "weightKg": 72.1, "sleepHours": 7},
            {"Authorization": "Bearer session-for-user-1"},
        )

        self.assertEqual(payload["record"]["userId"], "user-1")
        self.assertEqual(self.repo.saved[0]["weightKg"], 72.1)

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        raw = json.dumps(body).encode("utf-8") if body is not None else None
        request_headers = {"Content-Type": "application/json", **(headers or {})}
        connection.request(method, path, body=raw, headers=request_headers)
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        connection.close()
        self.assertLess(response.status, 400, payload)
        return payload


if __name__ == "__main__":
    unittest.main()
