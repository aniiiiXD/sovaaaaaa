import argparse
import logging

from rig.config import Settings
from rig.container import Container
from rig.jobs.worker import run_worker


def main() -> None:
    parser = argparse.ArgumentParser(prog="rig", description="Sova's modular model lab")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("api", help="Start the control and inference API; no worker is started")
    worker = commands.add_parser("worker", help="Execute queued jobs when explicitly enabled")
    worker.add_argument("--once", action="store_true", help="Handle at most one queued job")
    args = parser.parse_args()
    settings = Settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    if args.command == "api":
        import uvicorn
        uvicorn.run("rig.api.app:create_app", factory=True, host=settings.host,
                    port=settings.port, workers=1)
    else:
        if not settings.execution_enabled:
            parser.error("Worker execution is disabled; set RIG_EXECUTION_ENABLED=true to enable")
        container = Container(settings)
        container.initialize()
        run_worker(container, once=args.once)


if __name__ == "__main__":
    main()
