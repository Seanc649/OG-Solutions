#!/usr/bin/env python3
"""Transcribe a video/audio file locally -> word-level JSON in the ElevenLabs shape.

Free, offline alternative to scripts/transcribe-elevenlabs.mjs, using NVIDIA
Parakeet TDT 0.6B (English) through sherpa-onnx.

Setup (once):
  pip install sherpa-onnx soundfile
  Download and unpack the model from GitHub (not Hugging Face):
  https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2

Usage:
  python3 scripts/transcribe-local.py <input> --model-dir <unpacked model dir> [--output path]

Output: <input-without-ext>.json beside the input, {"text", "words": [{text, start, end, type}]},
the shape the cutting tools read. Long inputs are decoded in chunks split at silences.
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np
import sherpa_onnx

SR = 16000
MAX_CHUNK = 60.0  # seconds per decode


def load_audio(path):
    pcm = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0


def chunk_bounds(samples):
    """Split at the quietest 100 ms window near each MAX_CHUNK boundary."""
    total = len(samples) / SR
    bounds, start = [], 0.0
    while total - start > MAX_CHUNK:
        lo, hi = start + MAX_CHUNK - 10, start + MAX_CHUNK
        best, best_t = None, hi
        t = lo
        while t < hi:
            seg = samples[int(t * SR):int((t + 0.1) * SR)]
            e = float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0
            if best is None or e < best:
                best, best_t = e, t + 0.05
            t += 0.05
        bounds.append((start, best_t))
        start = best_t
    bounds.append((start, total))
    return bounds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--output")
    a = ap.parse_args()
    m = a.model_dir
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=os.path.join(m, "encoder.int8.onnx"),
        decoder=os.path.join(m, "decoder.int8.onnx"),
        joiner=os.path.join(m, "joiner.int8.onnx"),
        tokens=os.path.join(m, "tokens.txt"),
        model_type="nemo_transducer",
        num_threads=os.cpu_count() or 2,
    )
    samples = load_audio(a.input)
    words = []
    for c0, c1 in chunk_bounds(samples):
        stream = rec.create_stream()
        stream.accept_waveform(SR, samples[int(c0 * SR):int(c1 * SR)])
        rec.decode_stream(stream)
        r = stream.result
        durations = list(getattr(r, "durations", []) or [])
        for i, (tok, ts) in enumerate(zip(r.tokens, r.timestamps)):
            dur = durations[i] if i < len(durations) else 0.08
            start, end = c0 + ts, c0 + ts + max(dur, 0.04)
            if tok.startswith(" ") or tok.startswith("▁") or not words or words[-1]["_closed"]:
                text = tok.lstrip(" ▁")
                if not text:
                    continue
                words.append({"text": text, "start": start, "end": end, "_closed": False})
            else:
                words[-1]["text"] += tok
                words[-1]["end"] = end
        if words:
            words[-1]["_closed"] = True  # never join words across chunks
    out = []
    for i, w in enumerate(words):
        end = w["end"]
        if i + 1 < len(words):
            end = min(end, words[i + 1]["start"])
        out.append({"text": w["text"], "start": round(w["start"], 3), "end": round(max(end, w["start"] + 0.02), 3), "type": "word"})
    result = {
        "language_code": "en",
        "audio_duration_secs": round(len(samples) / SR, 3),
        "text": " ".join(w["text"] for w in out),
        "words": out,
        "source": "local parakeet-tdt-0.6b-v2 (sherpa-onnx)",
    }
    output = a.output or os.path.splitext(a.input)[0] + ".json"
    with open(output, "w") as f:
        json.dump(result, f, indent=2)
    print(f"{len(out)} words -> {output}")


if __name__ == "__main__":
    sys.exit(main())
