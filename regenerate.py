from pathlib import Path
import importlib.util
import sys
import types

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
library = Path(sys.argv[3]).resolve()
out.mkdir(exist_ok=True, parents=True)
source = root / 'research' / 'build_ephemeris.py'
script = source.read_text()
original = "[(step(1900), 0, '1900_1999'), (step(2051), step(2101), '2051_2100')]"
requested = "[(step(2000), step(2051), '2000_2050')]"
assert script.count(original) == 1
module = types.ModuleType('engine_generator')
module.__file__ = str(source)
exec(compile(script.replace(original, requested), str(source), 'exec'), module.__dict__)
module.build(out, library)
