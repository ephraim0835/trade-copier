' Trade Copier - Silent Bot Launcher
' Runs start_bot.bat completely in the background without any CMD window popping up.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = Chr(34) & currentDir & "\start_bot.bat" & Chr(34)
WshShell.Run batPath, 0, False
Set WshShell = Nothing
