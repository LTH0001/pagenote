param([string]$Document)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;using System.Runtime.InteropServices;
public class WordKeyboardTest {
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd,uint flags);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@
$app=$null
for($i=0;$i -lt 60;$i++){try{$app=[Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application');break}catch{Start-Sleep -Milliseconds 250}}
if(!$app){throw 'Default app is not an accessible Microsoft Word instance'}
$doc=$null
foreach($candidate in $app.Documents){if([IO.Path]::GetFullPath($candidate.FullName) -eq [IO.Path]::GetFullPath($Document)){$doc=$candidate;break}}
if(!$doc){throw 'Owned test document was not found; no keyboard input sent'}
try {
 $doc.Activate()
 $app.ActiveWindow.Activate()
 $app.Selection.HomeKey(6) | Out-Null
 $app.Selection.TypeText('DELETEPROBE')
 $app.Selection.SetRange(0,11)
 $hwnd=[WordKeyboardTest]::GetAncestor([IntPtr][long]$app.ActiveWindow.Hwnd,2)
 [void][WordKeyboardTest]::SetForegroundWindow($hwnd)
 Start-Sleep -Milliseconds 250
 if([WordKeyboardTest]::GetForegroundWindow() -ne $hwnd){throw 'Test Word window is not foreground; no keyboard input sent'}
 [System.Windows.Forms.SendKeys]::SendWait('{DELETE}')
 Start-Sleep -Milliseconds 300
 if($doc.Content.Text.StartsWith('DELETEPROBE')){throw 'Physical Delete did not remove the selected text'}
 [System.Windows.Forms.SendKeys]::SendWait('^z')
 Start-Sleep -Milliseconds 250
 if(!$doc.Content.Text.StartsWith('DELETEPROBE')){throw 'Physical Undo did not restore deleted text'}
 $app.Selection.SetRange(0,11)
 [System.Windows.Forms.SendKeys]::SendWait('{DELETE}')
 Start-Sleep -Milliseconds 250
 [System.Windows.Forms.SendKeys]::SendWait('^s')
 Start-Sleep -Milliseconds 300
 if(!$doc.Saved){throw 'Physical Ctrl+S did not save'}
 Write-Output 'PASS default Word: physical Delete, Ctrl+Z and Ctrl+S'
} finally {
 $doc.Close(-1)
 [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)
 [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)
}
