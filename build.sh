#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
engine=common-engine-inspection/common-engine
cc -O2 -shared -fPIC -o single2000/libswe.so "$engine"/research/swiss/*.c -lm
python3 regenerate.py "$engine" "$engine/data" single2000/libswe.so
cp "$engine/data/stations_2000_2050.json" "$engine/data/stations.json"
python3 single2000/calculate-eclipses.py
node single2000/build.mjs
node smoke.mjs single2000/index.html
sha256sum -c EXPECTED_SHA256.txt
