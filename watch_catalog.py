#!/usr/bin/env python3
"""Старое имя. Запускай: ЗАПУСК_мониторинг_каталога.py"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().with_name("ЗАПУСК_мониторинг_каталога.py")

print(
    "Файл переименован.\n"
    f"  Запускай: {TARGET.name}\n"
    "  Или двойной клик: ЗАПУСК_мониторинг_каталога.bat\n",
    flush=True,
)
sys.argv[0] = str(TARGET)
runpy.run_path(str(TARGET), run_name="__main__")
