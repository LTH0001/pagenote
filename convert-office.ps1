param([string]$InputFile,[string]$OutputFile)
$ErrorActionPreference = 'Stop'
$app = $null
$doc = $null
try {
  $ext = [IO.Path]::GetExtension($InputFile).ToLowerInvariant()
  if ($ext -in @('.doc','.docx')) {
    $app = New-Object -ComObject Word.Application
    $app.Visible = $false
    $app.DisplayAlerts = 0
    $app.AutomationSecurity = 3
    $doc = $app.Documents.Open($InputFile, $false, $true, $false)
    $doc.ExportAsFixedFormat($OutputFile, 17)
  } else {
    $app = New-Object -ComObject PowerPoint.Application
    $app.AutomationSecurity = 3
    $doc = $app.Presentations.Open($InputFile, -1, 0, 0)
    $doc.SaveAs($OutputFile, 32)
  }
  if (!(Test-Path -LiteralPath $OutputFile)) { throw 'Office did not produce a PDF.' }
} finally {
  if ($null -ne $doc) {
    if ($ext -in @('.doc','.docx')) { $doc.Close(0) } else { $doc.Close() }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)
  }
  if ($null -ne $app) {
    # PowerPoint can share an application instance with the user's open decks.
    # Close only the imported presentation, never quit that application.
    if ($ext -in @('.doc','.docx')) { $app.Quit() }
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)
  }
}
