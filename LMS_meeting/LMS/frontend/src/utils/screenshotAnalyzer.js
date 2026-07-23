/**
 * Screenshot Frame Difference Anomaly Analyzer (JS / Canvas implementation)
 * Operates on 3-second screenshot intervals.
 * Evaluates frame difference (160x90 grayscale), assigns y<score> or r<score>,
 * compresses evidence images, and sends to LMS audit logs.
 */

export const Y_THRESHOLD = 30.0;
export const R_THRESHOLD = 60.0;
export const SS_WEIGHT = 0.3;
export const POPUP_THRESHOLD = 70.0;

let previousFrameData = null;

/**
 * Resizes source image/canvas to 160x90 grayscale pixel array
 */
function getGrayscalePixels(sourceCanvas) {
  const offscreen = document.createElement('canvas');
  offscreen.width = 160;
  offscreen.height = 90;
  const ctx = offscreen.getContext('2d');
  
  // Draw scaled down
  ctx.drawImage(sourceCanvas, 0, 0, 160, 90);
  const imgData = ctx.getImageData(0, 0, 160, 90).data;
  
  // Convert RGBA to Grayscale array (length 160 * 90)
  const grayPixels = new Uint8Array(160 * 90);
  for (let i = 0, j = 0; i < imgData.length; i += 4, j++) {
    // Luminance formula: Y = 0.299R + 0.587G + 0.114B
    grayPixels[j] = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
  }
  
  return grayPixels;
}

/**
 * Calculates absolute pixel difference mean normalized to 0-100 score
 */
export function computeDiffScore(grayPixelsA, grayPixelsB) {
  if (!grayPixelsA || !grayPixelsB || grayPixelsA.length !== grayPixelsB.length) return 0;
  
  let totalDiff = 0;
  const len = grayPixelsA.length;
  for (let i = 0; i < len; i++) {
    totalDiff += Math.abs(grayPixelsA[i] - grayPixelsB[i]);
  }
  
  const meanDiff = totalDiff / len; // 0 - 255 range
  const score = (meanDiff / 255.0) * 100.0;
  return Number(score.toFixed(2));
}

/**
 * Compresses current canvas to 480p JPEG data URL (854x480, quality 50%)
 * Payload is tiny (< 100KB, well under 1MB) for LMS storage.
 */
export function compressCanvasFrame480p(canvas, quality = 0.5) {
  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = 854;
    offscreen.height = 480;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 854, 480);
    return offscreen.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.error('Error compressing 480p frame:', err);
    return null;
  }
}

/**
 * Processes 3s slot screenshot frame
 * @param {HTMLCanvasElement} currentCanvas 
 * @param {number} behavioralCurrentScore 
 * @returns {object|null} Result with outputCode ('y<score>' | 'r<score>'), evidence frame, combinedRisk, eventType
 */
export function analyze3sSlotFrame(currentCanvas, behavioralCurrentScore = 0) {
  const currentGray = getGrayscalePixels(currentCanvas);
  
  if (!previousFrameData) {
    previousFrameData = currentGray;
    return {
      outputCode: null,
      score: 0,
      combinedRisk: behavioralCurrentScore,
      eventType: null,
      evidenceFrame: null,
      popupTriggered: false,
    };
  }
  
  const score = computeDiffScore(currentGray, previousFrameData);
  const combinedRisk = Number((behavioralCurrentScore + (score * SS_WEIGHT)).toFixed(2));
  previousFrameData = currentGray;
  
  if (score < Y_THRESHOLD) {
    // Negligible change (< 30): replace buffer, continue
    return {
      outputCode: null,
      score,
      combinedRisk,
      eventType: null,
      evidenceFrame: null,
      popupTriggered: false,
    };
  }

  if (score >= Y_THRESHOLD && score < R_THRESHOLD) {
    // Yellow: noteworthy change (30-60) — Telemetry log ONLY, no screenshot, no popup
    const outputCode = `y${score}`;
    return {
      outputCode,
      score,
      combinedRisk,
      eventType: 'SCREENSHOT_CHANGE',
      evidenceFrame: null, // NO screenshot attached for y<score>
      popupTriggered: false,
    };
  } else {
    // Red: large sudden visual change (>= 60) — Grab nearest 480p compressed screenshot & trigger popup
    const outputCode = `r${score}`;
    const compressed480p = compressCanvasFrame480p(currentCanvas, 0.5);
    
    return {
      outputCode,
      score,
      combinedRisk,
      eventType: 'SCREENSHOT_ANOMALY',
      evidenceFrame: compressed480p, // 480p compressed screenshot (< 100KB)
      popupTriggered: true, // Trigger popup signal for r<score>
    };
  }
}

export function resetFrameBuffer() {
  previousFrameData = null;
}

export const analyze5sSlotFrame = analyze3sSlotFrame;
