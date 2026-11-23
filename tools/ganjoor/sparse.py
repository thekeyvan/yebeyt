"""A cached partial checkout of ganjoor-data, so the thousands of poem files of the curated books
need no one-by-one downloads. Lives in tools/ganjoor/.cache/repo (gitignored)."""
import subprocess
import sys
from pathlib import Path

REPO_URL = "https://github.com/ganjoor/ganjoor-data.git"


def patterns(book_paths):
    """Sparse-checkout patterns: each book's folder, and the poet files that sit above it."""
    wanted = set()
    for path in book_paths:
        slug = path.split("/")[1]
        wanted.update({f"/poets/{slug}/poet.json", f"/poets/{slug}/_cat.json", f"/poets{path}/"})
    return sorted(wanted)


def git(repo, *args, stdin=None):
    done = subprocess.run(["git", "-C", str(repo), *args], input=stdin, text=True,
                          capture_output=True)
    if done.returncode:
        sys.exit(f"git {' '.join(args)} failed: {done.stderr.strip()}")
    return done.stdout


def checkout(repo, sha, book_paths):
    """Make `repo` hold the files of the given books at `sha`; returns the `poets` folder."""
    repo = Path(repo)
    if not (repo / ".git").exists():
        repo.mkdir(parents=True, exist_ok=True)
        git(repo, "init", "-q")
        git(repo, "remote", "add", "origin", REPO_URL)
    probe = subprocess.run(["git", "-C", str(repo), "cat-file", "-e", f"{sha}^{{commit}}"],
                           capture_output=True)
    if probe.returncode:
        git(repo, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", sha)
    git(repo, "sparse-checkout", "set", "--no-cone", "--stdin", stdin="\n".join(patterns(book_paths)) + "\n")
    git(repo, "checkout", "-q", "--detach", sha)
    return repo / "poets"
