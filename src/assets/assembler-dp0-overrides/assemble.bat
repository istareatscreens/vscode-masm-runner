@mkdir bin 2>nul
%~dp0JWASM\JWASM.EXE /Zd /coff /Zne /Zg /I %~dp0irvine /Fo"bin\%~1.obj" /Fw"bin\%~1.err" "%~1.asm"
@if %ERRORLEVEL% GEQ 1 goto :eof
%~dp0JWLINK\JWlink.exe format windows pe LIBPATH %~dp0irvine\ LIBRARY %~dp0irvine\Irvine32.lib LIBRARY %~dp0irvine\Kernel32.lib LIBRARY %~dp0irvine\User32.lib file 'bin\%~1.obj' name 'bin\%~1.exe' 
@if %ERRORLEVEL% GEQ 1 goto :eof
@%~dp0FL.exe "bin\%~1.exe"
"bin\%~1.exe"
