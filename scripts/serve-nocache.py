"""Static server for playtesting the site's games without stale ES modules.

    python scripts/serve-nocache.py 8765 src/site
"""

import functools
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    root = sys.argv[2] if len(sys.argv) > 2 else "src/site"
    handler = functools.partial(NoCache, directory=root)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
