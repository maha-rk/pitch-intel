import os
import cv2
import json
import tempfile
import numpy as np
from dotenv import load_dotenv

load_dotenv('backend/.env')

from backend.granite import client, MODEL
from backend.transparency import LIMITATIONS
from backend.guardian import check_verdict as _guardian_check

try:
    from ultralytics import YOLO as _YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

try:
    from docling.document_converter import DocumentConverter
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False

_yolo_model = None
_laws_cache: dict = {}

# Hardcoded FIFA law excerpts — used when no PDF is present
FIFA_LAWS = {
    'handball': (
        'Law 12 – Fouls and Misconduct',
        """A handball offence occurs when a player deliberately touches the ball with their hand or arm.
The following are considered handballs regardless of intent:
• The ball touches a player's hand/arm that is in an unnaturally extended position, making the body bigger.
• A player scores or creates a goal directly from a handball.
The hand/arm is considered natural if it is close to the body and does not make the silhouette unnaturally larger.
Accidental handball by an attacker that immediately precedes a goal is penalised."""
    ),
    'foul': (
        'Law 12 – Fouls and Misconduct',
        """A direct free kick is awarded if a player commits any of the following against an opponent:
• Kicks or attempts to kick · Trips or attempts to trip · Charges carelessly/recklessly
• Jumps at · Strikes or attempts to strike · Pushes · Tackles/challenges
A foul committed recklessly must receive a yellow card (caution).
A foul committed with excessive force or brutality must receive a red card (sending-off).
A penalty kick is awarded if any of these offences are committed inside the penalty area."""
    ),
    'tackle': (
        'Law 12 – Fouls and Misconduct',
        """Tackles and challenges must be assessed for the use of force:
• Careless: no disciplinary action required beyond the free kick.
• Reckless: caution (yellow card) — player showed disregard for danger to the opponent.
• Excessive force/brutality: sending-off (red card) — player endangered opponent's safety.
A tackle from behind that endangers the safety of an opponent is serious foul play (red card).
VAR review is triggered when a potential red-card tackle is missed by the on-field referee."""
    ),
    'offside': (
        'Law 11 – Offside',
        """Offside Position:
A player is in an offside position if any part of their head, body, or feet is in the opponents' half
AND nearer to the opponents' goal line than both the ball and the second-last opponent.
Hands and arms of all players (including goalkeepers) are not considered.

Offside Offence — a player in an offside position becomes active by:
• Interfering with play (touching the ball played by a teammate).
• Interfering with an opponent (blocking vision, competing for the ball).
• Gaining an advantage from being in that position.

No offence if received directly from a goal kick, throw-in, or corner kick.
VAR uses a calibrated offside line; the on-field decision is reversed only when there is a clear error."""
    ),
    'simulation': (
        'Law 12 – Fouls and Misconduct',
        """Simulation / Deceiving the Referee:
A player who attempts to deceive the referee by simulating an injury or being fouled
(diving, play-acting) is cautioned for unsporting behaviour (yellow card).
If the game was stopped for the incident, the caution is given at the next stoppage.
VAR may recommend a review when simulation results in an incorrect penalty or red card."""
    ),
}


def _get_model():
    global _yolo_model
    if _yolo_model is None and YOLO_AVAILABLE:
        _yolo_model = _YOLO('yolov8n.pt')
    return _yolo_model


def _parse_pdf_with_docling(pdf_path: str) -> str | None:
    if not DOCLING_AVAILABLE:
        return None
    try:
        from docling.document_converter import PdfFormatOption
        from docling.datamodel.pipeline_options import PdfPipelineOptions
        opts = PdfPipelineOptions()
        opts.do_ocr = False
        opts.do_table_structure = False
        converter = DocumentConverter(format_options={'pdf': PdfFormatOption(pipeline_options=opts)})
        result = converter.convert(pdf_path)
        return result.document.export_to_markdown()
    except Exception as e:
        print(f"Docling parsing error: {e}")
        return None


def _extract_law_from_text(full_text: str, incident_type: str) -> str | None:
    keyword_map = {
        'handball':   ['handling', 'handball', 'hand/arm'],
        'foul':       ['direct free kick', 'foul', 'misconduct'],
        'tackle':     ['tackle', 'serious foul play', 'challenge'],
        'offside':    ['offside'],
        'simulation': ['simulation', 'deceiving', 'diving'],
    }
    keywords = keyword_map.get(incident_type, ['foul'])
    lines = full_text.split('\n')
    capture, relevant = False, []
    for line in lines:
        ll = line.lower()
        if any(kw in ll for kw in keywords):
            capture = True
        if capture:
            relevant.append(line)
            if len(relevant) >= 40:
                break
    return '\n'.join(relevant) if relevant else None


def get_relevant_law(incident_type: str) -> tuple[str, str]:
    """Return (law_name, law_text) for the incident type."""
    global _laws_cache

    pdf_path = os.path.join(os.path.dirname(__file__), 'fifa_laws.pdf')
    cache_key = f'pdf_{incident_type}'

    if os.path.exists(pdf_path) and cache_key not in _laws_cache:
        full_text = _laws_cache.get('_full_text') or _parse_pdf_with_docling(pdf_path)
        if full_text:
            _laws_cache['_full_text'] = full_text
            excerpt = _extract_law_from_text(full_text, incident_type)
            if excerpt:
                law_name = FIFA_LAWS.get(incident_type, ('Unknown Law', ''))[0]
                _laws_cache[cache_key] = (law_name, excerpt)

    if cache_key in _laws_cache:
        return _laws_cache[cache_key]

    # Fallback to hardcoded excerpts
    return FIFA_LAWS.get(incident_type, FIFA_LAWS['foul'])


def analyse_video_frames(video_path: str) -> dict:
    """Run YOLOv8 on sampled frames. Returns structured CV data."""
    model = _get_model()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Cannot open video file")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    duration = total_frames / fps

    # Sample up to 8 frames evenly — enough for incident classification
    sample_interval = max(1, total_frames // 8)
    frame_analyses, frame_idx = [], 0

    while cap.isOpened() and len(frame_analyses) < 8:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_interval == 0:
            h, w = frame.shape[:2]

            if model:
                results = model(frame, verbose=False, imgsz=640)[0]
                persons, ball = [], None
                for box in results.boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = map(float, box.xyxy[0].tolist())
                    if cls == 0 and conf > 0.30:
                        persons.append({
                            'x1': x1/w, 'y1': y1/h, 'x2': x2/w, 'y2': y2/h,
                            'cx': (x1+x2)/(2*w), 'cy': (y1+y2)/(2*h), 'conf': round(conf, 2),
                        })
                    elif cls == 32 and conf > 0.15:
                        ball = {
                            'cx': (x1+x2)/(2*w), 'cy': (y1+y2)/(2*h),
                            'x1': x1/w, 'y1': y1/h, 'x2': x2/w, 'y2': y2/h,
                            'conf': round(conf, 2),
                        }
            else:
                persons, ball = [], None

            # Max bounding-box overlap between any two players
            max_overlap = 0.0
            for i, p1 in enumerate(persons):
                for p2 in persons[i+1:]:
                    ox = max(0, min(p1['x2'], p2['x2']) - max(p1['x1'], p2['x1']))
                    oy = max(0, min(p1['y2'], p2['y2']) - max(p1['y1'], p2['y1']))
                    max_overlap = max(max_overlap, ox * oy)

            frame_analyses.append({
                'frame': frame_idx,
                'person_count': len(persons),
                'ball_found': ball is not None,
                'ball': ball,
                'max_player_overlap': round(max_overlap, 5),
                'persons': persons[:8],
            })

        frame_idx += 1

    cap.release()

    return {
        'total_frames': total_frames,
        'sampled_frames': len(frame_analyses),
        'duration_seconds': round(duration, 1),
        'fps': round(fps, 1),
        'frames': frame_analyses,
    }


def classify_incident(cv_data: dict) -> tuple[str, dict]:
    """Classify incident type from aggregated YOLOv8 output."""
    frames = cv_data.get('frames', [])
    if not frames:
        return 'foul', {}

    ball_found = sum(1 for f in frames if f['ball_found'])
    ball_ratio = ball_found / len(frames)
    max_overlap = max((f['max_player_overlap'] for f in frames), default=0.0)
    avg_persons = sum(f['person_count'] for f in frames) / len(frames)

    ball_heights = [f['ball']['cy'] for f in frames if f.get('ball')]
    avg_ball_h = sum(ball_heights) / len(ball_heights) if ball_heights else 0.5

    # Count frames where ball is in the upper-body region of a player (handball indicator)
    handball_frames = 0
    for f in frames:
        if not f.get('ball'):
            continue
        bx, by = f['ball']['cx'], f['ball']['cy']
        for p in f.get('persons', []):
            upper_bot = p['y1'] + (p['y2'] - p['y1']) * 0.42
            if (p['y1'] <= by <= upper_bot and
                    p['x1'] - 0.06 <= bx <= p['x2'] + 0.06):
                handball_frames += 1
                break

    handball_ratio = handball_frames / len(frames)

    details = {
        'ball_detected_pct': round(ball_ratio * 100),
        'avg_players': round(avg_persons, 1),
        'max_overlap': round(max_overlap, 5),
        'avg_ball_height_ratio': round(avg_ball_h, 2),
        'handball_indicator_frames': handball_frames,
    }

    # Handball: ball clearly in upper-body/arm region of a player
    if handball_ratio > 0.25 and ball_ratio > 0.4:
        return 'handball', details
    # Tackle: significant bounding-box overlap between players with ball present
    if max_overlap > 0.04 and ball_ratio > 0.2:
        return 'tackle', details
    # Moderate contact
    if max_overlap > 0.015:
        return 'foul', details
    # Default — let Granite refine from filename + CV context
    return 'foul', details


_GENERIC_FILENAMES = {'soccer.mp4', 'video.mp4', 'clip.mp4', 'football.mp4', 'match.mp4', 'game.mp4', 'upload.mp4'}


def _compute_ball_motion(frames: list, fps: float) -> dict:
    """Track ball across frames to compute direction, speed, and trajectory shape."""
    detections = [(f['frame'], f['ball']) for f in frames if f.get('ball')]
    if len(detections) < 2:
        return {
            'trackable': False,
            'frames_with_ball': len(detections),
            'direction': 'unknown',
            'speed_desc': 'unknown',
            'start_pos': None,
            'end_pos': None,
            'total_distance': 0.0,
        }

    dx_list, dy_list = [], []
    for i in range(len(detections) - 1):
        f1, b1 = detections[i]
        f2, b2 = detections[i + 1]
        dt = f2 - f1
        if dt == 0:
            continue
        dx_list.append((b2['cx'] - b1['cx']) / dt)
        dy_list.append((b2['cy'] - b1['cy']) / dt)

    if not dx_list:
        return {'trackable': False, 'frames_with_ball': len(detections), 'direction': 'unknown', 'speed_desc': 'unknown', 'start_pos': None, 'end_pos': None, 'total_distance': 0.0}

    avg_dx = sum(dx_list) / len(dx_list)
    avg_dy = sum(dy_list) / len(dy_list)
    speed_norm = (avg_dx ** 2 + avg_dy ** 2) ** 0.5 * fps

    b_start = detections[0][1]
    b_end = detections[-1][1]
    total_dx = b_end['cx'] - b_start['cx']
    total_dy = b_end['cy'] - b_start['cy']
    total_dist = (total_dx ** 2 + total_dy ** 2) ** 0.5

    h_dir = 'rightward' if avg_dx > 0.006 else 'leftward' if avg_dx < -0.006 else 'horizontal'
    v_dir = 'upward (rising)' if avg_dy < -0.006 else 'downward (dropping)' if avg_dy > 0.006 else 'flat'
    direction = f'{h_dir}, {v_dir}'
    speed_desc = 'fast (likely shot or clearance)' if speed_norm > 0.15 else \
                 'moderate (pass or cross)' if speed_norm > 0.06 else \
                 'slow / stationary (set piece setup or loose ball)'

    return {
        'trackable': True,
        'frames_with_ball': len(detections),
        'direction': direction,
        'speed_desc': speed_desc,
        'start_pos': {'x': round(b_start['cx'], 3), 'y': round(b_start['cy'], 3)},
        'end_pos': {'x': round(b_end['cx'], 3), 'y': round(b_end['cy'], 3)},
        'total_distance': round(total_dist, 3),
    }


def _detect_formations(frames: list) -> dict:
    """Identify player groupings: wall, cluster, spread."""
    all_pos = [(p['cx'], p['cy']) for f in frames for p in f.get('persons', [])]
    if len(all_pos) < 3:
        return {'detectable': False, 'formations': ['insufficient player data']}

    cxs = [p[0] for p in all_pos]
    cys = [p[1] for p in all_pos]
    cx_spread = max(cxs) - min(cxs)
    avg_cx = sum(cxs) / len(cxs)

    # Defensive wall: ≥3 players with similar vertical position (cy within 0.13 band)
    best_line = 0
    for cy in cys:
        group = sum(1 for c in cys if abs(c - cy) < 0.13)
        best_line = max(best_line, group)

    formations = []
    if best_line >= 3:
        formations.append(f'defensive wall — {best_line} players aligned horizontally (set piece indicator)')
    if cx_spread < 0.38 and len(all_pos) >= 4:
        side = 'right third' if avg_cx > 0.60 else 'left third' if avg_cx < 0.40 else 'central area'
        formations.append(f'players clustered in {side} — penalty area or set piece')
    elif cx_spread > 0.65:
        formations.append('players spread across full pitch width — open play / transition')

    return {
        'detectable': True,
        'total_detections': len(all_pos),
        'horizontal_line_max': best_line,
        'cx_spread': round(cx_spread, 3),
        'avg_position': f'x={avg_cx:.2f}',
        'formations': formations if formations else ['no distinct formation pattern'],
    }


def generate_verdict(cv_data: dict, cv_details: dict, filename: str = '') -> dict:
    """Rich CV description → Granite classifies incident and delivers specific, confident verdict."""
    frames = cv_data.get('frames', [])
    fps = cv_data.get('fps', 25.0)

    # --- Frame narrative ---
    frame_lines = []
    for f in frames:
        t = round(f['frame'] / max(fps, 1), 1)
        if f.get('ball'):
            bx, by = f['ball']['cx'], f['ball']['cy']
            ball_desc = f'ball x={bx:.2f} y={by:.2f} ({"arm/chest height" if by < 0.40 else "upper-body" if by < 0.52 else "foot-level"})'
        else:
            ball_desc = 'ball not visible'
        ov = f['max_player_overlap']
        contact = f' ⚡CONTACT ov={ov:.4f}' if ov > 0.015 else ''
        frame_lines.append(f'  t={t}s · {f["person_count"]}p · {ball_desc}{contact}')

    # --- Aggregates ---
    ball_frames = sum(1 for f in frames if f['ball_found'])
    avg_persons = sum(f['person_count'] for f in frames) / max(len(frames), 1)
    max_overlap = max((f['max_player_overlap'] for f in frames), default=0)
    ball_ys = [f['ball']['cy'] for f in frames if f.get('ball')]
    avg_ball_h = sum(ball_ys) / len(ball_ys) if ball_ys else 0.5
    contact_count = sum(1 for f in frames if f['max_player_overlap'] > 0.015)

    # --- Motion + formation analysis ---
    motion = _compute_ball_motion(frames, fps)
    formation = _detect_formations(frames)

    # --- Ball trajectory label for cv_findings ---
    traj_desc = motion['direction'] if motion['trackable'] else 'not trackable'
    spread_desc = ', '.join(formation['formations']) if formation['detectable'] else 'insufficient data'

    # --- RAG: retrieve relevant FIFA law chunks via semantic search ---
    incident_type, _ = classify_incident(cv_data)
    from backend.var_oracle.rag import get_rag
    rag_query = (
        f"{incident_type} football incident: "
        f"ball at {'arm/chest height' if avg_ball_h < 0.40 else 'upper-body' if avg_ball_h < 0.52 else 'ground level'}, "
        f"{'significant player contact' if max_overlap > 0.04 else 'light contact' if max_overlap > 0.015 else 'no contact'}, "
        f"ball trajectory {traj_desc}"
    )
    rag = get_rag()
    rag_chunks = rag.retrieve(rag_query, k=2) if rag else []
    rag_used = bool(rag_chunks)

    if rag_chunks:
        all_laws = '\n\n'.join(
            f'[RAG chunk {i+1} — {c["heading"]} (score={c["score"]})]:\n{c["text"]}'
            for i, c in enumerate(rag_chunks)
        )
    else:
        all_laws = '\n\n'.join(
            f'[{k.upper()}] {FIFA_LAWS[k][0]}:\n{FIFA_LAWS[k][1][:280]}'
            for k in ('handball', 'foul', 'tackle', 'offside', 'simulation')
        )

    # --- Filename hint — only if it contains sport-specific keywords ---
    fn_lower = (filename or '').lower()
    sport_keywords = ('offside', 'handball', 'tackle', 'foul', 'penalty', 'freekick', 'free kick',
                      'red card', 'yellow card', 'simulation', 'dive', 'header', 'goal')
    fn_useful = filename and fn_lower not in _GENERIC_FILENAMES and any(k in fn_lower for k in sport_keywords)
    filename_hint = f'CLIP NAME: "{filename}" — use keywords in filename as additional context.\n' if fn_useful else ''

    # --- Motion block for prompt ---
    if motion['trackable']:
        motion_block = (
            f'• Ball motion: {motion["direction"]}, {motion["speed_desc"]}\n'
            f'• Distance covered (normalised): {motion["total_distance"]:.3f}\n'
            f'• Start pos: x={motion["start_pos"]["x"]} y={motion["start_pos"]["y"]} → '
            f'End pos: x={motion["end_pos"]["x"]} y={motion["end_pos"]["y"]}'
        )
    else:
        motion_block = f'• Ball motion: not trackable ({motion["frames_with_ball"]} frames with ball detected)'

    formation_block = '\n'.join(f'  · {f}' for f in formation.get('formations', ['N/A']))

    frame_narrative = '\n'.join(frame_lines)
    prompt = f"""You are a FIFA VAR (Video Assistant Referee) AI system.

{filename_hint}
YOLOV8 FRAME-BY-FRAME ({cv_data['duration_seconds']}s · {cv_data['sampled_frames']} frames sampled · {fps:.0f} fps):
{frame_narrative}

AGGREGATED CV SIGNALS:
• Players / frame (avg): {avg_persons:.1f}
• Ball detected: {ball_frames}/{cv_data['sampled_frames']} frames
• Ball height: {'arm/chest level' if avg_ball_h < 0.40 else 'upper-body' if avg_ball_h < 0.52 else 'foot/ground level'} (mean y={avg_ball_h:.2f}, 0=top 1=bottom)
{motion_block}
• Max player bounding-box overlap: {max_overlap:.5f} ({'significant contact' if max_overlap > 0.04 else 'light contact' if max_overlap > 0.015 else 'no direct contact'})
• Frames with contact: {contact_count}
• Player formation:
{formation_block}

INCIDENT CLASSIFICATION RULES (apply strictly to the CV signals above):
  handball  → ball at arm/chest height (y<0.40) AND overlapping a player's upper-body region
  foul      → player contact (overlap>0.015) without ball at foot level
  tackle    → heavy player overlap (>0.04) WITH ball present at foot level
  offside   → tight horizontal player cluster AND ball in forward third (x>0.65 or x<0.35)
  free_kick → defensive wall detected (≥3 aligned players) AND ball slow/stationary + no contact
  simulation → no contact (overlap≈0) but a player disappears/count drops mid-clip
  no_incident → ball moving freely, no contact, no formation anomaly

IMPORTANT: Only assert what the CV data clearly shows. If you are not confident, lower the confidence score. Do NOT invent details not visible in the data.

FIFA LAWS:
{all_laws}

Respond with ONLY valid JSON — no prose before or after:
{{
  "incident_type": "handball | foul | tackle | offside | free_kick | simulation | no_incident",
  "what_happened": "1 precise sentence grounded in the CV signals (mention ball height, contact, formation)",
  "law_applied": "Law 11 – Offside OR Law 12 – Fouls and Misconduct",
  "law_number": "Law 11 OR Law 12",
  "correct_decision": "FOUL | NO FOUL | HANDBALL | NO HANDBALL | OFFSIDE | ONSIDE | FREE KICK AWARDED | YELLOW CARD | RED CARD | PENALTY | NO REVIEW NEEDED",
  "var_action": "OVERTURNED | UPHELD | NO REVIEW NEEDED",
  "reasoning": "2 sentences citing the specific clause and how the CV evidence supports it",
  "confidence": 0.00
}}"""

    raw = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
    ).choices[0].message.content.strip()

    try:
        start, end = raw.find('{'), raw.rfind('}') + 1
        verdict = json.loads(raw[start:end])
        # Normalise law_number to only Law 11 / Law 12
        ln = str(verdict.get('law_number', ''))
        if '11' in ln:
            verdict['law_number'] = 'Law 11'
        else:
            verdict['law_number'] = 'Law 12'
    except Exception:
        verdict = {
            'incident_type': 'no_incident',
            'what_happened': 'CV analysis completed; no clear incident detected in the available frames.',
            'law_applied': 'Law 12 – Fouls and Misconduct',
            'law_number': 'Law 12',
            'correct_decision': 'NO REVIEW NEEDED',
            'var_action': 'NO REVIEW NEEDED',
            'reasoning': raw[:350] if raw else 'Verdict generation failed.',
            'confidence': 0.50,
        }

    # Pick the most visually interesting frame for the detection preview.
    # Prefer frames where the ball is visible (+8 bonus) so the preview is informative even on no-contact clips.
    best_frame = max(frames, key=lambda f: f['max_player_overlap'] * 10 + f['person_count'] + (8 if f['ball_found'] else 0), default=None)
    detection_preview = None
    if best_frame:
        t_sec = round(best_frame['frame'] / max(fps, 1), 2)
        detection_preview = {
            'timestamp': t_sec,
            'persons': best_frame.get('persons', [])[:8],
            'ball': best_frame.get('ball'),
            'max_overlap': round(best_frame['max_player_overlap'], 5),
            'contact': best_frame['max_player_overlap'] > 0.015,
        }

    # Surface the actual FIFA law text that grounded this verdict
    incident_key = verdict.get('incident_type', 'foul')
    if incident_key not in FIFA_LAWS:
        incident_key = 'foul'
    law_name, law_text = get_relevant_law(incident_key)

    # --- Granite Guardian trust verification ---
    top_rag_score = rag_chunks[0]['score'] if rag_chunks else None
    law_ctx = rag_chunks[0]['text'] if rag_chunks else FIFA_LAWS.get(incident_key, ('', ''))[1]
    guardian_result = _guardian_check(
        verdict_text=verdict.get('reasoning', '') + ' ' + verdict.get('what_happened', ''),
        law_context=law_ctx,
        rag_score=top_rag_score,
    )

    # --- Guardian Auto-Heal: HIGH risk → regenerate with law-anchored prompt ---
    # Unlike offline adversarial probes, this corrects hallucinations at inference time.
    if guardian_result.get('risk_label') == 'HIGH':
        _, law_text_tight = get_relevant_law(incident_key)
        heal_prompt = f"""You are a FIFA VAR referee. Base your verdict ONLY on the FIFA law text below.
Do not introduce any rules, clauses, or facts not explicitly stated in it.

FIFA LAW (ground truth — cite only this):
{law_text_tight[:800]}

VIDEO EVIDENCE (CV signals):
{frame_narrative}

Respond with ONLY valid JSON:
{{
  "incident_type": "handball | foul | tackle | offside | free_kick | simulation | no_incident",
  "what_happened": "1 precise sentence grounded in the CV signals",
  "law_applied": "Law 11 – Offside OR Law 12 – Fouls and Misconduct",
  "law_number": "Law 11 OR Law 12",
  "correct_decision": "FOUL | NO FOUL | HANDBALL | NO HANDBALL | OFFSIDE | ONSIDE | FREE KICK AWARDED | YELLOW CARD | RED CARD | PENALTY | NO REVIEW NEEDED",
  "var_action": "OVERTURNED | UPHELD | NO REVIEW NEEDED",
  "reasoning": "2 sentences citing the specific clause and how CV evidence supports it",
  "confidence": 0.00
}}"""
        try:
            raw2 = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": heal_prompt}],
                max_tokens=300,
            ).choices[0].message.content.strip()
            s2, e2 = raw2.find('{'), raw2.rfind('}') + 1
            verdict2 = json.loads(raw2[s2:e2])
            ln2 = str(verdict2.get('law_number', ''))
            verdict2['law_number'] = 'Law 11' if '11' in ln2 else 'Law 12'
            verdict = verdict2
            guardian_result2 = _guardian_check(
                verdict_text=verdict.get('reasoning', '') + ' ' + verdict.get('what_happened', ''),
                law_context=law_ctx,
                rag_score=top_rag_score,
            )
            guardian_result2['auto_corrected'] = True
            guardian_result2['original_risk'] = 'HIGH'
            guardian_result = guardian_result2
        except Exception as heal_err:
            print(f'[Guardian Auto-Heal] Regeneration failed: {heal_err}')
            guardian_result['auto_corrected'] = False
    else:
        guardian_result['auto_corrected'] = False

    return {
        **verdict,
        'limitations': LIMITATIONS['var_oracle'],
        'guardian_check': guardian_result,
        'detection_preview': detection_preview,
        'law_chunk': {
            'name': rag_chunks[0]['heading'] if rag_chunks else law_name,
            'text': rag_chunks[0]['text'] if rag_chunks else law_text,
            'source': 'Docling RAG — semantic retrieval' if rag_used else (
                'Docling PDF parse' if (os.path.exists(os.path.join(os.path.dirname(__file__), 'fifa_laws.pdf')) and DOCLING_AVAILABLE)
                else 'FIFA Laws of the Game (hardcoded excerpt)'
            ),
            'rag_chunks': rag_chunks,
            'rag_query': rag_query if rag_used else None,
        },
        'cv_findings': {
            'duration_seconds': cv_data['duration_seconds'],
            'frames_analysed': cv_data['sampled_frames'],
            'ball_frame_count': ball_frames,
            'players_detected': round(avg_persons),
            'contact_detected': max_overlap > 0.015,
            'ball_height': 'arm/chest' if avg_ball_h < 0.40 else 'upper body' if avg_ball_h < 0.52 else 'lower body',
            'ball_trajectory': traj_desc,
            'ball_speed': motion.get('speed_desc', 'unknown'),
            'player_spread': spread_desc,
            'docling_used': DOCLING_AVAILABLE and os.path.exists(os.path.join(os.path.dirname(__file__), 'fifa_laws.pdf')),
            'rag_used': rag_used,
        },
    }


def analyse_clip(video_path: str, filename: str = '') -> dict:
    """Full pipeline: YOLOv8 → motion + formation analysis → Granite verdict."""
    cv_data = analyse_video_frames(video_path)
    _, cv_details = classify_incident(cv_data)
    return generate_verdict(cv_data, cv_details, filename)
