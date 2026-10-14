Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WordHostNative {
 [StructLayout(LayoutKind.Sequential)] public struct RECT {public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct MENUBARINFO {public uint size;public RECT rect;public IntPtr menu,submenu;public uint flags;}
 [DllImport("user32.dll")] public static extern bool GetMenuBarInfo(IntPtr h,int id,int item,ref MENUBARINFO info);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 public static int MenuHeight(IntPtr h){var m=new MENUBARINFO();m.size=(uint)Marshal.SizeOf(m);return GetMenuBarInfo(h,-3,0,ref m)?Math.Max(0,m.rect.bottom-m.rect.top):0;}
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
 [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetParent(IntPtr child, IntPtr parent);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h,int index,int value);
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int height,bool repaint);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
 [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("user32.dll")] public static extern bool RedrawWindow(IntPtr h,IntPtr rect,IntPtr region,uint flags);
}
'@
[void][WordHostNative]::SetThreadDpiAwarenessContext([IntPtr](-4))
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference='Stop'
$wordApp=$null;$wordDoc=$null;$wordHandle=[IntPtr]::Zero;$parentHandle=[IntPtr]::Zero
function Reply($cid,$value,$failure=$null){[Console]::Out.WriteLine('PAGE_NOTES_WORD '+(@{cid=$cid;value=$value;error=$failure}|ConvertTo-Json -Depth 8 -Compress));[Console]::Out.Flush()}
try {
 while($null -ne ($line=[Console]::In.ReadLine())){
  $command=$null
  try{
   $command=$line|ConvertFrom-Json
   switch($command.action){
    'open' {
     $wordApp=New-Object -ComObject Word.Application
     $wordApp.DisplayAlerts=-1
     $wordApp.AutomationSecurity=3
     $wordDoc=$wordApp.Documents.Open([string]$command.file,$false,$false,$false)
     $wordApp.Visible=$true
     $wordHandle=[WordHostNative]::GetAncestor([IntPtr][long]$wordApp.ActiveWindow.Hwnd,2)
     $style=[WordHostNative]::GetWindowLong($wordHandle,-16)
     $style=(($style -band 0x7FFFFFFF) -bor 0x40000000) -band (-bnot [int]0x00CF0000)
     [void][WordHostNative]::SetWindowLong($wordHandle,-16,$style)
     $parentHandle=[IntPtr][long]$command.parent
     [void][WordHostNative]::SetParent($wordHandle,$parentHandle)
     $r=$command.rect;[void][WordHostNative]::MoveWindow($wordHandle,$r.x,($r.y+[WordHostNative]::MenuHeight($parentHandle)),$r.width,$r.height,$true)
     [void][WordHostNative]::ShowWindow($wordHandle,5)
     [void][WordHostNative]::SetWindowPos($wordHandle,[IntPtr]::Zero,0,0,0,0,0x0043)
     [void][WordHostNative]::BringWindowToTop($wordHandle)
     Reply $command.cid @{handle=$wordHandle.ToInt64().ToString();parent=[WordHostNative]::GetParent($wordHandle).ToInt64().ToString();text=$wordDoc.Content.Text;pages=$wordDoc.ComputeStatistics(2)}
    }
    'resize' {$r=$command.rect;[void][WordHostNative]::MoveWindow($wordHandle,$r.x,($r.y+[WordHostNative]::MenuHeight($parentHandle)),$r.width,$r.height,$true);[void][WordHostNative]::SetWindowPos($wordHandle,[IntPtr]::Zero,0,0,0,0,0x0043);Reply $command.cid @{ok=$true}}
    'save' {$wordDoc.Save();Reply $command.cid @{saved=$true;text=$wordDoc.Content.Text}}
    'command' {if(!@('Undo','Redo','Cut','Copy','Paste','SelectAll').Contains([string]$command.command)){throw '不支持的编辑命令'};$wordApp.CommandBars.ExecuteMso([string]$command.command);Reply $command.cid @{ok=$true}}
    'export' {$wordDoc.Save();$wordDoc.ExportAsFixedFormat([string]$command.file,17);Reply $command.cid @{saved=$true;source=$wordDoc.FullName}}
    'read' {Reply $command.cid @{text=$wordDoc.Content.Text;rangeStart=$wordDoc.Content.Start;rangeEnd=$wordDoc.Content.End;saved=$wordDoc.Saved;alive=[WordHostNative]::IsWindow($wordHandle)}}
    'status' {$documentOpen=$false;try{$unused=$wordDoc.Content.Start;$documentOpen=$true}catch{};Reply $command.cid @{alive=([WordHostNative]::IsWindow($wordHandle) -and $documentOpen);handle=$wordHandle.ToInt64().ToString()}}
    'selection' {$r=$wordApp.Selection.Range;Reply $command.cid @{text=$r.Text;start=$r.Start;end=$r.End;page=$r.Information(3)}}
    'visibility' {[void][WordHostNative]::ShowWindow($wordHandle,$(if($command.visible){5}else{0}));if($command.visible){[void][WordHostNative]::BringWindowToTop($wordHandle)};Reply $command.cid @{ok=$true}}
    'screenshot' {
     Add-Type -AssemblyName System.Drawing
     $bounds=New-Object WordHostNative+RECT;[void][WordHostNative]::GetWindowRect($wordHandle,[ref]$bounds);$w=$bounds.right-$bounds.left;$h=$bounds.bottom-$bounds.top
     if($w -lt 1 -or $h -lt 1 -or ([long]$w*$h) -gt 32000000){throw '截图区域无效'}
     $bitmap=New-Object System.Drawing.Bitmap($w,$h);$graphics=[System.Drawing.Graphics]::FromImage($bitmap);$dc=$graphics.GetHdc()
     try{if(![WordHostNative]::PrintWindow($wordHandle,$dc,2)){throw 'Word 截图失败'}}finally{$graphics.ReleaseHdc($dc)}
     try{$bitmap.Save([string]$command.file,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
     Reply $command.cid @{width=$w;height=$h}
    }
    'replace' {
     $search=[string]$command.search
     if($search.Contains([char]7)){throw '选区跨越了表格结构'}
     if($null -ne $command.start){$index=[int]$command.start;$range=$wordDoc.Range($index,$index+$search.Length)}
     else{
      $candidate=$wordDoc.Content.Duplicate;$find=$candidate.Find;$find.ClearFormatting();$find.MatchCase=$true;$find.MatchWholeWord=$false;$find.MatchWildcards=$false;$find.Forward=$true;$find.Wrap=0
      $prefix=$search.Substring(0,[Math]::Min(100,$search.Length)).Replace('^','^^');$range=$null
      while($find.Execute($prefix)){
       $probe=$wordDoc.Range($candidate.Start,[Math]::Min($wordDoc.Content.End,$candidate.Start+$search.Length))
       if($probe.Text -ceq $search){$range=$probe;break}
       $candidate.SetRange($candidate.End,$wordDoc.Content.End)
      }
      if(!$range){throw '没有找到精确匹配的原文'}
     }
     if($range.Text -cne $search){throw 'Word 选区已变化，请重新读取'}
     $range.Text=[string]$command.replacement;$wordDoc.Save();Reply $command.cid @{saved=$true;text=$wordDoc.Content.Text}
    }
    'close' {
     if($command.save){$wordDoc.Save()}
     [void][WordHostNative]::SetParent($wordHandle,[IntPtr]::Zero)
     [void][WordHostNative]::ShowWindow($wordHandle,0)
     $wordDoc.Close(0);$wordApp.Quit();$wordDoc=$null;$wordApp=$null;Reply $command.cid @{closed=$true};exit
    }
    default {throw '不支持的 Word 编辑命令'}
   }
  }catch{Reply $command.cid $null $_.Exception.Message}
 }
}finally{
 if($wordDoc){try{$wordDoc.Save();$wordDoc.Close(0)}catch{}}
 if($wordApp){try{$wordApp.Quit()}catch{}}
}
