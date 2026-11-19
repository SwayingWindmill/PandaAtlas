$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pandaDataDir = Join-Path $root "tools\panda-data"

uv run --isolated --directory $pandaDataDir --frozen panda-data curation validate
exit $LASTEXITCODE
