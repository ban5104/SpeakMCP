@echo off

if not exist "resources\bin" mkdir "resources\bin"

cd speakmcp-rs

cargo build --release

copy target\release\speakmcp-rs.exe ..\resources\bin\speakmcp-rs.exe

cd ..

echo Rust binary built successfully