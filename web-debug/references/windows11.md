# Windows 11 web-development diagnosis

Use this route for native Windows/PowerShell tooling, PATH/version conflicts, port ownership and Windows/WSL differences. Identify the actual shell and runtime first; do not infer Windows 10 versus 11 from a kernel version beginning with `10.0`.

## Read-only environment report

From PowerShell, replace the skill path with the installed folder:

```powershell
& "SKILL_DIR/scripts/windows.ps1" -ProjectRoot . -Ports 3000,5173 -OutFile work/windows.json
```

The helper records the OS caption/build, PowerShell version, candidate locations of Node/npm/Git/gh/PowerShell/WSL, execution-policy scopes, and processes listening on the selected ports. It does not enumerate process command lines, print environment-variable values, start WSL, kill processes, alter PATH, install tools or change policies/firewall settings. A failed port query reports unknown, not free. Its absolute tool/project paths describe this machine for diagnosis; they are not portable configuration or inputs to reuse on another machine.

Alternatively use `node SKILL_DIR/scripts/debug.mjs windows --project . --ports 3000,5173 --out work/windows.json`. JSON stdout escapes non-ASCII characters to preserve Thai/Unicode through inherited Windows console code pages without changing console settings; the saved file remains UTF-8. Linked output files and overwriting the running script are rejected. Existing output files are replaced through a temporary file.

Use PowerShell 7 or Windows PowerShell 5.1 on Windows. If script execution is blocked, inspect the effective policy and file provenance under the organization's rules; do not automatically set `Bypass`/`Unrestricted`. [Execution-policy reference](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies), [TCP connection reference](https://learn.microsoft.com/en-us/powershell/module/nettcpip/get-nettcpconnection).

## Common failure patterns

| Symptom | Investigation and targeted response |
|---|---|
| Different Node/npm depending on terminal | Compare resolved executable paths and project engines/version-manager settings; refresh the terminal after an authorized install/change |
| npm.ps1 blocked by execution policy | Use the corresponding installed `npm.cmd` where appropriate; this runs npm without changing PowerShell policy |
| EADDRINUSE | Identify the owning PID and task before choosing another configured port or stopping an authorized dev server |
| Permission denied or locked file | Find the owning process, access path and exact operation; avoid broad permission changes or deleting caches indiscriminately |
| Works on Windows, fails on Linux CI | Check import filename case, executable bits, shell assumptions, line endings and platform-specific binaries |
| Slow watchers/build under WSL mounts | Check which OS owns the runtime and repository; avoid mixing Windows and Linux dependency directories |
| Browser cannot reach dev server | Verify bind address, selected port and runtime boundary before changing firewall rules |
| Path/Unicode/space-related failure | Use literal paths and argument arrays; test the actual path instead of rewriting global directory conventions |

Use the project's existing package manager and supported runtime. Do not upgrade Node globally or install a new version manager just to investigate one repository. See [Microsoft's native Node guidance](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows) for setup changes actually required by the task.

## Windows versus WSL

Choose one runtime for the project's commands and keep its dependency installation separate from the other OS. Linux paths and Windows paths are not interchangeable. WSL `localhost` access depends on the current networking configuration; test it rather than assuming a fixed mapping. The Chrome helper talks to a loopback debugging endpoint in its execution environment. A helper inside WSL cannot assume that Windows Chrome is reachable at the same loopback address; for desktop Chrome, prefer running this helper in the Windows environment.

Microsoft recommends keeping files on the same side of the Windows/WSL file-system boundary as the tools for performance. Treat this as a diagnostic consideration, not permission to move the user's repository. Respect the user's workspace-location rules and obtain a concrete approved destination if a move is genuinely necessary. [WSL file-system guidance](https://learn.microsoft.com/en-us/windows/wsl/filesystems).

## Shell and filesystem discipline

Pass executable arguments separately when possible. In PowerShell, use single-quoted literal strings for text containing `$` or backticks, and `-LiteralPath` for filesystem operations. Do not interpolate untrusted page/log content into shell commands. Avoid mixing PowerShell enumeration with cmd.exe deletion/moving. Before an authorized recursive move/delete, verify the resolved source/destination remain inside the intended workspace.

Create hidden background helpers when a visible terminal is not needed. Stop only the process created or positively identified for this task; never kill all Chrome/Node processes. Keep debug artifacts and Chrome profiles under the approved project/work area. Do not enable remote debugging on a public network interface or disable Defender, browser sandboxing or TLS checks to suppress a local tooling problem.
