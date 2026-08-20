using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

class WinHelper {
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc f, IntPtr lp);
    [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);

    static void Main(string[] args) {
        uint targetPid = args.Length > 0 ? uint.Parse(args[0]) : 0;
        bool doMove = args.Length > 1 && args[1] == "move";

        EnumWindows((h, lp) => {
            uint pid = 0;
            GetWindowThreadProcessId(h, out pid);
            if (targetPid == 0 || pid == targetPid) {
                var sb = new StringBuilder(256);
                GetWindowText(h, sb, 256);
                bool vis = IsWindowVisible(h);
                Console.WriteLine("HWND=" + h + " PID=" + pid + " VIS=" + (vis?1:0) + " TITLE=" + sb);
                
                if (doMove && pid == targetPid && h != IntPtr.Zero) {
                    ShowWindow(h, 9);   // SW_RESTORE
                    MoveWindow(h, 50, 50, 1280, 800, true);
                    BringWindowToTop(h);
                    SetForegroundWindow(h);
                    ShowWindow(h, 3);   // SW_MAXIMIZE
                }
            }
            return true;
        }, IntPtr.Zero);
    }
}
