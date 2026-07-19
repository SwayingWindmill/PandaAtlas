$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$validator = Join-Path $root "scripts\curation\validate_panda_curation.py"

python $validator
exit $LASTEXITCODE
