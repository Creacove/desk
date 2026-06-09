param(
  [string]$EnvFile = ".env.local",
  [string]$FallbackEnvFile = ".env.example"
)

$ErrorActionPreference = "Stop"

function Read-DotEnvFile {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $values
  }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#") -or -not $trimmed.Contains("=")) {
      continue
    }

    $name, $value = $trimmed.Split("=", 2)
    $values[$name.Trim()] = $value.Trim().Trim('"').Trim("'")
  }

  return $values
}

$localValues = Read-DotEnvFile -Path $EnvFile
$fallbackValues = Read-DotEnvFile -Path $FallbackEnvFile

function Get-EnvValue {
  param([string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name)
  if ($processValue) {
    return $processValue
  }

  if ($localValues.ContainsKey($Name) -and $localValues[$Name]) {
    return $localValues[$Name]
  }

  if ($fallbackValues.ContainsKey($Name) -and $fallbackValues[$Name]) {
    return $fallbackValues[$Name]
  }

  return ""
}

$projectRef = Get-EnvValue -Name "SUPABASE_PROJECT_REF"
$resendApiKey = Get-EnvValue -Name "RESEND_API_KEY"
$serviceRoleKey = Get-EnvValue -Name "SUPABASE_SERVICE_ROLE_KEY"
$fromEmail = Get-EnvValue -Name "SPLIT_CONFIRMATION_FROM_EMAIL"

if (-not $projectRef) {
  throw "SUPABASE_PROJECT_REF is required in environment, $EnvFile, or $FallbackEnvFile."
}

if (-not $resendApiKey) {
  throw "RESEND_API_KEY is required in environment, $EnvFile, or $FallbackEnvFile."
}

if (-not $serviceRoleKey) {
  throw "SUPABASE_SERVICE_ROLE_KEY is required in environment, $EnvFile, or $FallbackEnvFile."
}

if (-not $fromEmail) {
  $fromEmail = "Ordersounds <splits@ordersounds.com>"
}

supabase secrets set `
  "RESEND_API_KEY=$resendApiKey" `
  "SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey" `
  "SPLIT_CONFIRMATION_FROM_EMAIL=$fromEmail" `
  --project-ref "$projectRef"
