using System;using System.IO;using System.Diagnostics;
class MutsumiClientLauncher {
 [STAThread]static void Main(){
  string root=AppDomain.CurrentDomain.BaseDirectory;
  string ps=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
  try{Process.Start(new ProcessStartInfo(ps,"-NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File \""+Path.Combine(root,"Launch-Client.ps1")+"\" -InstallRoot \""+root.TrimEnd('\\')+"\""){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden});}
  catch{Process.Start(new ProcessStartInfo("explorer.exe",@"shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App"){UseShellExecute=true});}
 }
}
