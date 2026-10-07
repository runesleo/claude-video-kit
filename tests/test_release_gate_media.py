"""Local synthetic-media acceptance; no renderer, accounts, or paid services."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_video_release_gate import MODULE, SCRIPT


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg/ffprobe required")
class ReleaseGateMediaTests(unittest.TestCase):
    def test_real_media_evaluate_verify_handoff_and_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            video, cover = project / "final.mp4", project / "cover.png"

            def run(command):
                return subprocess.run(command, capture_output=True, text=True)

            generated = run([
                "ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=320x180:r=12:d=2",
                "-f", "lavfi", "-i", "sine=f=1000:r=48000:d=2", "-af",
                "pan=stereo|c0=c0|c1=c0,loudnorm=I=-14:TP=-1.5:LRA=8,aresample=48000",
                "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", str(video),
            ])
            self.assertEqual(generated.returncode, 0, generated.stderr)
            generated = run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                             "color=c=navy:s=1920x1080", "-frames:v", "1", "-threads", "1", str(cover)])
            self.assertEqual(generated.returncode, 0, generated.stderr)

            # Test fixtures attest only to these synthetic bytes, never to real content.
            review_data = MODULE.review_template("bilibili")
            review_data.update(status="PASS", producer_id="fixture-producer", reviewer_id="fixture-reviewer",
                               video_sha256=MODULE.sha256_file(video), cover_sha256=MODULE.sha256_file(cover),
                               reviewed_at="2026-10-07T00:00:00Z")
            review_data["quality_scores"] = {key: 5 for key in review_data["quality_scores"]}
            review_data["checks"] = {key: True for key in review_data["checks"]}
            review = project / "FINAL-REVIEW.json"
            review.write_text(json.dumps(review_data))
            qas = [project / name for name in ("FACT-CHECK.md", "AUDIO-QA.md", "RENDER-QA.md")]
            for qa in qas:
                qa.write_text(f"Synthetic fixture final_video_sha256: {review_data['video_sha256']}\n")
            receipt = project / "VIDEO-RELEASE-GATE.json"
            command = [sys.executable, str(SCRIPT), "evaluate", "--project-dir", str(project),
                       "--video", str(video), "--cover", str(cover), "--platform", "bilibili",
                       "--fact-qa", str(qas[0]), "--audio-qa", str(qas[1]), "--render-qa", str(qas[2]),
                       "--review-receipt", str(review), "--output", str(receipt)]
            evaluated = run(command)
            self.assertEqual(evaluated.returncode, 0, evaluated.stderr + evaluated.stdout)
            evidence = json.loads(evaluated.stdout)
            self.assertEqual(evidence["status"], "PASS")
            self.assertEqual((evidence["cover"]["width"], evidence["cover"]["height"]), (1920, 1080))
            self.assertTrue(evidence["audio"]["representative_windows"])
            verify = [sys.executable, str(SCRIPT), "verify", "--receipt", str(receipt),
                      "--video", str(video), "--cover", str(cover), "--platform", "bilibili"]
            verified = run(verify)
            self.assertEqual(verified.returncode, 0, verified.stdout + verified.stderr)

            (project / "script.json").write_text('{"title":"Synthetic release test"}')
            (project / "metadata.json").write_text('{"fps":12,"slides":[]}')
            pack = run(["node", str(SCRIPT.with_name("build-distribute-pack.mjs")), str(project),
                        "--platform", "bilibili", "--video", str(video), "--cover", str(cover),
                        "--release-receipt", str(receipt)])
            self.assertEqual(pack.returncode, 0, pack.stderr)
            self.assertTrue((project / "distribute/bilibili/05-release-handoff.json").is_file())

            qas[0].write_text("changed after evaluation")
            drift = run(verify)
            self.assertEqual(drift.returncode, 2)
            self.assertIn("fact QA changed", drift.stdout)
            qas[0].write_text(f"final_video_sha256: {review_data['video_sha256']}\n")

            short_audio = project / "short-audio.mp4"
            generated = run(["ffmpeg", "-v", "error", "-i", str(video), "-filter_complex",
                             "[0:a]atrim=duration=0.5[a]", "-map", "0:v", "-map", "[a]",
                             "-c:v", "copy", "-c:a", "aac", str(short_audio)])
            self.assertEqual(generated.returncode, 0, generated.stderr)
            review_data["video_sha256"] = MODULE.sha256_file(short_audio)
            review.write_text(json.dumps(review_data))
            for qa in qas:
                qa.write_text(f"final_video_sha256: {review_data['video_sha256']}\n")
            audio_gap = run([str(short_audio) if item == str(video) else item for item in command])
            self.assertEqual(audio_gap.returncode, 2, audio_gap.stdout + audio_gap.stderr)
            self.assertIn("audio timeline", audio_gap.stdout)

            multi_audio = project / "multi-audio.mp4"
            generated = run(["ffmpeg", "-v", "error", "-i", str(video), "-f", "lavfi", "-t", "2",
                             "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a", "-map", "0:a",
                             "-c:v", "copy", "-c:a", "aac", "-disposition:a:0", "0",
                             "-disposition:a:1", "default", str(multi_audio)])
            self.assertEqual(generated.returncode, 0, generated.stderr)
            review_data["video_sha256"] = MODULE.sha256_file(multi_audio)
            review.write_text(json.dumps(review_data))
            for qa in qas:
                qa.write_text(f"final_video_sha256: {review_data['video_sha256']}\n")
            ambiguous = run([str(multi_audio) if item == str(video) else item for item in command])
            self.assertEqual(ambiguous.returncode, 2, ambiguous.stdout + ambiguous.stderr)
            self.assertIn("exactly one video and one audio stream", ambiguous.stdout)

            cover.unlink()
            missing = run(command)
            self.assertEqual(missing.returncode, 2)
            self.assertEqual(json.loads(receipt.read_text())["status"], "FAIL")
