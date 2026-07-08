# Changelog

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