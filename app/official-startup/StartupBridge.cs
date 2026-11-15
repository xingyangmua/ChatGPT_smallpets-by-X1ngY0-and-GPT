// Experimental Windows x64 startup callback. No registration is performed here.
// Only the current user's OpenAI.Codex package can be resumed/modified in release builds.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace WorkPet.OfficialStartup {
public sealed class Policy {
 public string packageFullName;
 public string executablePath;
 public string profilePath;
 public string evidenceDirectory;
 public int port;
}
public static class StartupBridge {
 const string Family = "OpenAI.Codex_2p2nqsd0c76g0";
 const uint Query = 0x1000, VmRead = 0x10, VmWrite = 0x20, VmOperation = 0x8;
 const uint ThreadResume = 0x2, ThreadQuery = 0x800;
 static JavaScriptSerializer Json = new JavaScriptSerializer();
#if SELF_TEST
 static string TestFault;
#endif
 [StructLayout(LayoutKind.Sequential)] struct BasicInfo { public IntPtr exitStatus, peb, affinity, priority, processId, parentId; }
 [StructLayout(LayoutKind.Sequential)] public struct StartupInfo { public int cb; public IntPtr reserved, desktop, title; public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reserved2; public IntPtr reserved3,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] public struct ProcessInfo { public IntPtr process,thread; public uint processId,threadId; }
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int id);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenThread(uint access,bool inherit,int id);
 [DllImport("kernel32.dll")] static extern uint GetProcessIdOfThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr process,int flags,StringBuilder name,ref int length);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern int GetPackageFamilyName(IntPtr process,ref uint length,StringBuilder name);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern int GetPackageFullName(IntPtr process,ref uint length,StringBuilder name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsWow64Process(IntPtr process,out bool wow64);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool ReadProcessMemory(IntPtr process,IntPtr address,byte[] bytes,int size,out IntPtr read);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool WriteProcessMemory(IntPtr process,IntPtr address,byte[] bytes,int size,out IntPtr written);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr process,IntPtr address,UIntPtr size,uint allocation,uint protection);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool VirtualFreeEx(IntPtr process,IntPtr address,UIntPtr size,uint type);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process,int info,out BasicInfo basic,int size,out int returned);
 [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("shell32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern IntPtr CommandLineToArgvW(string command,out int count);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetThreadTimes(IntPtr thread,out long created,out long exited,out long kernel,out long user);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] public static extern bool CreateProcess(string application,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string directory,ref StartupInfo startup,out ProcessInfo process);

 static void Check(bool value) { if(!value) throw new Win32Exception(Marshal.GetLastWin32Error()); }
 static string Image(IntPtr process) { int n=32768;var b=new StringBuilder(n);Check(QueryFullProcessImageName(process,0,b,ref n));return b.ToString(); }
 static string Package(IntPtr process,bool full) { uint n=0;int rc=full?GetPackageFullName(process,ref n,null):GetPackageFamilyName(process,ref n,null);if(rc==15700)return null;if(rc!=122)throw new Win32Exception(rc);var b=new StringBuilder((int)n);rc=full?GetPackageFullName(process,ref n,b):GetPackageFamilyName(process,ref n,b);if(rc!=0)throw new Win32Exception(rc);return b.ToString(); }
 static long Created(IntPtr handle,bool thread) {long created,exited,kernel,user;Check(thread?GetThreadTimes(handle,out created,out exited,out kernel,out user):GetProcessTimes(handle,out created,out exited,out kernel,out user));return created;}
 static bool SameUser(IntPtr process) {IntPtr token;Check(OpenProcessToken(process,8,out token));try{using(var identity=new WindowsIdentity(token))using(var mine=WindowsIdentity.GetCurrent()){return identity.User==mine.User;}}finally{CloseHandle(token);}}
 static bool Allowed(IntPtr process,bool test) {
  if(!SameUser(process))return false;
#if SELF_TEST
  if(test)return Package(process,false)==null&&String.Equals(Image(process),Process.GetCurrentProcess().MainModule.FileName,StringComparison.OrdinalIgnoreCase);
#endif
  return Package(process,false)==Family;
 }
 static byte[] Read(IntPtr process,IntPtr address,int length) {var b=new byte[length];IntPtr read;Check(ReadProcessMemory(process,address,b,length,out read));if(read.ToInt64()!=length)throw new IOException("Short process read");return b;}
 static void Write(IntPtr process,IntPtr address,byte[] b) {IntPtr count;Check(WriteProcessMemory(process,address,b,b.Length,out count));if(count.ToInt64()!=b.Length)throw new IOException("Short process write");}
 static IntPtr Add(IntPtr address,int n) {return new IntPtr(checked(address.ToInt64()+n));}
 static string[] Arguments(string value) {int count;IntPtr pointer=CommandLineToArgvW(value,out count);if(pointer==IntPtr.Zero)throw new Win32Exception();try{var args=new string[count];for(int i=0;i<count;i++)args[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(pointer,i*IntPtr.Size));return args;}finally{LocalFree(pointer);}}
 static string Quote(string value) {var b=new StringBuilder("\"");int slashes=0;foreach(char ch in value){if(ch=='\\'){slashes++;continue;}if(ch=='"'){b.Append('\\',slashes*2+1);b.Append(ch);}else{b.Append('\\',slashes);b.Append(ch);}slashes=0;}b.Append('\\',slashes*2);b.Append('"');return b.ToString();}
 static string Merge(string original,Policy policy) {
  var args=Arguments(original);if(args.Length==0)throw new InvalidDataException("Empty command line");
  foreach(string arg in args) {
   if(arg.StartsWith("--type=",StringComparison.OrdinalIgnoreCase))return null;
   if(arg=="--type"||arg.StartsWith("--remote-debugging",StringComparison.OrdinalIgnoreCase)||arg.StartsWith("--user-data-dir",StringComparison.OrdinalIgnoreCase))return null;
  }
  if(policy.port<9335||policy.port>9345)throw new InvalidDataException("Port outside managed range");
  if(!Path.IsPathRooted(policy.profilePath)||!File.Exists(Path.Combine(policy.profilePath,"Local State")))throw new InvalidDataException("Existing profile required");
  if(policy.profilePath.IndexOf('"')>=0)throw new InvalidDataException("Invalid profile path");
  // Preserve every activation argument byte-for-byte, including URLs and --.
  int end=0;while(end<original.Length&&Char.IsWhiteSpace(original[end]))end++;
  if(end<original.Length&&original[end]=='"'){end=original.IndexOf('"',end+1);if(end<0)throw new InvalidDataException("Unterminated executable");end++;}
  else{while(end<original.Length&&!Char.IsWhiteSpace(original[end]))end++;}
  return original.Substring(0,end)+" --remote-debugging-address=127.0.0.1 --remote-debugging-port="+policy.port+" --user-data-dir="+Quote(policy.profilePath)+original.Substring(end);
 }
 static string Patch(IntPtr process,Policy policy,bool test) {
#if !SELF_TEST && !EXPERIMENTAL_PATCH
  // Real-app patching is available only in an explicitly reviewed experimental
  // build. A normal build remains a pass-through callback with no PEB mutation.
  return "experimental-patch-disabled";
#else
  if(IntPtr.Size!=8)throw new PlatformNotSupportedException("Only Windows x64 is supported");bool wow;Check(IsWow64Process(process,out wow));if(wow)throw new PlatformNotSupportedException("WOW64 target rejected");
  if(!String.Equals(Image(process),Path.GetFullPath(policy.executablePath),StringComparison.OrdinalIgnoreCase))return "non-gui-pass-through";
  if(!test&&Package(process,true)!=policy.packageFullName)return "package-version-pass-through";
  BasicInfo basic;int size;int status=NtQueryInformationProcess(process,0,out basic,Marshal.SizeOf(typeof(BasicInfo)),out size);if(status!=0)throw new IOException("Process metadata query failed");
  // winternl.h x64 layout. This experimental mechanism must be revalidated after OS changes.
  IntPtr parameters=new IntPtr(BitConverter.ToInt64(Read(process,Add(basic.peb,0x20),8),0));
  IntPtr descriptor=Add(parameters,0x70);byte[] old=Read(process,descriptor,16);int length=BitConverter.ToUInt16(old,0);int maximum=BitConverter.ToUInt16(old,2);var buffer=new IntPtr(BitConverter.ToInt64(old,8));
#if SELF_TEST
  byte[] header=Read(process,parameters,8);File.WriteAllText(Path.Combine(policy.evidenceDirectory,"parameter-layout-"+Process.GetCurrentProcess().Id+".json"),Json.Serialize(new {maximumBlockLength=BitConverter.ToUInt32(header,0),blockLength=BitConverter.ToUInt32(header,4),commandLength=length,commandMaximum=maximum,commandOffset=buffer.ToInt64()-parameters.ToInt64()}));
#endif
  if(length<2||length>maximum||length%2!=0||buffer==IntPtr.Zero)throw new InvalidDataException("Unexpected command-line descriptor");
  string original=Encoding.Unicode.GetString(Read(process,buffer,length));string merged=Merge(original,policy);if(merged==null)return "existing-switch-or-child-pass-through";
  byte[] bytes=Encoding.Unicode.GetBytes(merged+"\0");if(bytes.Length>65534)throw new InvalidDataException("Command line too long");
  return RebuildParameters(process,basic.peb,parameters,bytes);
#endif
 }
#if SELF_TEST || EXPERIMENTAL_PATCH
 static string RebuildParameters(IntPtr process,IntPtr peb,IntPtr parameters,byte[] command) {
  // Clone the entire normalized parameter block. A separate CommandLine buffer
  // is invalid before ntdll relocates this block during loader initialization.
  // Layout source: winsiderss/phnt ntrtl.h, Windows 11 x64 (through HeapMemoryTypeMask).
  byte[] prefix=Read(process,parameters,0x450);int length=checked((int)BitConverter.ToUInt32(prefix,4));
  if(length<0x450||length>1024*1024||BitConverter.ToUInt32(prefix,0)!=(uint)length||(BitConverter.ToUInt32(prefix,8)&1)==0)throw new InvalidDataException("Unsupported process parameter layout");
  long originalBase=parameters.ToInt64(),originalEnd=checked(originalBase+length);
  if(BitConverter.ToInt64(prefix,0x40)-originalBase!=0x450||BitConverter.ToInt64(prefix,0x448)!=0)throw new InvalidDataException("Unsupported current-OS parameter extension");
  var unicode=new int[]{0x38,0x50,0x60,0x70,0xb0,0xc0,0xd0,0xe0,0x410,0x420};
  var pointers=new HashSet<int>();foreach(int offset in unicode){int used=BitConverter.ToUInt16(prefix,offset),max=BitConverter.ToUInt16(prefix,offset+2);long pointer=BitConverter.ToInt64(prefix,offset+8);if(used>max||(offset!=0xe0&&(used%2!=0||max%2!=0)))throw new InvalidDataException("Invalid parameter string");if(pointer!=0&&(pointer<originalBase+0x450||pointer>originalEnd-max))throw new InvalidDataException("Parameter string is not contained in original block");pointers.Add(offset+8);}
  // Per-drive current directories have ANSI STRING members. Preserve bytes and
  // relocate only an in-block buffer; never dereference an external pointer.
  for(int i=0;i<32;i++)pointers.Add(0x100+24*i);
  foreach(int offset in new int[]{0x80,0x400,0x430}){long pointer=BitConverter.ToInt64(prefix,offset);if(pointer>=originalBase&&pointer<originalEnd)throw new InvalidDataException("External parameter data unexpectedly lies in block");}
  // Do not interpret scalar values or uninitialized structure padding as pointers.
  // The pointer field table above is fixed to the checked 0x450 layout; the only
  // newer extension (AttributeList at 0x448) must remain zero for this prototype.
  byte[] original=Read(process,parameters,length);int append=checked((length+7)&~7);int total=checked(append+command.Length);var updated=new byte[total];Array.Copy(original,updated,length);Array.Copy(command,0,updated,append,command.Length);
  IntPtr allocation=VirtualAllocEx(process,IntPtr.Zero,new UIntPtr((uint)total),0x3000,4);if(allocation==IntPtr.Zero)throw new Win32Exception();bool keep=false;
  try{foreach(int offset in pointers){long pointer=BitConverter.ToInt64(updated,offset);if(pointer>=originalBase&&pointer<=originalEnd)Array.Copy(BitConverter.GetBytes(checked(allocation.ToInt64()+pointer-originalBase)),0,updated,offset,8);}
   Array.Copy(BitConverter.GetBytes((uint)total),0,updated,0,4);Array.Copy(BitConverter.GetBytes((uint)total),0,updated,4,4);Array.Copy(BitConverter.GetBytes((ushort)(command.Length-2)),0,updated,0x70,2);Array.Copy(BitConverter.GetBytes((ushort)command.Length),0,updated,0x72,2);Array.Copy(BitConverter.GetBytes(allocation.ToInt64()+append),0,updated,0x78,8);
   Write(process,allocation,updated);if(!Equal(Read(process,allocation,total),updated))throw new IOException("Rebuilt parameter verification failed");
#if SELF_TEST
   if(TestFault=="after-copy")throw new IOException("Injected pre-commit failure");
#endif
   IntPtr field=Add(peb,0x20);var next=BitConverter.GetBytes(allocation.ToInt64());var old=BitConverter.GetBytes(originalBase);
   try{keep=true;Write(process,field,next);if(!Equal(Read(process,field,8),next))throw new IOException("Parameter pointer commit failed");
#if SELF_TEST
    if(TestFault=="after-commit")throw new IOException("Injected post-commit failure");
#endif
   }catch{try{Write(process,field,old);keep=!Equal(Read(process,field,8),old);}catch{keep=true;}throw;}
   return "parameter-block-rebuilt";
  }finally{if(!keep)VirtualFreeEx(process,allocation,UIntPtr.Zero,0x8000);}
 }
#endif
 static bool Equal(byte[] first,byte[] second){if(first.Length!=second.Length)return false;for(int i=0;i<first.Length;i++)if(first[i]!=second[i])return false;return true;}
 static Dictionary<string,string> Parse(string[] args) {var d=new Dictionary<string,string>();for(int i=0;i<args.Length;i++){string key=args[i];if(key=="-p"||key=="-tid"||key=="--config"||key=="--event"||key=="--ready"||key=="--created"||key=="--thread-created"||key=="--callback-pid"||key=="--callback-created"||key=="--fault") {if(++i>=args.Length)throw new ArgumentException("Missing value");d[key]=args[i];}else d[key]="true";}return d;}
 static string Value(Dictionary<string,string> args,string key) {string value;if(!args.TryGetValue(key,out value))throw new ArgumentException("Missing "+key);return value;}
 static void Evidence(Policy policy,string outcome,string error) {try{if(policy==null||!Directory.Exists(policy.evidenceDirectory))return;var report=new Dictionary<string,object>{{"at",DateTime.UtcNow.ToString("o")},{"outcome",outcome},{"error",error}};File.WriteAllText(Path.Combine(policy.evidenceDirectory,"callback-"+Process.GetCurrentProcess().Id+".json"),Json.Serialize(report));}catch{}}
 static void CallbackDiagnostic(string kind,string stage,string outcome,string errorType) {
  // This fixed, already-existing installation data directory does not depend on
  // policy parsing. Never create directories or record arguments/profile paths.
  try{using(var self=Process.GetCurrentProcess()){var parent=Directory.GetParent(Path.GetDirectoryName(self.MainModule.FileName));if(parent==null)return;string folder=Path.Combine(parent.FullName,"data","official-startup");if(!Directory.Exists(folder))return;DateTime created=self.StartTime.ToUniversalTime();var report=new Dictionary<string,object>{{"at",DateTime.UtcNow.ToString("o")},{"helperPid",self.Id},{"helperCreatedUtc",created.ToString("o")},{"event",kind},{"stage",stage},{"outcome",outcome},{"errorType",errorType}};File.WriteAllText(Path.Combine(folder,"startup-callback-"+self.Id+"-"+created.Ticks+"-"+kind+".json"),Json.Serialize(report));}}catch{}
 }
 static Process Guard(Dictionary<string,string> args,long created,long threadCreated,string eventName,string readyName,bool test) {
  string command="--watchdog -p "+Value(args,"-p")+" -tid "+Value(args,"-tid")+" --created "+created+" --thread-created "+threadCreated+" --event "+Quote(eventName)+" --ready "+Quote(readyName)+" --callback-pid "+Process.GetCurrentProcess().Id+" --callback-created "+Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks;
#if SELF_TEST
  if(test)command+=" --test";
#endif
  var start=new ProcessStartInfo(Process.GetCurrentProcess().MainModule.FileName,command){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};return Process.Start(start);
 }
 static int Watchdog(Dictionary<string,string> args,bool test) {
  IntPtr process=IntPtr.Zero,thread=IntPtr.Zero;try{process=OpenProcess(Query,false,Int32.Parse(Value(args,"-p")));thread=OpenThread(ThreadQuery|ThreadResume,false,Int32.Parse(Value(args,"-tid")));if(process==IntPtr.Zero||thread==IntPtr.Zero)return 2;
   if(GetProcessIdOfThread(thread)!=Int32.Parse(Value(args,"-p"))||!Allowed(process,test)||Created(process,false)!=Int64.Parse(Value(args,"--created"))||Created(thread,true)!=Int64.Parse(Value(args,"--thread-created")))return 3;
   using(var done=new EventWaitHandle(false,EventResetMode.ManualReset,Value(args,"--event")))using(var ready=new EventWaitHandle(false,EventResetMode.ManualReset,Value(args,"--ready"))){ready.Set();if(!done.WaitOne(3000)){
    // End only this exact helper before resuming: it must never modify a running target later.
    try{using(var callback=Process.GetProcessById(Int32.Parse(Value(args,"--callback-pid")))){if(callback.StartTime.ToUniversalTime().Ticks==Int64.Parse(Value(args,"--callback-created"))&&String.Equals(callback.MainModule.FileName,Process.GetCurrentProcess().MainModule.FileName,StringComparison.OrdinalIgnoreCase)){callback.Kill();if(!callback.WaitForExit(1000))return 6;}}}catch(ArgumentException){}catch(InvalidOperationException){}
    ResumeThread(thread);
   }}return 0;
  }catch{return 4;}finally{if(thread!=IntPtr.Zero)CloseHandle(thread);if(process!=IntPtr.Zero)CloseHandle(process);}
 }
 static int Callback(Dictionary<string,string> args,bool test) {
  CallbackDiagnostic("entry","callback",null,null);
  IntPtr process=IntPtr.Zero,memory=IntPtr.Zero,thread=IntPtr.Zero;Policy policy=null;EventWaitHandle done=null,ready=null;Process guard=null;bool trusted=false,soleInitial=false;string outcome="failed",error=null,errorType=null,stage="arguments";
  try{int pid=Int32.Parse(Value(args,"-p")),tid=Int32.Parse(Value(args,"-tid"));stage="target-handles";process=OpenProcess(Query,false,pid);thread=OpenThread(ThreadQuery|ThreadResume,false,tid);
   if(process==IntPtr.Zero||thread==IntPtr.Zero)throw new Win32Exception();stage="target-identity";if(GetProcessIdOfThread(thread)!=pid||!Allowed(process,test))throw new InvalidOperationException("Process/thread identity rejected");
   // Resume only a unique oldest suspended initial thread. Loader worker threads
   // make patching unsupported, but must not leave a genuine activation paused.
   stage="initial-thread";using(var target=Process.GetProcessById(pid)){target.Refresh();ProcessThread initial=null;long initialCreated=Created(thread,true);foreach(ProcessThread candidate in target.Threads){if(candidate.Id==tid){initial=candidate;continue;}IntPtr other=OpenThread(ThreadQuery,false,candidate.Id);if(other==IntPtr.Zero)throw new Win32Exception();try{if(Created(other,true)<=initialCreated)throw new InvalidOperationException("Target thread is not uniquely initial");}finally{CloseHandle(other);}}if(initial==null||initial.ThreadState!=System.Diagnostics.ThreadState.Wait||initial.WaitReason!=ThreadWaitReason.Suspended||DateTime.UtcNow-DateTime.FromFileTimeUtc(Created(process,false))>TimeSpan.FromSeconds(15))throw new InvalidOperationException("Target is not a newly suspended initial thread");soleInitial=target.Threads.Count==1;}trusted=true;
   stage="watchdog";string name="Local\\WorkPetStartup-"+Guid.NewGuid().ToString("N");done=new EventWaitHandle(false,EventResetMode.ManualReset,name);ready=new EventWaitHandle(false,EventResetMode.ManualReset,name+"-ready");guard=Guard(args,Created(process,false),Created(thread,true),name,name+"-ready",test);if(guard==null||!ready.WaitOne(1000))throw new IOException("Watchdog readiness was not confirmed");
#if SELF_TEST
   string fault;if(args.TryGetValue("--fault",out fault)){TestFault=fault;if(fault=="exception")throw new IOException("Injected callback failure");if(fault=="crash")Process.GetCurrentProcess().Kill();if(fault=="timeout"){Thread.Sleep(5000);outcome="timeout-no-patch";return 5;}}
#endif
   stage="policy";policy=Json.Deserialize<Policy>(File.ReadAllText(Value(args,"--config")));if(!soleInitial){outcome="loader-worker-pass-through";return 0;}stage="write-handle";memory=OpenProcess(Query|VmRead|VmWrite|VmOperation,false,pid);if(memory==IntPtr.Zero)throw new Win32Exception();if(Created(memory,false)!=Created(process,false))throw new InvalidOperationException("Process identity changed");stage="patch";outcome=Patch(memory,policy,test);return 0;
  }catch(Exception e){errorType=e.GetType().Name;error=errorType+": "+e.Message;return 1;}
  finally{if(trusted&&thread!=IntPtr.Zero){uint resumed=ResumeThread(thread);if(resumed!=UInt32.MaxValue&&done!=null)done.Set();}Evidence(policy,outcome,error);CallbackDiagnostic("final",stage,outcome,errorType);if(guard!=null)guard.Dispose();if(done!=null)done.Dispose();if(ready!=null)ready.Dispose();if(thread!=IntPtr.Zero)CloseHandle(thread);if(memory!=IntPtr.Zero)CloseHandle(memory);if(process!=IntPtr.Zero)CloseHandle(process);}
 }
 public static int Main(string[] args) {bool parsedArguments=false;try{
#if SELF_TEST
  File.WriteAllText(Path.Combine(Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName),"entry-"+Process.GetCurrentProcess().Id+".json"),Json.Serialize(args));
  int probe=Array.IndexOf(args,"--probe");if(probe>=0){File.WriteAllText(args[probe+1],Json.Serialize(new {pid=Process.GetCurrentProcess().Id,args=Environment.GetCommandLineArgs(),cwd=Environment.CurrentDirectory,sentinel=Environment.GetEnvironmentVariable("WORKPET_STARTUP_SENTINEL")}));return 0;}
#endif
  var parsed=Parse(args);parsedArguments=true;bool test=false;
#if SELF_TEST
  test=parsed.ContainsKey("--test");
#endif
  if(parsed.ContainsKey("--watchdog"))return Watchdog(parsed,test);if(parsed.ContainsKey("--callback"))return Callback(parsed,test);return 64;
 }catch(Exception e){if(!parsedArguments&&args.Length>0&&args[0]=="--callback"&&Array.IndexOf(args,"--watchdog")<0){CallbackDiagnostic("entry","parse",null,null);CallbackDiagnostic("final","parse","failed",e.GetType().Name);}return 65;}}
}
}
