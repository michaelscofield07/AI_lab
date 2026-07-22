import os
import base64

try:
    import cv2
    import numpy as np
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False

try:
    from PIL import Image, ImageChops
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Configurable thresholds & weights
Y_THRESHOLD = 30.0
R_THRESHOLD = 60.0
SS_WEIGHT = 0.3
POPUP_THRESHOLD = 70.0

def frame_diff_score(frame_a, frame_b) -> float:
    """
    Computes absolute pixel difference between frame_a and frame_b (grayscale 160x90).
    Returns a normalized change score in range 0-100.
    """
    if HAS_OPENCV:
        # Resize both frames to 160x90 (lightweight, fast)
        a = cv2.resize(frame_a, (160, 90))
        b = cv2.resize(frame_b, (160, 90))
        
        # Convert to grayscale
        a_gray = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY) if len(a.shape) == 3 else a
        b_gray = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY) if len(b.shape) == 3 else b
        
        # Compute absolute pixel difference
        diff = cv2.absdiff(a_gray, b_gray)
        mean_diff = float(np.mean(diff))
    elif HAS_PIL:
        if isinstance(frame_a, np.ndarray):
            img_a = Image.fromarray(frame_a).resize((160, 90)).convert('L')
            img_b = Image.fromarray(frame_b).resize((160, 90)).convert('L')
        else:
            img_a = frame_a.resize((160, 90)).convert('L')
            img_b = frame_b.resize((160, 90)).convert('L')
        
        diff = ImageChops.difference(img_a, img_b)
        stat = ImageChops.stat.Stat(diff)
        mean_diff = stat.mean[0]
    else:
        # Pure Python list/matrix calculation fallback
        a_flat = list(frame_a) if isinstance(frame_a, (list, tuple)) else frame_a.flatten()
        b_flat = list(frame_b) if isinstance(frame_b, (list, tuple)) else frame_b.flatten()
        diffs = [abs(int(p1) - int(p2)) for p1, p2 in zip(a_flat, b_flat)]
        mean_diff = sum(diffs) / max(len(diffs), 1)

    score = (mean_diff / 255.0) * 100.0
    return round(score, 2)

def compress_frame_480p(frame, quality: int = 50) -> str:
    """
    Compresses nearest screenshot frame to 480p resolution (854x480 JPEG quality 50%),
    resulting in a tiny payload (< 100KB, well under 1MB) for LMS storage.
    """
    if HAS_OPENCV and isinstance(frame, np.ndarray):
        # Resize to 480p (854x480)
        resized = cv2.resize(frame, (854, 480))
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        _, buffer = cv2.imencode('.jpg', resized, encode_param)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{jpg_as_text}"
    elif HAS_PIL:
        import io
        if isinstance(frame, np.ndarray):
            img = Image.fromarray(frame).resize((854, 480))
        else:
            img = frame.resize((854, 480))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality)
        jpg_as_text = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{jpg_as_text}"
    else:
        return "data:image/jpeg;base64,compressed_480p_dummy_frame_data"

def process_screenshot_slot(recent_frame, 
                           previous_frame, 
                           behavioral_score: float = 0.0):
    """
    Processes 5s slot screenshot frame and returns audit decision and formatted score code (y<score> / r<score>).
    
    Returns dict with:
      - output_code: 'y<score>' or 'r<score>' (or None if below Y threshold)
      - event_type: 'SCREENSHOT_CHANGE' or 'SCREENSHOT_ANOMALY'
      - score: float (diff score)
      - combined_risk: float
      - compressed_evidence: str (JPEG base64 if >= Y_THRESHOLD, else None)
      - popup_triggered: bool
      - updated_previous_frame: np.ndarray
    """
    if previous_frame is None:
        return {
            "output_code": None,
            "score": 0.0,
            "combined_risk": behavioral_score,
            "event_type": None,
            "compressed_evidence": None,
            "popup_triggered": False,
            "updated_previous_frame": recent_frame
        }
        
    score = frame_diff_score(recent_frame, previous_frame)
    combined_risk = round(behavioral_score + (score * SS_WEIGHT), 2)
    
    if score < Y_THRESHOLD:
        # Negligible change — replace buffer, continue
        return {
            "output_code": None,
            "score": score,
            "combined_risk": combined_risk,
            "event_type": None,
            "compressed_evidence": None,
            "popup_triggered": False,
            "updated_previous_frame": recent_frame
        }
        
    elif Y_THRESHOLD <= score < R_THRESHOLD:
        # Yellow threshold: telemetry log ONLY — do NOT attach screenshot or fire popup
        output_code = f"y{score}"
        return {
            "output_code": output_code,
            "score": score,
            "combined_risk": combined_risk,
            "event_type": "SCREENSHOT_CHANGE",
            "compressed_evidence": None, # No screenshot attached for y<score>
            "zip_evidence": None,
            "popup_triggered": False,
            "updated_previous_frame": recent_frame
        }
        
    else:  # score >= R_THRESHOLD
        # Red threshold: grab nearest screenshot, compress to 480p resolution (<100KB), log event, and trigger popup
        output_code = f"r{score}"
        evidence_img_480p = compress_frame_480p(recent_frame, quality=50)
        
        return {
            "output_code": output_code,
            "score": score,
            "combined_risk": combined_risk,
            "event_type": "SCREENSHOT_ANOMALY",
            "compressed_evidence": evidence_img_480p, # 480p compressed image (<100KB, well under 1MB)
            "popup_triggered": True, # Trigger popup signal for r<score>
            "updated_previous_frame": recent_frame
        }

if __name__ == "__main__":
    print("--- Running Screenshot Frame Diff Anomaly Detection Test ---")
    
    if HAS_OPENCV:
        frame_a = np.zeros((720, 1280, 3), dtype=np.uint8)
        frame_b = np.copy(frame_a)
        cv2.rectangle(frame_b, (100, 100), (500, 500), (200, 200, 200), -1)
        frame_c = np.full((720, 1280, 3), 255, dtype=np.uint8)
    else:
        # Fallback 100px pixel arrays for testing
        frame_a = [0] * 100
        # Medium change (yellow)
        frame_b = [0] * 50 + [200] * 50
        # High change (red)
        frame_c = [255] * 100

    res_yellow = process_screenshot_slot(frame_b, frame_a, behavioral_score=15.0)
    print(f"[Yellow Test] Output Code: {res_yellow['output_code']}, Score: {res_yellow['score']}, Combined Risk: {res_yellow['combined_risk']}")
    
    res_red = process_screenshot_slot(frame_c, frame_a, behavioral_score=50.0)
    print(f"[Red Test] Output Code: {res_red['output_code']}, Score: {res_red['score']}, Combined Risk: {res_red['combined_risk']}, Popup: {res_red['popup_triggered']}")
