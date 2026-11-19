import ctypes as c
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

root = Path(__file__).resolve().parent
swe = c.CDLL(str(root / 'libswe.so'))
tz = timezone(timedelta(hours=9))
epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
summary = {}
for solar, name in [(True, 'solar'), (False, 'lunar')]:
    func = swe.swe_sol_eclipse_when_glob if solar else swe.swe_lun_eclipse_when
    func.argtypes = [c.c_double, c.c_int, c.c_int, c.POINTER(c.c_double), c.c_int, c.c_char_p]
    values, error = (c.c_double * 10)(), c.create_string_buffer(256)
    start, end = datetime(2000, 1, 1, tzinfo=tz), datetime(2051, 1, 1, tzinfo=tz)
    jd = (start - timedelta(days=7)).timestamp() / 86400 + 2440587.5
    computed = []
    kinds = [(32, '金環皆既日食'), (4, '皆既日食'), (8, '金環日食'), (16, '部分日食')] if solar else [(4, '皆既月食'), (16, '部分月食'), (64, '半影月食')]
    for _ in range(400):
        flag = func(jd, 4, 0, values, 0, error)
        if flag < 0:
            raise RuntimeError(error.value)
        peak = (epoch + timedelta(days=values[0] - 2440587.5)).astimezone(tz)
        if peak >= end:
            break
        if peak >= start:
            computed.append((peak, next(label for bit, label in kinds if flag & bit)))
        jd = values[0] + 1
    else:
        raise RuntimeError('Eclipse iteration guard')
    summary[name] = [(round(t.timestamp() * 1000), kind) for t, kind in computed]
(root / 'eclipse-peaks.json').write_text(json.dumps(summary, ensure_ascii=False) + '\n')
