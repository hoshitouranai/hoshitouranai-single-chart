"""Rebuild the added three-hour samples using the bundled Swiss source."""
import ctypes as c
from datetime import datetime
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / 'data'
SWISS = ROOT / 'swiss'
BODIES = (*range(10), 11, 15)
EPOCH = datetime(2000, 1, 1)

def step(year):
    return (datetime(year, 1, 1) - EPOCH).days * 8

def build(out, library):
    swe = c.CDLL(str(library))
    doubles = c.POINTER(c.c_double)
    swe.swe_set_ephe_path.argtypes = [c.c_char_p]
    swe.swe_set_ephe_path(str(SWISS).encode())
    swe.swe_calc_ut.argtypes = [c.c_double, c.c_int, c.c_int, doubles, c.c_char_p]
    swe.swe_sidtime.argtypes = [c.c_double]
    swe.swe_sidtime.restype = c.c_double
    values = (c.c_double * 6)()
    error = c.create_string_buffer(256)

    def calc(index, body, flag):
        jd = 2451544.125 + index / 8
        result = swe.swe_calc_ut(jd, body, flag | 256, values, error)
        if result < 0 or (body >= 0 and result & 7 != flag):
            raise RuntimeError((index, body, result, error.value))
        return values[0], values[3]

    def scaled(value):
        return round(value * 10_000_000)

    for first, last, label in [(step(1900), 0, '1900_1999'), (step(2051), step(2101), '2051_2100')]:
        stations = [[] for _ in BODIES]
        previous = [None] * len(BODIES)
        with (out / f'ephemeris_{label}_3h.bin').open('wb') as planets, (out / f'earth_orientation_{label}_3h.bin').open('wb') as earth:
            for index in range(first, last + 1):
                row = []
                for i, body in enumerate(BODIES):
                    flag = 2 if body == 15 else 4
                    longitude, speed = calc(index, body, flag)
                    retrograde = speed < 0
                    if previous[i] is None:
                        stations[i].append(int(retrograde))
                    elif previous[i] != retrograde:
                        low, high = 0, 180
                        while high - low > 1:
                            middle = (low + high) // 2
                            _, rate = calc(index - 1 + middle / 180, body, flag)
                            if (rate < 0) == retrograde:
                                high = middle
                            else:
                                low = middle
                        stations[i].append((index - 1 - first) * 180 + high)
                    previous[i] = retrograde
                    row.extend(((scaled(longitude) + 1_800_000_000) % 3_600_000_000 - 1_800_000_000, scaled(speed)))
                planets.write(struct.pack('<' + 'ii' * len(BODIES), *row))
                obliquity, _ = calc(index, -1, 4)
                earth.write(struct.pack('<II', scaled(swe.swe_sidtime(2451544.125 + index / 8) * 15) % 3_600_000_000, scaled(obliquity)))
        (out / f'stations_{label}.json').write_text(json.dumps(stations, separators=(',', ':')) + '\n')

if __name__ == '__main__':
    output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DATA
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        library = Path(tmp) / 'libswe.so'
        subprocess.run(['cc', '-O2', '-fPIC', '-shared', '-o', str(library),
                        *[str(path) for path in sorted(SWISS.glob('*.c'))], '-lm'], check=True)
        build(output, library)
