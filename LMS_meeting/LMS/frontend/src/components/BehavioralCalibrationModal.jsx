import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Keyboard, MousePointer, CheckCircle } from 'lucide-react';

const CALIBRATION_SENTENCE = "The quick brown Fox jumps over 123 lazy Dogs! #AILab2026";

export default function BehavioralCalibrationModal({ userId, userName, onComplete }) {
  const [typedText, setTypedText] = useState('');
  const [keystrokes, setKeystrokes] = useState([]);
  const [mouseEvents, setMouseEvents] = useState([]);
  const [mouseTrackCount, setMouseTrackCount] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const keyTimesRef = useRef({});
  const lastKeyTimeRef = useRef(null);

  // Measure mouse movements within target area
  const handleMouseMove = (e) => {
    if (mouseTrackCount >= 50) return;
    const timestamp = performance.now();
    setMouseEvents((prev) => [
      ...prev,
      { x: e.clientX, y: e.clientY, time: timestamp },
    ]);
    setMouseTrackCount((c) => c + 1);
  };

  const handleKeyDown = (e) => {
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    const now = performance.now();
    keyTimesRef.current[e.code] = now;
  };

  const handleKeyUp = (e) => {
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
    const now = performance.now();
    const pressTime = keyTimesRef.current[e.code];
    const dwellTime = pressTime ? now - pressTime : 0;

    let flightTime = 0;
    if (lastKeyTimeRef.current) {
      flightTime = now - lastKeyTimeRef.current;
    }
    lastKeyTimeRef.current = now;

    setKeystrokes((prev) => [
      ...prev,
      {
        char: e.key,
        code: e.code,
        dwellMs: dwellTime,
        flightMs: flightTime,
        isUpper: e.key !== e.key.toLowerCase() && /[A-Z]/.test(e.key),
        isDigit: /[0-9]/.test(e.key),
      },
    ]);
  };

  const handleFinishCalibration = () => {
    if (typedText.trim() !== CALIBRATION_SENTENCE) {
      setErrorMsg('Please type the sentence exactly as shown above (case-sensitive).');
      return;
    }

    if (mouseTrackCount < 15) {
      setErrorMsg('Please move your mouse inside the tracking box below to complete calibration.');
      return;
    }

    // Compute baseline stats
    const totalChars = keystrokes.length;
    const totalDwell = keystrokes.reduce((acc, k) => acc + k.dwellMs, 0);
    const avgDwellMs = totalChars > 0 ? totalDwell / totalChars : 100;

    const validFlights = keystrokes.filter((k) => k.flightMs > 0 && k.flightMs < 2000);
    const avgFlightMs =
      validFlights.length > 0
        ? validFlights.reduce((acc, k) => acc + k.flightMs, 0) / validFlights.length
        : 120;

    // Mouse speed calculation
    let totalDist = 0;
    let totalTime = 0;
    for (let i = 1; i < mouseEvents.length; i++) {
      const dx = mouseEvents[i].x - mouseEvents[i - 1].x;
      const dy = mouseEvents[i].y - mouseEvents[i - 1].y;
      const dt = mouseEvents[i].time - mouseEvents[i - 1].time;
      if (dt > 0) {
        totalDist += Math.sqrt(dx * dx + dy * dy);
        totalTime += dt;
      }
    }
    const mouseAvgSpeed = totalTime > 0 ? totalDist / totalTime : 0.5; // pixels/ms

    const profile = {
      userId,
      userName,
      avgDwellMs: Math.round(avgDwellMs),
      avgFlightMs: Math.round(avgFlightMs),
      mouseAvgSpeed: Number(mouseAvgSpeed.toFixed(3)),
      calibratedAt: new Date().toISOString(),
    };

    // Save profile persistently per user ID
    localStorage.setItem(`behavioral_profile_${userId}`, JSON.stringify(profile));
    setIsCalibrated(true);

    setTimeout(() => {
      onComplete(profile);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">Behavioral DNA Calibration Required</h2>
            <p className="text-xs text-slate-400">
              One-time verification: Learn your typing & mouse movement patterns before taking the assessment.
            </p>
          </div>
        </div>

        {isCalibrated ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={48} className="mx-auto text-emerald-400 animate-bounce" />
            <h3 className="text-lg font-bold text-white">Behavioral Profile Saved!</h3>
            <p className="text-xs text-slate-400">
              Your baseline dynamics have been registered for user ID <span className="font-mono text-violet-400">{userId}</span>. Unlocking assessment...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {/* Step 1: Typing Calibration */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Keyboard size={14} className="text-violet-400" />
                Step 1: Type the exact target sentence below:
              </label>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 select-none">
                {CALIBRATION_SENTENCE}
              </div>
              <input
                type="text"
                value={typedText}
                onChange={(e) => {
                  setErrorMsg('');
                  setTypedText(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                placeholder="Type the sentence here..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>

            {/* Step 2: Mouse Movement Calibration */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MousePointer size={14} className="text-violet-400" />
                Step 2: Move mouse inside this box ({mouseTrackCount}/50 samples):
              </label>
              <div
                onMouseMove={handleMouseMove}
                className="h-24 bg-slate-950 border border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-500 text-xs cursor-crosshair hover:border-violet-500 transition-colors"
              >
                {mouseTrackCount >= 50
                  ? '✓ Mouse Velocity & Acceleration Calibrated'
                  : 'Move cursor around in here...'}
              </div>
            </div>

            <button
              onClick={handleFinishCalibration}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-violet-900/40"
            >
              Verify & Complete Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
