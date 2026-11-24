#!/usr/bin/env bash
# Lance un script Blender sans interface (équivalent de "blender --background --python script.py").
# Usage : outils/blender-bg.sh scenes/mon_script.py [arguments]
cd "$(dirname "$0")/.." && exec outils/venv/bin/python "$@"
