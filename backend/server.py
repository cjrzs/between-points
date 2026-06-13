from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

from .core import analyze_records, build_chart_series, generate_prediction, generate_sample_excel, parse_csv_records, parse_excel_records, summarize_goal_progress
from .storage import PostgresRepository


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DEFAULT_DATABASE_URL = "postgresql://between_points:between_points@127.0.0.1:5432/between_points"


class BetweenPointsHandler(BaseHTTPRequestHandler):
    repo: Repository

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self.handle_state(parse_qs(parsed.query))
            return
        if parsed.path == "/api/import/sample.xlsx":
            self.handle_sample_excel()
            return
        self.serve_static(parsed.path)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.add_cors_headers()
        self.end_headers()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/wechat/login":
            self.handle_wechat_login()
            return
        if parsed.path == "/api/records":
            self.handle_save_record()
            return
        if parsed.path == "/api/import/parse":
            self.handle_parse_import()
            return
        if parsed.path == "/api/import/confirm":
            self.handle_confirm_import()
            return
        if parsed.path == "/api/import/image":
            self.handle_image_import()
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "route not found")

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/user":
            self.handle_update_user()
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "route not found")

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/records":
            query = parse_qs(parsed.query)
            user_id = self.resolve_user_id(first(query, "userId"))
            date = first(query, "date")
            if not user_id or not date:
                self.send_error_json(HTTPStatus.BAD_REQUEST, "userId or bearer token and date are required")
                return
            if user_id == "__unauthorized__":
                self.send_error_json(HTTPStatus.UNAUTHORIZED, "invalid or expired session")
                return
            self.repo.delete_record(user_id, date)
            self.send_json({"ok": True})
            return
        self.send_error_json(HTTPStatus.NOT_FOUND, "route not found")

    def handle_login(self) -> None:
        body = self.read_json()
        try:
            user = self.repo.login(body.get("account", ""), body.get("password", ""))
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return
        except PermissionError as exc:
            self.send_error_json(HTTPStatus.UNAUTHORIZED, str(exc))
            return
        self.send_json({"user": user, "session": self.repo.create_session(user["id"]), **self.state_for_user(user["id"])})

    def handle_wechat_login(self) -> None:
        body = self.read_json()
        code = body.get("code")
        if not code:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "code is required")
            return
        try:
            openid = self.wechat_code_to_openid(code)
            user = self.repo.login_wechat(openid, body.get("displayName") or body.get("nickname") or "微信用户")
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return
        except RuntimeError as exc:
            self.send_error_json(HTTPStatus.BAD_GATEWAY, str(exc))
            return
        self.send_json({"user": user, "session": self.repo.create_session(user["id"]), **self.state_for_user(user["id"])})

    def handle_state(self, query: dict[str, list[str]]) -> None:
        user_id = self.resolve_user_id(first(query, "userId"))
        if not user_id:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "userId or bearer token is required")
            return
        if user_id == "__unauthorized__":
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "invalid or expired session")
            return
        user = self.repo.get_user(user_id)
        if not user:
            self.send_error_json(HTTPStatus.NOT_FOUND, "user not found")
            return
        self.send_json({"user": user, **self.state_for_user(user_id)})

    def handle_update_user(self) -> None:
        body = self.read_json()
        user_id = self.resolve_user_id(body.get("userId"))
        if not user_id:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "userId or bearer token is required")
            return
        if user_id == "__unauthorized__":
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "invalid or expired session")
            return
        try:
            user = self.repo.update_user(user_id, body)
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "user not found")
            return
        self.send_json({"user": user, **self.state_for_user(user_id)})

    def handle_save_record(self) -> None:
        body = self.read_json()
        user_id = self.resolve_user_id(body.pop("userId", None))
        if not user_id:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "userId or bearer token is required")
            return
        if user_id == "__unauthorized__":
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "invalid or expired session")
            return
        try:
            record = self.repo.save_record(user_id, body)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return
        self.send_json({"record": record, **self.state_for_user(user_id)})

    def handle_parse_import(self) -> None:
        body = self.read_json()
        weight_unit = body.get("weightUnit", "kg")
        if body.get("fileData"):
            try:
                content = base64.b64decode(body["fileData"])
            except ValueError:
                self.send_error_json(HTTPStatus.BAD_REQUEST, "invalid file data")
                return
            file_name = (body.get("fileName") or "").lower()
            if file_name.endswith(".xlsx"):
                rows = parse_excel_records(content, weight_unit=weight_unit)
            elif file_name.endswith(".csv"):
                rows = parse_csv_records(content.decode("utf-8-sig"), weight_unit=weight_unit)
            else:
                self.send_error_json(HTTPStatus.BAD_REQUEST, "only .xlsx and .csv files are supported")
                return
        else:
            rows = parse_csv_records(body.get("csv", ""), weight_unit=weight_unit)
        self.send_json({"rows": rows})

    def handle_sample_excel(self) -> None:
        content = generate_sample_excel()
        self.send_response(HTTPStatus.OK)
        self.add_cors_headers()
        self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("Content-Disposition", 'attachment; filename="between-points-sample.xlsx"')
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def handle_image_import(self) -> None:
        body = self.read_json()
        image_data = body.get("imageData")
        mime_type = body.get("mimeType", "image/png")
        if not image_data:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "imageData is required")
            return
        try:
            rows = analyze_image_with_llm(image_data, mime_type)
        except RuntimeError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return
        self.send_json({"rows": rows})

    def handle_confirm_import(self) -> None:
        body = self.read_json()
        user_id = self.resolve_user_id(body.get("userId"))
        if not user_id:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "userId or bearer token is required")
            return
        if user_id == "__unauthorized__":
            self.send_error_json(HTTPStatus.UNAUTHORIZED, "invalid or expired session")
            return
        saved = []
        try:
            for row in body.get("rows", []):
                saved.append(self.repo.save_record(user_id, row))
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return
        self.send_json({"saved": saved, **self.state_for_user(user_id)})

    def state_for_user(self, user_id: str) -> dict:
        user = self.repo.get_user(user_id)
        records = self.repo.records_for_user(user_id)
        language = (user or {}).get("language", "zh")
        predictions = generate_prediction(records, language)
        return {
            "records": records,
            "chartSeries": build_chart_series(records),
            "goalProgress": summarize_goal_progress(records, (user or {}).get("targetWeightKg", 68)),
            "predictions": predictions,
            "analysis": analyze_records(records, predictions),
        }

    def resolve_user_id(self, requested_user_id: str | None) -> str | None:
        token = self.bearer_token()
        if not token:
            return requested_user_id
        user_id = self.repo.user_id_for_session(token)
        if not user_id or (requested_user_id and requested_user_id != user_id):
            return "__unauthorized__"
        return user_id

    def bearer_token(self) -> str | None:
        value = self.headers.get("Authorization", "")
        if not value.lower().startswith("bearer "):
            return None
        return value.split(" ", 1)[1].strip()

    @staticmethod
    def wechat_code_to_openid(code: str) -> str:
        mock_openid = os.environ.get("WECHAT_MOCK_OPENID")
        if mock_openid:
            return mock_openid
        app_id = os.environ.get("WECHAT_APP_ID")
        app_secret = os.environ.get("WECHAT_APP_SECRET")
        if not app_id or not app_secret:
            raise RuntimeError("WECHAT_APP_ID and WECHAT_APP_SECRET are required")
        query = urlencode({
            "appid": app_id,
            "secret": app_secret,
            "js_code": code,
            "grant_type": "authorization_code",
        })
        request = urllib.request.Request(f"https://api.weixin.qq.com/sns/jscode2session?{query}", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as exc:
            raise RuntimeError(f"WeChat login request failed: {exc}") from exc
        if payload.get("errcode"):
            raise RuntimeError(payload.get("errmsg") or "WeChat login failed")
        if not payload.get("openid"):
            raise RuntimeError("WeChat login did not return openid")
        return payload["openid"]

    def serve_static(self, path: str) -> None:
        if path in ("", "/"):
            target = FRONTEND / "index.html"
        else:
            target = (FRONTEND / path.lstrip("/")).resolve()
            if FRONTEND not in target.parents and target != FRONTEND:
                self.send_error(HTTPStatus.FORBIDDEN)
                return
        if not target.exists() or not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content = target.read_bytes()
        mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", f"{mime}; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        return json.loads(raw or "{}")

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.add_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_json({"error": message}, status)

    def add_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def log_message(self, format: str, *args) -> None:
        return


def first(query: dict[str, list[str]], key: str) -> str | None:
    values = query.get(key)
    return values[0] if values else None


def analyze_image_with_llm(image_data: str, mime_type: str) -> list[dict]:
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("LLM_API_KEY or OPENAI_API_KEY is required for image parsing")
    api_url = os.environ.get("LLM_API_URL", "https://api.openai.com/v1/chat/completions")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    prompt = (
        "Extract weight-management daily records from this image. "
        "Return strict JSON only: {\"rows\":[{\"date\":\"YYYY-MM-DD\",\"weightKg\":72.4,"
        "\"foodText\":\"\",\"exerciseCalories\":0,\"sleepHours\":7,\"note\":\"\"}]}."
    )
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_data}"}},
            ],
        }],
        "temperature": 0,
    }
    request = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise RuntimeError(f"image model request failed: {exc}") from exc
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("image model did not return valid JSON") from exc
    return parsed.get("rows", [])


def create_server(port: int, database_url: str = DEFAULT_DATABASE_URL, host: str = "0.0.0.0") -> ThreadingHTTPServer:
    handler = type("ConfiguredBetweenPointsHandler", (BetweenPointsHandler,), {"repo": PostgresRepository(database_url)})
    return ThreadingHTTPServer((host, port), handler)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))
    args = parser.parse_args()
    server = create_server(args.port, args.database_url, args.host)
    print(f"Between Points running at http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
