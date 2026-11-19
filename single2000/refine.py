"""Resolve Uranus ingress roots and True Node direction with the bundled Swiss C library."""
import ctypes as c
import json
from pathlib import Path
import sys

swe = c.CDLL(str(Path(__file__).with_name('libswe.so')))
swe.swe_calc_ut.argtypes = [c.c_double, c.c_int, c.c_int, c.POINTER(c.c_double), c.c_char_p]
values, error = (c.c_double * 6)(), c.create_string_buffer(256)

def calc(ms, body):
    flag = swe.swe_calc_ut(ms / 86400000 + 2440587.5, body, 260, values, error)
    if flag < 0 or flag & 7 != 4:
        raise RuntimeError(error.value)
    return values[0], values[3]

def refine(event):
    ms, sign, reverse = event
    boundary = (sign + reverse) * 30
    def offset(t):
        return (calc(t, 7)[0] - boundary + 180) % 360 - 180
    lo, hi = ms - 120000, ms + 120000
    if offset(lo) * offset(hi) >= 0:
        raise ValueError(f'Ingress root not bracketed at {ms}')
    for _ in range(30):
        mid = (lo + hi) / 2
        if (offset(mid) < 0) == bool(reverse):
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2

mode, events = json.load(sys.stdin)
result = [refine(event) for event in events] if mode == 'uranus' else [calc(ms, 11)[1] < 0 for ms in events]
json.dump(result, sys.stdout)
