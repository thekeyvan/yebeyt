"""Finding the silence between two hemistichs in a recitation. Pure functions over 20 ms energy windows, tested in test_silence.py.

The audio is decoded to 16 kHz mono 16-bit WAV (macOS `afconvert`, see clips.py); only the stretches around Ganjoor's
marks are read. Energy is in dB relative to full scale, one value per 20 ms window."""
import array
import math
import wave

WINDOW = 0.02
# A pause between two hemistichs is at least this long to count.
MIN_RUN = 0.12
# The clip ends this long after the silence begins, so the last syllable's tail is whole.
PAD = 0.08
# Quiet means this far below the voice (the 90th percentile of the stretch).
DEPTH = 15.0
# A pause shorter than this may be a breath inside the hemistich; a longer one starting within RELEASE after it is taken instead.
SHORT, RELEASE = 10, 10  # windows (0.2 s)


def window_db(samples, rate):
    """dB of each whole 20 ms window of 16-bit `samples`."""
    size = round(rate * WINDOW)
    result = []
    for i in range(0, len(samples) - size + 1, size):
        chunk = samples[i:i + size]
        rms = math.sqrt(sum(s * s for s in chunk) / size) / 32768
        result.append(20 * math.log10(max(rms, 1e-5)))
    return result


def read_db(path, start, end):
    """(first window's start in seconds, dB per window) of a WAV between `start` and `end` seconds."""
    with wave.open(str(path), "rb") as wav:
        rate = wav.getframerate()
        first = max(0, round(start * rate))
        last = min(wav.getnframes(), round(end * rate))
        if last - first < rate * WINDOW:
            return first / rate, []
        wav.setpos(first)
        samples = array.array("h")
        samples.frombytes(wav.readframes(last - first))
        return first / rate, window_db(samples, rate)


def percentile(values, share):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(share * len(ordered)))]


def find_silence(db, onset_from=0, depth=DEPTH):
    """The quietest pause in a stretch of windows: (first quiet window, first window after it, quietest dB, voice dB), or
    None. A pause is a run of at least MIN_RUN that stays `depth` dB below the voice and has louder windows on both sides
    (a run at the stretch's edge may go on beyond it), and it ends (the voice returns) at window `onset_from` or later."""
    need = math.ceil(MIN_RUN / WINDOW)
    if len(db) < need:
        return None
    voice = percentile(db, 0.9)
    limit = voice - depth
    runs = []
    first = 0
    while first < len(db):
        if db[first] > limit:
            first += 1
            continue
        last = first
        while last < len(db) and db[last] <= limit:
            last += 1
        if first > 0 and last < len(db) and last - first >= need and last >= onset_from:
            floor = min(sum(db[i:i + need]) / need for i in range(first, last - need + 1))
            runs.append((first, last, floor, voice))
        first = last
    if not runs:
        return None
    best = min(runs, key=lambda run: (run[2], -run[0]))
    # A short pause is often the breath before the last syllable's release: a longer pause that follows soon is the gap.
    for run in runs:
        if run[0] >= best[1] and run[0] - best[1] <= RELEASE and best[1] - best[0] < SHORT and run[1] - run[0] > best[1] - best[0]:
            best = run
    return best
