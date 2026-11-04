@echo off
cd /d "%~dp0"
python -m pip install --only-binary=:all: --require-hashes --target ".capture-deps" -r requirements-capture.txt
if errorlevel 1 pause
