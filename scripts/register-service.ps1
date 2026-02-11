param(
    [string]$ServiceName,
    [string]$Path
)

New-Service -Name $ServiceName -BinaryPathName "$Path\HeadyBrowser.exe" -DisplayName "HeadyBrowser"
