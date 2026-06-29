"""
Honest-limitations layer.

Every AI verdict in Pitch Intel ships with an explicit list of what the
underlying data and method *cannot* tell you. Surfacing blind spots is a
deliberate trust feature: the model is allowed to reason only over what the
data supports, and the UI states the rest plainly rather than implying
certainty the pipeline does not have.

Keyed by module. Each entry is a short, factual constraint of the data/method,
not a disclaimer template.
"""

LIMITATIONS = {
    'var_oracle': [
        "Computer vision reads player and ball positions — it cannot judge intent or the force of contact.",
        "There is no audio, no second camera, and no replay angle: a single clip is not the full VAR booth view.",
        "The verdict reflects the FIFA law text plus what YOLOv8 detected, not the on-field referee's actual signal.",
        "Low detection confidence on a blurry or wide clip lowers verdict reliability — the confidence score reflects this.",
    ],
    'tactical': [
        "xG is a model estimate of chance quality, not a record of which shots 'should' have gone in.",
        "Formation is inferred from average player positions — it is a heuristic, not the coach's stated shape.",
        "Event data does not capture injuries, weather, dressing-room context, or instructions given off the ball.",
    ],
    'referee': [
        "This measures statistical symmetry of decisions, not whether any individual call was correct.",
        "Contact severity, player intent, and VAR interventions are not visible in the event data.",
        "Referees with few matches in the dataset have smaller samples, so their figures are less stable.",
    ],
    'emoti_pulse': [
        "Atmosphere is scored from on-pitch events — it does not measure actual crowd noise or sentiment.",
        "The weighting (goals, shots, cards, pressure) is a designed heuristic, not a measured emotion.",
        "Tense goalless phases can score low even when the stadium is electric.",
    ],
    'match_explainer': [
        "The narrative is built only from StatsBomb event data for this match — nothing is added from outside it.",
        "Stats describe what happened, not why: tactical and human context beyond the numbers is not captured.",
    ],
    'scout_eye': [
        "Search ranks players on World Cup event data only — club form and recent seasons are not included.",
        "Sample sizes vary: a player with few tournament minutes can rank high on a small, noisy sample.",
    ],
    'what_if': [
        "Each shot's xG is treated as an independent scoring probability; the simulation does not model game state, fatigue, red cards, or tactical changes.",
        "Removing a goal removes only that one shot — it does not re-derive how the rest of the match would have been played in response.",
        "Probabilities come from 10,000 Monte Carlo runs on a fixed seed: reproducible and computed from real data, but still a model estimate, not a prediction of reality.",
    ],
    'audio_match': [
        "The audio description covers the headline events in the StatsBomb data (goals, cards, substitutions) — it is not a continuous play-by-play of every touch.",
        "Spoken output uses the browser's built-in text-to-speech; voice quality and language coverage depend on the user's device.",
        "It conveys what happened from event data, not the live emotion, crowd, or visual drama a sighted viewer would also take in.",
    ],
}
