from flask import Flask, render_template, request, jsonify, session
import os
import pathlib
import random
from collections import Counter

app = Flask(__name__)

app.secret_key = os.environ.get("SECRET_KEY", "dev-key")

wordlist = pathlib.Path("wordle_words.txt").read_text().splitlines()
WORDS = [w.strip().upper() for w in wordlist if len(w.strip()) == 5]
WORD_SET = set(WORDS)


def new_game():
    session["word"] = random.choice(WORDS)
    session["guesses"] = []
    session["done"] = False
    session["win"] = False
    session.modified = True


@app.route("/")
def index():
    if "word" not in session or session.get("done"):
        new_game()
    return render_template("index.html", title="LexiGuess")


@app.route("/state", methods=["GET"])
def state():
    return jsonify({
        "guesses": session.get("guesses", []),
        "win": session.get("win", False),
        "lose": session.get("done", False) and not session.get("win", False),
        "target": session["word"] if session.get("done") and not session.get("win") else None
    })


def score_guess(guess: str, target: str):
    res = ["wrong"] * 5
    counts = Counter(target)

    for i, ch in enumerate(guess):
        if ch == target[i]:
            res[i] = "correct"
            counts[ch] -= 1

    for i, ch in enumerate(guess):
        if res[i] == "correct":
            continue
        if counts[ch] > 0:
            res[i] = "misplaced"
            counts[ch] -= 1
        else:
            res[i] = "wrong"

    return res


@app.route("/guess", methods=["POST"])
def guess():
    if session.get("done"):
        return jsonify({"error": "Game is over. Press Reset to play again."}), 400

    data = request.get_json(silent=True) or {}
    guess_word = (data.get("guess") or "").strip().upper()

    if len(guess_word) != 5:
        return jsonify({"error": "Guess must be exactly 5 letters."}), 400
    if guess_word not in WORD_SET:
        return jsonify({"error": "Not in word list."}), 400

    target = session["word"]
    feedback = score_guess(guess_word, target)

    session["guesses"].append({"word": guess_word, "feedback": feedback})
    win = guess_word == target
    out_of_guesses = len(session["guesses"]) >= 6

    if win:
        session["done"] = True
        session["win"] = True
    elif out_of_guesses:
        session["done"] = True
        session["win"] = False

    session.modified = True

    return jsonify({
        "feedback": feedback,
        "guesses": session["guesses"],
        "win": win,
        "lose": out_of_guesses and not win,
        "target": target if out_of_guesses and not win else None
    })


@app.route("/reset", methods=["POST"])
def reset():
    new_game()
    return jsonify({"message": "Game reset."})


if __name__ == "__main__":
    app.run(debug=True)
