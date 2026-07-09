# Changelog

## v0.2.1

**Bug Fixes**

- Fix crash on startup when the configured music directory doesn't exist
- Build the client before running tests
  Fixes tests failing unintentionally due to stale or missing client assets.
- Change asset cache header from `immutable` to `must-revalidate`
- Use `type="module"` for client scripts

## v0.2.0

**Features**

- Infinite scroll on the library page
- Resize album art on-demand, with caching
- Persist a SHA1 hash per track for duplicate detection
- Add cache headers for album art and static assets
- Add missing database indices

**Bug Fixes**

- Fix fonts not loading
  Fonts are now self-hosted instead of fetched from a CDN.
- Clamp start and end on range requests
- Restrict request body size

**Internal**

- Enable WAL mode for SQLite
- Throttle `last_active_at` writes
- Batch certain database updates
- Minify bundles on build
- Consolidate asset definitions into a single location

## v0.1.2

**Bug Fixes**

- Auto-create the database file on first start
  Previously required the file to already exist; now only the parent data directory needs to be present, and SQLite creates the file itself.
- Fix a syntax error in `upgrade.sh`

**Internal**

- Add logging for startup (database open, migrations, library scan) and file uploads
  Failures and skip reasons that used to be silent or a bare stack trace are now logged.

## v0.1.1

**Features**

- Add update script
  Re-running the installer now alerts the user to upgrade.
- Improve the empty library UI

**Bug Fixes**

- Crash on startup when the database is unavailable
  Fail fast instead of running in a broken state.

**Internal**

- Derive `ECHO_DATABASE_URL` from `ECHO_DATA_DIR` when unset
- Log directory setup at startup

## v0.1.0

**Features**

- Add single installation script  
  It is an interactive script with optional interactive reverse proxy setup (nginx or Caddy) that writes the site config and points it at the app.
- Improve file upload experience   
  Uploads now report progress via a progress bar instead of a full-page redirect.
- Skip already existing files during library scan
  When `fpcalc` is installed, chromaprint used. When that fails, or when `fpcalc` is not installed, SHA1-based comparison is done.

**Bug Fixes**

- Fix missing `WorkingDirectory` in the systemd service created by the install script.  
  This prevented the service from starting. 
- Bind to `127.0.0.1` instead of `localhost` by default  
  Some hosts resolve `localhost` to `::1` only. This caused an issue with reverse proxies.

## v0.0.1

Initial release of Echo.