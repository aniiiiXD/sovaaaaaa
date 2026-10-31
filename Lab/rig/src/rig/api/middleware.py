from uuid import uuid4

from starlette.responses import JSONResponse


class RequestBoundary:
    """Bound request bodies even without Content-Length, and attach server-generated IDs."""

    def __init__(self, app, max_body_bytes: int):
        self.app, self.max_body_bytes = app, max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id

        async def with_id(message):
            if message["type"] == "http.response.start":
                headers = [(key, value) for key, value in message.get("headers", [])
                           if key.lower() != b"x-rig-request-id"]
                message["headers"] = [*headers,
                                      (b"x-rig-request-id", request_id.encode())]
            await send(message)

        body = bytearray()
        while True:
            event = await receive()
            if event["type"] == "http.disconnect":
                return
            body.extend(event.get("body", b""))
            if len(body) > self.max_body_bytes:
                response = JSONResponse(status_code=413, content={
                    "error": {"code": "body_too_large", "message": "Request body exceeds limit",
                              "request_id": request_id}})
                return await response(scope, receive, with_id)
            if not event.get("more_body", False):
                break
        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, with_id)
