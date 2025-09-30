# solver_interface.py
try:
    import kociemba
except:
    kociemba=None

def solve_cube(facelet_string):
    if not kociemba:
        raise RuntimeError("Install kociemba: pip install kociemba")
    if len(facelet_string)!=54:
        raise ValueError(f"Facelet string length invalid: {len(facelet_string)}")
    for f in "URFDLB":
        if facelet_string.count(f)!=9:
            raise ValueError(f"Invalid cube state: {f} count={facelet_string.count(f)}")
    return kociemba.solve(facelet_string)
