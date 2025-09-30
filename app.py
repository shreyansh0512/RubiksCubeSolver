import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify, send_from_directory
from solver.solver_interface import solve_cube

app = Flask(__name__, static_folder="static", static_url_path="")

# Store scanned faces
SESSIONS = {}

def read_b64_image(data_url):
    header, encoded = data_url.split(',', 1)
    data = base64.b64decode(encoded)
    nparr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

# ================= HSV-based color detection =================
def extract_face_colors(img):
    h_img, w_img = img.shape[:2]
    side = min(h_img, w_img)
    cx, cy = w_img//2, h_img//2
    half = int(side*0.45)
    x1, y1 = max(0, cx-half), max(0, cy-half)
    crop = img[y1:y1+2*half, x1:x1+2*half].copy()
    crop = cv2.resize(crop, (600,600))
    cell = 600 // 3
    colors = []

    for r in range(3):
        for c in range(3):
            sx = c*cell + cell//6
            sy = r*cell + cell//6
            patch = crop[sy:sy+cell//3, sx:sx+cell//3]
            if patch.size == 0:
                colors.append('W')  # default
                continue

            # convert patch to HSV
            hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
            h = int(hsv[:,:,0].mean())
            s = int(hsv[:,:,1].mean())
            v = int(hsv[:,:,2].mean())

            # determine color
            if v < 50:
                color = 'B'  # treat very dark as blue (optional)
            elif s < 50 and v > 200:
                color = 'W'
            elif (0 <= h < 10) or (160 <= h <= 180):
                color = 'R'
            elif 10 <= h < 25:
                color = 'O'
            elif 25 <= h < 35:
                color = 'Y'
            elif 35 <= h < 85:
                color = 'G'
            elif 85 <= h < 130:
                color = 'B'
            else:
                color = 'W'

            colors.append(color)
    return colors

# ================= Routes =================
@app.route('/')
def index():
    return send_from_directory('static','index.html')

@app.route('/api/scan', methods=['POST'])
def api_scan():
    data = request.json
    session_id = data.get('session_id')
    face_index = int(data.get('face_index',0))
    img_b64 = data.get('image')
    if not session_id or img_b64 is None:
        return jsonify({'ok':False,'error':'session_id and image required'}),400

    try:
        img = read_b64_image(img_b64)
    except Exception as e:
        return jsonify({'ok':False,'error':'invalid image','detail':str(e)}),400

    colors = extract_face_colors(img)
    center = colors[4]

    if session_id not in SESSIONS:
        SESSIONS[session_id] = {'faces':[None]*6}
    SESSIONS[session_id]['faces'][face_index] = colors

    return jsonify({
        'ok':True,
        'face_index': face_index,
        'colors': colors,
        'grid':[colors[i*3:(i+1)*3] for i in range(3)],
        'center': center,
        'message': f'Face {face_index} recorded'
    })

@app.route('/api/solve', methods=['POST'])
def api_solve():
    data = request.json
    facelet_string = data.get('facelet_string')
    if not facelet_string or len(facelet_string)!=54:
        return jsonify({'ok':False,'error':'facelet_string missing or invalid length'}),400

    try:
        solution = solve_cube(facelet_string)
    except Exception as e:
        return jsonify({'ok':False,'error':'solver failed','detail':str(e)}),500

    return jsonify({'ok':True,'solution':solution})

# ================= Run server =================
if __name__=='__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
