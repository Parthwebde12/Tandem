"""Run the outbox worker:  python -m app.worker"""

import logging
import time

from app.services.outbox import process_pending

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")


def main() -> None:
    log = logging.getLogger("opsdesk.worker")
    log.info("outbox worker started")
    try:
        while True:
            if process_pending() == 0:
                time.sleep(2)
    except KeyboardInterrupt:
        log.info("outbox worker stopped")


if __name__ == "__main__":
    main()