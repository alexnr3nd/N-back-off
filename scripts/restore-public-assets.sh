#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p public
# The archive's original index.html contains remote analytics, CAPTCHA and CDN
# references. Extract only the assets; public/index.html is maintained locally.
unzip -oq dualnback_visual_assets.zip -d public -x index.html

mkdir -p src/assets/icar/matrix src/assets/icar/rotation
cp public/static/media/MX45.b5ffff80acbb6ab09307.jpg src/assets/icar/matrix/MX45.jpg
cp public/static/media/MX46.51104df819dc452b5598.jpg src/assets/icar/matrix/MX46.jpg
cp public/static/media/MX47.06a3b055ad16965c2902.jpg src/assets/icar/matrix/MX47.jpg
cp public/static/media/MX55.45f2739a63408c6de29b.jpg src/assets/icar/matrix/MX55.jpg
cp public/static/media/R3D03.4d144253b68c09ea6141.jpg src/assets/icar/rotation/R3D03.jpg
cp public/static/media/R3D04.e87850ad16e59d4e9bca.jpg src/assets/icar/rotation/R3D04.jpg
cp public/static/media/R3D06.7d20d375b2769cb503a6.jpg src/assets/icar/rotation/R3D06.jpg
cp public/static/media/R3D08.bec0255e5b90bc8394a5.jpg src/assets/icar/rotation/R3D08.jpg

echo "Public visual assets and ICAR source images restored."
