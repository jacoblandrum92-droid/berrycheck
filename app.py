import os, base64, json, anthropic
from flask import Flask, request, jsonify, render_template
from datetime import datetime

app = Flask(__name__)
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

# Holds the most recent analysis result for the dashboard to poll
latest_result = {}

VISION_PROMPT = """You are analyzing a blueberry QC sample tray image.

The operator has spread berries across a white tray and physically sorted defects into corners:
- BOTTOM RIGHT corner: soft berries placed there by operator
- BOTTOM LEFT corner: red / unripe berries placed there by operator  
- TOP RIGHT corner: berries with suspected anthracnose lesions (dark sunken spots)
- CENTER FIELD: all remaining berries (the main population)

Your job is to count berries in each zone as accurately as possible.

Respond ONLY with a valid JSON object, no other text, no markdown:
{
  "total": <integer, ALL berries visible on tray>,
  "softs": <integer, berries in bottom right corner>,
  "reds": <integer, berries in bottom left corner>,
  "anthracnose": <integer, berries in top right corner>,
  "uv_flag": false,
  "notes": "<one sentence observation about the sample, or empty string>"
}

If a corner appears empty, use 0. If the image is too dark or blurry to count accurately, still give your best estimate and note it."""


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


@app.route("/capture")
def capture():
    return render_template("capture.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    global latest_result

    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    # Strip data URL prefix if present
    image_data = data["image"]
    if "," in image_data:
        image_data = image_data.split(",")[1]

    try:
        response = client.messages.create(
            model="claude-opus-4-5",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": image_data,
                            },
                        },
                        {"type": "text", "text": VISION_PROMPT},
                    ],
                }
            ],
        )

        raw = response.content[0].text.strip()
        # Strip markdown fences if model wraps anyway
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        counts = json.loads(raw.strip())

        counts["timestamp"] = datetime.now().strftime("%H:%M:%S")
        counts["image_thumb"] = "data:image/jpeg;base64," + image_data[:200]  # tiny ref
        latest_result = counts

        return jsonify(counts)

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Vision response parse error: {str(e)}", "raw": raw}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/latest")
def latest():
    return jsonify(latest_result)


if __name__ == "__main__":
    # 0.0.0.0 makes it reachable from iPhone on same WiFi
    app.run(host="0.0.0.0", port=5000, debug=True)
