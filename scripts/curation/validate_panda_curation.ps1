$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$curationDir = Join-Path $root "data\curation\pandas"

$sourcesPath = Join-Path $curationDir "sources.csv"
$pandasPath = Join-Path $curationDir "pandas.csv"
$eventsPath = Join-Path $curationDir "events.csv"

$errors = New-Object System.Collections.Generic.List[string]

foreach ($path in @($sourcesPath, $pandasPath, $eventsPath)) {
    if (-not (Test-Path $path)) {
        $errors.Add("missing required curation file: $path")
    }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}

$sources = Import-Csv $sourcesPath
$pandas = Import-Csv $pandasPath
$events = Import-Csv $eventsPath

$sourceIds = @{}
foreach ($source in $sources) {
    if ($sourceIds.ContainsKey($source.source_id)) {
        $errors.Add("duplicate source_id in sources.csv: $($source.source_id)")
    }
    $sourceIds[$source.source_id] = $true
}

$slugs = @{}
foreach ($panda in $pandas) {
    if ($slugs.ContainsKey($panda.slug)) {
        $errors.Add("duplicate slug in pandas.csv: $($panda.slug)")
    }
    $slugs[$panda.slug] = $true
}

$validGenders = @("male", "female", "unknown", "")
$validStatuses = @("alive", "deceased", "unknown", "")
$validPrecisions = @("day", "month", "year", "year_text", "age_text", "unknown", "")
$validEvidence = @("verified", "partial", "needs_primary_source")
$validReview = @("draft", "reviewed", "approved", "rejected")

function Split-Ids([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return @()
    }

    return $value.Split(";") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

function Test-IsoDate([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $true
    }

    try {
        [DateTime]::ParseExact($value, "yyyy-MM-dd", $null) | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

foreach ($panda in $pandas) {
    $label = "pandas.csv[$($panda.slug)]"

    if (-not ($validGenders -contains $panda.gender)) {
        $errors.Add("$label invalid gender '$($panda.gender)'")
    }

    if (-not ($validStatuses -contains $panda.status)) {
        $errors.Add("$label invalid status '$($panda.status)'")
    }

    if (-not ($validPrecisions -contains $panda.birth_date_precision)) {
        $errors.Add("$label invalid birth_date_precision '$($panda.birth_date_precision)'")
    }

    if (-not ($validEvidence -contains $panda.evidence_status)) {
        $errors.Add("$label invalid evidence_status '$($panda.evidence_status)'")
    }

    if (-not ($validReview -contains $panda.review_status)) {
        $errors.Add("$label invalid review_status '$($panda.review_status)'")
    }

    if (-not (Test-IsoDate $panda.birth_date)) {
        $errors.Add("$label invalid birth_date '$($panda.birth_date)'")
    }

    if (-not (Test-IsoDate $panda.death_date)) {
        $errors.Add("$label invalid death_date '$($panda.death_date)'")
    }

    if ($panda.birth_date -and $panda.birth_date_precision -ne "day") {
        $errors.Add("$label birth_date should only be filled when precision is day")
    }

    foreach ($sourceId in (Split-Ids $panda.primary_source_ids)) {
        if (-not $sourceIds.ContainsKey($sourceId)) {
            $errors.Add("$label unknown source_id '$sourceId'")
        }
    }

    foreach ($parentSlug in @($panda.father_slug, $panda.mother_slug)) {
        if ($parentSlug -and -not $slugs.ContainsKey($parentSlug)) {
            $errors.Add("$label parent references missing panda slug '$parentSlug'")
        }
    }
}

$eventIds = @{}
foreach ($event in $events) {
    if ($eventIds.ContainsKey($event.event_id)) {
        $errors.Add("duplicate event_id in events.csv: $($event.event_id)")
    }
    $eventIds[$event.event_id] = $true

    $label = "events.csv[$($event.event_id)]"

    if (-not $slugs.ContainsKey($event.panda_slug)) {
        $errors.Add("$label unknown panda_slug '$($event.panda_slug)'")
    }

    if (-not ($validPrecisions -contains $event.event_date_precision)) {
        $errors.Add("$label invalid event_date_precision '$($event.event_date_precision)'")
    }

    if (-not ($validEvidence -contains $event.evidence_status)) {
        $errors.Add("$label invalid evidence_status '$($event.evidence_status)'")
    }

    if (-not ($validReview -contains $event.review_status)) {
        $errors.Add("$label invalid review_status '$($event.review_status)'")
    }

    if (-not (Test-IsoDate $event.event_date)) {
        $errors.Add("$label invalid event_date '$($event.event_date)'")
    }

    foreach ($sourceId in (Split-Ids $event.source_ids)) {
        if (-not $sourceIds.ContainsKey($sourceId)) {
            $errors.Add("$label unknown source_id '$sourceId'")
        }
    }

    foreach ($slug in (Split-Ids $event.related_slugs)) {
        if (-not $slugs.ContainsKey($slug)) {
            $errors.Add("$label unknown related slug '$slug'")
        }
    }
}

if ($errors.Count -gt 0) {
    foreach ($errorMessage in $errors) {
        Write-Error $errorMessage
    }
    exit 1
}

Write-Output "OK: $($sources.Count) sources, $($pandas.Count) panda rows, $($events.Count) event rows validated"
