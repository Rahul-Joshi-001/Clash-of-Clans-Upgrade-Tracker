# ClashTrack local SQLite backend

## What changed
- Replaced Oracle DB access with SQLite.
- Database is created automatically at `Backend/data/clashtrack.sqlite` on first launch.
- Game reference catalog is loaded from `scripts/game-reference-export.json` on first launch.
- No Oracle client, Oracle server, cloud database, or `Backend/.env` is required.
- The frontend is not included in this archive and should remain unchanged.

## Setup
1. Replace your existing `Backend` folder with this folder's contents (keep a backup first).
2. Put `ClashTrack-Run.bat` in the project root beside `Backend` and `frontend`.
3. Install Node.js LTS if it is not already installed.
4. Double-click `ClashTrack-Run.bat`.
5. The launcher installs dependencies when needed, then opens backend and frontend terminals.

The first run needs internet access to install npm packages. SQLite itself does not require a separate server install.
Local user accounts and village data stay on that PC. They are not shared across PCs.

## Local database
The SQLite file and generated JWT secret are created under `Backend/data/`. Do not commit that directory to GitHub.
