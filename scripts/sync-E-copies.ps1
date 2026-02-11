$source = "C:\Users\erich\Heady\E"
$destDesktop = "$env:USERPROFILE\Desktop\E"
$destRepos = "C:\Users\erich\Heady\repos\E"

# Create destinations if missing
if (!(Test-Path $destDesk)) { New-Item -ItemType Directory -Path $destDesk | Out-Null }
if (!(Test-Path $destRepos)) { New-Item -ItemType Directory -Path $destRepos | Out-Null }

# Sync to desktop and repos (mirror, but ignore junk)
robocopy $source $destDesk /MIR /XD node_modules .git /XF *.log
robocopy $source $destRepos /MIR /XD node_modules .git /XF *.log

Write-Host "E folder synced to Desktop and repos."
