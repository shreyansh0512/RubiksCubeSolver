Rubik’s Cube Web Solver

An end-to-end Rubik’s Cube solver web app built with Python (Flask) as backend and HTML/JS/CSS + OpenCV as frontend.
The app allows you to scan your cube using your webcam, confirm detected colors, and then computes the optimal solution using Korf’s algorithm.

✨ Features

🎥 Camera-based color scanning using OpenCV (HSV + LAB color space).

🎨 Manual correction grid to fix any stickers the camera misreads.

✅ Real-time face-by-face confirmations after each scan.

🧩 Korf’s algorithm solver integration — returns an optimal move sequence.

🌐 Single web app — backend and frontend live in one root folder (RUBIKS-WEBSOLVER).

⚡ Flask API + static frontend — no extra frameworks required.
📂 Project Structure
RUBIKS-WEBSOLVER/
│
├── app.py              # Flask backend server
├── solver/             # Solver interface (Korf’s algorithm)
├── static/             # Frontend files
│   ├── index.html
│   ├── main.js
│   └── style.css
└── README.md

🚀 How to Run
1. Clone the repo
git clone https://github.com/<your-username>/RUBIKS-WEBSOLVER.git
cd RUBIKS-WEBSOLVER

2. Create a virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows

3. Install dependencies
pip install -r requirements.txt


Typical requirements include:

flask
opencv-python
numpy

4. Run the server
python app.py


The app will start at:

http://127.0.0.1:5001

🕹️ Usage

Open the app in your browser.

Scan each face of your cube with the webcam.

Confirm detected stickers in the interactive correction grid (click to cycle colors if wrong).

Once all 6 faces are scanned, hit Solve.

The app displays the solution sequence to solve your cube.

🔮 Future Improvements

More robust color calibration (auto white balance).

Mobile-friendly UI.

Step-by-step 3D cube visualizer for the solution.

📜 License

MIT License. Free to use and modify.