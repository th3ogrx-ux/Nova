#!/usr/bin/env bash
# Attend la fin du rendu 3D (le relance une fois s'il s'est arrêté), puis assemble la vidéo finale.
cd "$(dirname "$0")/.."
S=/tmp/claude-0/-home-user-Nova/6b5dda2c-c3cb-5898-8c00-c41207ed672f/scratchpad
while pgrep -f "scenes/commerces.py" > /dev/null; do sleep 20; done
n=$(ls rendu-tmp/f?????.png 2>/dev/null | wc -l)
if [ "$n" -lt 660 ]; then
  echo "relance du rendu ($n/660)"; outils/blender-bg.sh scenes/commerces.py --frames 0-659 --out rendu-tmp/f --res 540x960 --samples 10 --coches 6.4,8.22,10.28,12.17,14.13 > rendu-tmp/rendu3d-suite.log 2>&1
fi
n=$(ls rendu-tmp/f?????.png | wc -l); echo "images 3D : $n"
ffmpeg -y -loglevel error -framerate 30 -i rendu-tmp/f%05d.png -framerate 30 -i rendu-tmp/o%05d.png -i $S/son-co/audio.wav \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos,unsharp=5:5:0.5[b];[b][1:v]overlay,format=yuv420p[v]" \
  -map "[v]" -map 2:a -c:v libx264 -crf 18 -preset medium -r 30 -c:a aac -b:a 192k -ar 44100 -movflags +faststart -t 22 export/commerces-01.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames -show_entries format=duration,size -of default=nw=1 export/commerces-01.mp4
echo FINI
