"""One-time generator: creates backend/var_oracle/fifa_laws.pdf for Docling parsing."""
import os
from fpdf import FPDF

def _clean(text: str) -> str:
    return (text
        .replace('—', '-').replace('–', '-')
        .replace('‘', "'").replace('’', "'")
        .replace('“', '"').replace('”', '"')
        .replace('•', '*')
    )


LAWS = [
    ("Law 1 - The Field of Play",
     "The field of play must be a rectangular surface of natural or artificial grass. "
     "The field is divided by a halfway line. The centre mark is at the midpoint of the halfway line. "
     "A circle with a radius of 9.15 m (10 yds) is marked around it. "
     "Goal area: two lines are drawn at right angles to the goal line, 5.5 m from the inside of each goalpost. "
     "Penalty area: two lines are drawn at right angles to the goal line, 18.32 m from the inside of each goalpost. "
     "The penalty mark is 11 m from the midpoint between the goalposts. "
     "The penalty arc is drawn outside the penalty area with a radius of 9.15 m from the penalty mark."),

    ("Law 2 – The Ball",
     "The ball is spherical and made of leather or other suitable material. "
     "Circumference: 68-70 cm. Weight: 410-450 g at the start of the match. "
     "Pressure: 0.6-1.1 atm. If the ball becomes defective during play, the game is stopped "
     "and restarted with a dropped ball. A defective ball does not void goals scored."),

    ("Law 3 – The Players",
     "A match is played by two teams of eleven players each, one of whom is the goalkeeper. "
     "A match may not start if either team has fewer than seven players. "
     "Each team may use a maximum of five substitutes in a match (three substitute opportunities, "
     "plus one extra at half-time and in extra time). An extra substitute opportunity is available "
     "if a player suffers a concussion. The referee must be informed of all substitutions. "
     "A player who has been sent off may not re-enter the field."),

    ("Law 4 – The Players' Equipment",
     "Compulsory equipment: shirt, shorts, socks, shinguards (covered by socks), footwear. "
     "Players must not wear anything dangerous to themselves or others. "
     "Goalkeepers must wear colours that distinguish them from other players and the match officials. "
     "Players may wear headgear that is not dangerous and is coloured to match the shirt. "
     "Electronic performance and tracking systems (EPTS) worn by players must be approved by the referee."),

    ("Law 5 – The Referee",
     "Each match is controlled by a referee who has full authority to enforce the Laws. "
     "The referee enforces the Laws of the Game, applies the advantage clause, keeps a record of the match, "
     "stops play when a player is seriously injured, takes disciplinary action against players and officials, "
     "acts on advice from the assistant referee and fourth official. "
     "Decisions of the referee regarding facts connected with play (including whether a goal is scored and "
     "the result of the match) are final. The referee may only change a decision on realising it is incorrect "
     "or on the advice of an assistant referee or VAR, provided play has not restarted."),

    ("Law 6 – The Other Match Officials",
     "Other match officials: two assistant referees, fourth official, reserve assistant referee, "
     "video assistant referee (VAR), and assistant VAR (AVAR). "
     "Assistant referees signal when: the whole of the ball has left the field of play, "
     "the team entitled to a corner kick, goal kick or throw-in, a player may be penalised "
     "for being in an offside position, a substitution is requested, misconduct or incident occurs. "
     "The VAR assists the referee only for clear and obvious errors or serious missed incidents in "
     "four match-changing situations: goal/no goal, penalty/no penalty, direct red card, mistaken identity."),

    ("Law 7 – The Duration of the Match",
     "A match lasts for two equal halves of 45 minutes each. The halftime interval must not exceed 15 minutes. "
     "Allowance is made by the referee for time lost through substitutions, assessment/removal of injured players, "
     "wasting time, disciplinary sanctions, VAR reviews, goal celebrations, and other stoppages. "
     "The additional time allowance is communicated by the fourth official at the end of the half. "
     "Extra time (two further periods of 15 minutes) may be played if the rules of the competition require "
     "a result. The away-goals rule no longer applies in UEFA competitions from 2021-22."),

    ("Law 8 – The Start and Restart of Play",
     "A kick-off starts each half and restarts play after a goal has been scored. "
     "At kick-off the ball is in play when it is kicked and clearly moves. "
     "A goal may be scored directly from the kick-off. "
     "If the ball touches an outside agent after a kick-off, play is restarted with a dropped ball. "
     "A dropped ball is used to restart play when the referee has stopped play for any reason "
     "not specifically catered for in the Laws. The ball is dropped for the goalkeeper if inside "
     "the penalty area, otherwise for a player of the team last in possession."),

    ("Law 9 – The Ball In and Out of Play",
     "The ball is out of play when it has wholly crossed the goal line or touchline on the ground or in the air, "
     "or when play has been stopped by the referee. "
     "The ball is in play at all other times, including when it rebounds from a goalpost, crossbar or corner "
     "flagpost and remains in the field of play, and when it touches a match official who remains on the field."),

    ("Law 10 – Determining the Outcome of a Match",
     "A goal is scored when the whole of the ball passes over the goal line, between the goalposts and under "
     "the crossbar, provided no offence has been committed by the team scoring the goal. "
     "If extra time is required and the score is still level, the rules of the competition determine how a "
     "winner is found: penalty shoot-out, drawing of lots, or replaying the match. "
     "The team scoring the greater number of goals wins the match."),

    ("Law 11 – Offside",
     "Offside Position: A player is in an offside position if any part of the head, body or feet is in the "
     "opponents' half (excluding the halfway line) AND nearer to the opponents' goal line than both the ball "
     "and the second-last opponent. Hands and arms of all players (including goalkeepers) are not considered.\n\n"
     "Offside Offence: A player in an offside position at the moment the ball is played or touched by a "
     "teammate is only penalised if they become involved in active play by: "
     "interfering with play (touching the ball played by a teammate), "
     "interfering with an opponent (preventing the opponent from playing the ball by clearly obstructing "
     "the opponent's line of vision or movements or making a gesture or movement which fools the opponent), "
     "or gaining an advantage from being in that position.\n\n"
     "No Offence: There is no offside offence if a player receives the ball directly from: "
     "a goal kick, a throw-in, or a corner kick.\n\n"
     "VAR and Offside: VAR uses a calibrated offside line to determine if a player is in an offside position. "
     "The on-field decision is reversed only when there is a clear and obvious error. The lines are drawn "
     "at the last defensive player and the attacker's body part that is closest to the goal line."),

    ("Law 12 – Fouls and Misconduct",
     "Direct Free Kick: A direct free kick is awarded if a player commits any of the following against "
     "an opponent in a manner considered by the referee to be careless, reckless or using excessive force: "
     "kicks or attempts to kick, trips or attempts to trip, charges, jumps at, strikes or attempts to strike, "
     "pushes, or tackles/challenges.\n\n"
     "A direct free kick is also awarded if a player: commits a handball offence, holds an opponent, "
     "impedes an opponent with contact.\n\n"
     "Handball: A handball offence occurs when a player (other than the goalkeeper in their own penalty area) "
     "deliberately touches the ball with their hand or arm, or touches it when the hand/arm is in an "
     "unnaturally extended position making the body bigger, or scores directly from the hand/arm.\n\n"
     "Penalty Kick: A penalty kick is awarded when any of the above offences are committed by a player "
     "inside their own penalty area regardless of where the ball is, provided the ball is in play.\n\n"
     "Indirect Free Kick: An indirect free kick is awarded if a player plays in a dangerous manner, "
     "impedes the progress of an opponent without contact, or prevents the goalkeeper from releasing the ball.\n\n"
     "Disciplinary Action:\n"
     "Yellow Card (Caution): unsporting behaviour, dissent, persistent infringement, delaying restart, "
     "failing to respect required distance, entering/re-entering without permission, deliberate handball.\n"
     "Red Card (Sending-Off): serious foul play, violent conduct, biting or spitting at an opponent, "
     "denying an obvious goal-scoring opportunity (DOGSO), offensive/insulting/abusive language/gestures, "
     "receiving a second caution.\n\n"
     "VAR Review: VAR may review penalty/no penalty, red card/no red card decisions. "
     "Serious foul play (excessive force) resulting in a missed red card is a reviewable incident."),

    ("Law 13 – Free Kicks",
     "Free kicks are direct or indirect. For both types, the ball must be stationary when the kick is taken. "
     "The kicker may not touch the ball again until it has touched another player. "
     "All opponents must be at least 9.15 m from the ball until it is in play, unless standing on their own "
     "goal line between the goalposts. "
     "A free kick taken from inside the penalty area by the defending team is in play when it leaves the area. "
     "A goal can be scored directly from a direct free kick (against the opposing team). "
     "A goal cannot be scored directly from an indirect free kick."),

    ("Law 14 – The Penalty Kick",
     "A penalty kick is awarded when a player commits an offence inside their own penalty area. "
     "The ball is placed on the penalty mark (11 m from the goal). "
     "The player taking the kick must be identified to the referee. "
     "Only the designated kicker and the goalkeeper may be in the penalty area at the time of the kick. "
     "The goalkeeper must have at least part of one foot on or in line with the goal line at the moment "
     "the kick is taken. "
     "If the goalkeeper moves off the line before the kick and the kick is missed, the kick is retaken. "
     "A goal can be scored from a penalty kick."),

    ("Law 15 – The Throw-In",
     "A throw-in is a method of restarting play when the whole of the ball passes over the touchline. "
     "A throw-in is awarded to the opponents of the player who last touched the ball. "
     "A goal cannot be scored directly from a throw-in. "
     "At the moment of delivering the ball, the thrower: faces the field of play, "
     "has part of each foot on the touchline or outside the touchline, "
     "holds the ball with both hands and delivers it from behind and over the head from the point "
     "where it left the field of play."),

    ("Law 16 – The Goal Kick",
     "A goal kick is a method of restarting play when the whole of the ball passes over the goal line "
     "without a goal being scored and having last been touched by an attacking team player. "
     "The ball is kicked from anywhere inside the goal area. "
     "Opponents must be outside the penalty area until the ball is in play. "
     "The ball is in play when it is kicked and clearly moves. "
     "A goal can be scored directly from a goal kick against the opposing team."),

    ("Law 17 – The Corner Kick",
     "A corner kick is a method of restarting play when the whole of the ball passes over the goal line "
     "without a goal being scored, having last been touched by a defending team player. "
     "The ball is placed in the corner area nearest to where it crossed the goal line. "
     "Opponents must be at least 9.15 m from the corner arc until the ball is in play. "
     "The ball is in play when it is kicked and clearly moves. "
     "A goal can be scored directly from a corner kick."),
]


def generate():
    out_path = os.path.join(os.path.dirname(__file__), 'fifa_laws.pdf')

    from fpdf.enums import XPos, YPos

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font('Helvetica', 'B', 20)
    pdf.cell(0, 12, _clean('FIFA Laws of the Game 2024/25'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 8, _clean('International Football Association Board (IFAB) - Official Summary'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.ln(6)

    for law_title, law_text in LAWS:
        pdf.set_font('Helvetica', 'B', 12)
        pdf.set_fill_color(20, 83, 45)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 8, _clean(law_title), new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Helvetica', '', 10)
        pdf.ln(2)

        for paragraph in law_text.split('\n\n'):
            pdf.multi_cell(0, 6, _clean(paragraph.strip()))
            pdf.ln(2)
        pdf.ln(4)

    pdf.output(out_path)
    print(f'Generated: {out_path}')


if __name__ == '__main__':
    generate()
