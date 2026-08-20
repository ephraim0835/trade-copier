
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder sb, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
}
"@

function Get-WindowByProcessId($pid) {
    $result = $null
    $enum = [Win32+EnumWindowsProc]{
        param($hwnd, $lp)
        $sb = New-Object System.Text.StringBuilder 256
        [Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
        if ([Win32]::IsWindowVisible($hwnd) -and $sb.Length -gt 0) {
            $proc = (Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -eq $hwnd })
            if ($proc -and $proc.Id -eq $pid) {
                $script:result = $hwnd
                return $false
            }
        }
        return $true
    }
    [Win32]::EnumWindows($enum, [IntPtr]::Zero) | Out-Null
    return $result
}

# Find terminal64 process
$mt5 = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
if (-not $mt5) {
    Write-Host "MT5 not running, launching..."
    Start-Process "C:\Program Files\MetaTrader 5\terminal64.exe"
    Start-Sleep -Seconds 20
    $mt5 = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
}

if ($mt5) {
    Write-Host "MT5 PID: $($mt5.Id)"
    $hwnd = $mt5.MainWindowHandle
    if ($hwnd -eq 0) {
        Write-Host "Waiting for MT5 window handle..."
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 2
            $mt5 = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
            if ($mt5 -and $mt5.MainWindowHandle -ne 0) {
                $hwnd = $mt5.MainWindowHandle
                break
            }
        }
    }
    
    if ($hwnd -ne 0) {
        Write-Host "Found MT5 window handle: $hwnd"
        [Win32]::ShowWindow($hwnd, 9)  # SW_RESTORE
        Start-Sleep -Milliseconds 500
        [Win32]::SetForegroundWindow($hwnd)
        Start-Sleep -Milliseconds 1000
        Write-Host "MT5 brought to foreground. Window title: $($mt5.MainWindowTitle)"
        
        # Use SendKeys to open a chart (Ctrl+N is Navigator, F4 is MetaEditor)
        Add-Type -AssemblyName System.Windows.Forms
        
        # Open new chart: File menu
        Write-Host "Opening a EURUSD chart..."
        [System.Windows.Forms.SendKeys]::SendWait("%F")  # Alt+F for File menu
        Start-Sleep -Milliseconds 800
        [System.Windows.Forms.SendKeys]::SendWait("N")   # New Chart
        Start-Sleep -Milliseconds 1500
        # Type EURUSD and Enter in symbol search
        [System.Windows.Forms.SendKeys]::SendWait("EURUSD")
        Start-Sleep -Milliseconds 1000
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 2000
        Write-Host "Chart should be open."
    } else {
        Write-Host "ERROR: Could not get MT5 window handle after waiting."
    }
} else {
    Write-Host "ERROR: terminal64 process not found."
}
