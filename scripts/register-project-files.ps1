param([string]$ExecutablePath = (Join-Path $PSScriptRoot 'pagenote.exe'))
$ErrorActionPreference = 'Stop'
$exe = (Resolve-Path -LiteralPath $ExecutablePath).Path
if ([IO.Path]::GetFileName($exe) -ne 'pagenote.exe') { throw 'Choose pagenote.exe.' }
$classes = 'HKCU:\Software\Classes'
$programId = 'pagenote.Project'
$command = '"' + $exe + '" "%1"'
foreach ($key in @("$classes\.pagenote", "$classes\.pagenote\OpenWithProgids", "$classes\$programId", "$classes\$programId\DefaultIcon", "$classes\$programId\shell\open\command", "$classes\Applications\pagenote.exe\shell\open\command", "$classes\Applications\pagenote.exe\SupportedTypes")) {
    New-Item -Path $key -Force | Out-Null
}
Set-Item -Path "$classes\.pagenote" -Value $programId
New-ItemProperty -Path "$classes\.pagenote\OpenWithProgids" -Name $programId -Value '' -PropertyType String -Force | Out-Null
Set-Item -Path "$classes\$programId" -Value 'pagenote Project'
Set-Item -Path "$classes\$programId\DefaultIcon" -Value ('"' + $exe + '",0')
Set-Item -Path "$classes\$programId\shell\open\command" -Value $command
Set-Item -Path "$classes\Applications\pagenote.exe\shell\open\command" -Value $command
New-ItemProperty -Path "$classes\Applications\pagenote.exe\SupportedTypes" -Name '.pagenote' -Value '' -PropertyType String -Force | Out-Null
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class PagenoteAssociation { [DllImport("shell32.dll")] public static extern void SHChangeNotify(uint e, uint f, IntPtr a, IntPtr b); }'
[PagenoteAssociation]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Output 'pagenote project files registered for the current user. Existing Windows default-app choices are preserved.'
