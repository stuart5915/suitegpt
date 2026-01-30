Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "pythonw """ & Replace(WScript.ScriptFullName, "start-client-daemon.vbs", "client-request-daemon.py") & """", 0, False
