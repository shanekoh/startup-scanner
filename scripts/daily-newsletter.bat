@echo off
REM Daily newsletter generation - runs at 9am via Task Scheduler
REM Requires: Next.js dev server running on localhost:3000, Claude CLI installed

cd /d C:\Users\ksx19\startup-scanner
node scripts\daily-newsletter.mjs >> scripts\newsletter.log 2>&1
