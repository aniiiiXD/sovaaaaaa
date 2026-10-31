class RigError(Exception):
    status_code = 400
    code = "invalid_request"


class NotFound(RigError):
    status_code = 404
    code = "not_found"


class Conflict(RigError):
    status_code = 409
    code = "conflict"


class Unavailable(RigError):
    status_code = 503
    code = "unavailable"


class Cancelled(RigError):
    code = "cancelled"
