# app.py
import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify, send_from_directory
from solver.solver_interface import solve_cube

app = Flask(__name__, static_folder="static", static_url_path="")

# In-memory session store for local dev
SESSIONS = {}

def read_b64_image(data_url):
    header, encoded = data_url.split(',', 1)
    data = base64.b64decode(encoded)
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

# ---------------- Standard prototype colors (BGR -> LAB) ----------------
# These are typical BGR values for sticker colors; we'll convert to LAB and
# compare Euclidean distance in LAB space (perceptually uniform for color)
STANDARD_BGR = {
    'W': np.uint8([[[255,255,255]]]),   # white
    'Y': np.uint8([[[0,255,255]]]),     # yellow
    'R': np.uint8([[[0,0,255]]]),       # red
    'O': np.uint8([[[0,165,255]]]),     # orange
    'G': np.uint8([[[0,255,0]]]),       # green
    'B': np.uint8([[[255,0,0]]])        # blue (BGR)
}
STANDARD_LAB = {k: cv2.cvtColor(v, cv2.COLOR_BGR2LAB)[0][0].astype(float) for k,v in STANDARD_BGR.items()}

def lab_mean_of_patch(patch):
    """Return mean LAB triplet for a BGR patch."""
    if patch.size == 0:
        return np.array([0.0,0.0,0.0])
    lab = cv2.cvtColor(patch, cv2.COLOR_BGR2LAB)
    mean = lab.reshape(-1,3).mean(axis=0)
    return mean.astype(float)

def lab_distance(a, b):
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    return np.linalg.norm(a - b)

# --------------- Robust patch classification ---------------
def extract_face_colors(img):
    """
    Crop a centered square region, split into 3x3 patches, compute mean LAB per patch,
    and classify each patch by nearest STANDARD_LAB prototype.
    Returns list of 9 letters from set {'W','Y','R','O','G','B'} in row-major order.
    """
    h_img, w_img = img.shape[:2]
    side = min(h_img, w_img)
    cx, cy = w_img//2, h_img//2
    half = int(side * 0.45)
    x1, y1 = max(0, cx-half), max(0, cy-half)
    crop = img[y1:y1+2*half, x1:x1+2*half].copy()
    # Resize to make patches reasonably sized and stable
    crop = cv2.resize(crop, (600,600))
    cell = 600 // 3
    colors = []

    for r in range(3):
        for c in range(3):
            sx = c * cell + cell//6
            sy = r * cell + cell//6
            patch = crop[sy:sy + (cell//3), sx:sx + (cell//3)]
            lab_mean = lab_mean_of_patch(patch)

            # Compare against prototypes
            best_color = None
            best_dist = float('inf')
            for color_letter, proto_lab in STANDARD_LAB.items():
                dist = lab_distance(lab_mean, proto_lab)
                if dist < best_dist:
                    best_dist = dist
                    best_color = color_letter

            # Fallback safety
            if best_color is None:
                best_color = 'W'
            colors.append(best_color)

    return colors

# --------------------- Routes ---------------------
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/scan', methods=['POST'])
def api_scan():
    data = request.json or {}
    session_id = data.get('session_id')
    try:
        face_index = int(data.get('face_index', 0))
    except:
        face_index = 0
    img_b64 = data.get('image')
    if not session_id or not img_b64:
        return jsonify({'ok': False, 'error': 'session_id and image required'}), 400

    try:
        img = read_b64_image(img_b64)
    except Exception as e:
        return jsonify({'ok': False, 'error': 'invalid image', 'detail': str(e)}), 400

    # classify patches into W/Y/R/O/G/B using LAB prototypes
    colors = extract_face_colors(img)
    center = colors[4]

    # save session faces (so user can re-scan or we can extend later)
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {'faces':[None]*6}
    faces = SESSIONS[session_id]['faces']
    faces[face_index] = colors
    SESSIONS[session_id]['faces'] = faces

    return jsonify({
        'ok': True,
        'face_index': face_index,
        'colors': colors,
        'grid': [colors[i*3:(i+1)*3] for i in range(3)],
        'center': center,
        'message': f'Face {face_index} recorded'
    })

@app.route('/api/solve', methods=['POST'])
def api_solve():
    data = request.json or {}
    facelet_string = data.get('facelet_string')
    if not facelet_string or len(facelet_string) != 54:
        return jsonify({'ok': False, 'error': 'facelet_string missing or invalid length'}), 400

    try:
        solution = solve_cube(facelet_string)
    except Exception as e:
        return jsonify({'ok': False, 'error': 'solver failed', 'detail': str(e)}), 500

    return jsonify({'ok': True, 'solution': solution})

# --------------------- Run ---------------------
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
