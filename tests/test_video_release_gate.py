import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "video_release_gate.py"
SPEC = importlib.util.spec_from_file_location("video_release_gate", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class VideoReleaseGateTests(unittest.TestCase):
    def setUp(self):
        tools = patch.object(MODULE, "require_media_tools", return_value=[])
        tools.start()
        self.addCleanup(tools.stop)

    def _passing_release(self, root, platform="bilibili", **overrides):
        canonical, project, video, cover, qas, review = self._fixture(root)
        review_data = json.loads(review.read_text())
        review_data["platform"] = platform
        review.write_text(json.dumps(review_data))
        video_probe = dict(duration_s=60.0, width=1920, height=1080,
                           audio_sample_rate=48000, audio_channels=2,
                           has_video=True, has_audio=True, video_start_s=0.0,
                           audio_start_s=0.0, audio_duration_s=60.0,
                           video_stream_count=1, audio_stream_count=1)
        cover_probe = dict(width=1920, height=1080, has_video=True)
        arguments = dict(project_dir=project, video=video, platform=platform,
                         cover=cover, fact_qa=qas[0], audio_qa=qas[1], render_qa=qas[2],
                         review_receipt_path=review, canonical_root=canonical,
                         measure_audio=False,
                         audio_metrics=dict(integrated_lufs=-14.0, lra_lu=5.0, true_peak_dbtp=-2.0),
                         window_metrics=[dict(mean_db=-23.0, silence_ratio=0.1)] * 3)
        arguments.update(overrides)
        with patch.object(MODULE, "probe_media", side_effect=[video_probe, cover_probe]):
            result = MODULE.evaluate_release(**arguments)
        receipt = project / "VIDEO-RELEASE-GATE.json"
        receipt.write_text(json.dumps(result))
        return project, video, cover, qas, review, receipt, result

    def test_complete_receipt_verifies(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, video, cover, qas, review, receipt, result = self._passing_release(Path(tmp))
            self.assertEqual(result["status"], "PASS", result["failures"])
            self.assertEqual(MODULE.verify_pass_receipt(receipt, video, "bilibili", cover), [])

    def test_explicit_project_is_default_scope(self):
        with tempfile.TemporaryDirectory() as tmp:
            *_, result = self._passing_release(Path(tmp), canonical_root=None)
            self.assertEqual(result["status"], "PASS", result["failures"])

    def test_verify_requires_all_three_qa_bindings(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, _, receipt, result = self._passing_release(Path(tmp))
            for label in ("fact", "audio", "render"):
                with self.subTest(label=label):
                    changed = json.loads(json.dumps(result))
                    del changed["qa"][label]
                    receipt.write_text(json.dumps(changed))
                    self.assertTrue(MODULE.verify_pass_receipt(receipt, video, "bilibili", cover))

    def test_verify_revalidates_review_not_just_its_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, review, receipt, result = self._passing_release(Path(tmp))
            data = json.loads(review.read_text())
            data["reviewer_id"] = data["producer_id"]
            review.write_text(json.dumps(data))
            result["independent_review"]["sha256"] = MODULE.sha256_file(review)
            receipt.write_text(json.dumps(result))
            self.assertIn("producer cannot approve their own final asset",
                          MODULE.verify_pass_receipt(receipt, video, "bilibili", cover))

    def test_verify_rejects_changes_during_verification(self):
        for target in ("video", "receipt"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as tmp:
                _, video, cover, _, _, receipt, _ = self._passing_release(Path(tmp))
                original = MODULE.qa_binds_hash

                def mutate_after_video_check(path, digest):
                    result = original(path, digest)
                    (video if target == "video" else receipt).write_bytes(b"changed-during-verification")
                    return result

                with patch.object(MODULE, "qa_binds_hash", side_effect=mutate_after_video_check):
                    errors = MODULE.verify_pass_receipt(receipt, video, "bilibili", cover)
                self.assertTrue(any("changed during verification" in error for error in errors), errors)

    def test_verify_rejects_every_changed_binding(self):
        for target in ("video", "cover", "fact", "audio", "render", "review"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as tmp:
                _, video, cover, qas, review, receipt, _ = self._passing_release(Path(tmp))
                paths = dict(zip(("video", "cover", "fact", "audio", "render", "review"),
                                 (video, cover, *qas, review)))
                paths[target].write_bytes(b"changed")
                self.assertTrue(MODULE.verify_pass_receipt(receipt, video, "bilibili", cover))

    def test_optional_x_cover_is_still_bound_when_supplied(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, _, receipt, _ = self._passing_release(Path(tmp), platform="x")
            self.assertTrue(MODULE.verify_pass_receipt(receipt, video, "x", None))
            cover.write_bytes(b"changed")
            self.assertTrue(MODULE.verify_pass_receipt(receipt, video, "x", cover))

    def test_audio_missing_invalid_or_failed_windows_fail_closed(self):
        good = dict(integrated_lufs=-14.0, lra_lu=5.0, true_peak_dbtp=-2.0)
        for windows in ([], [{"error": 1}], [{"mean_db": None, "silence_ratio": 0}],
                        [{"mean_db": float("nan"), "silence_ratio": 0}],
                        [{"mean_db": -20, "silence_ratio": 0.9}]):
            with self.subTest(windows=windows):
                self.assertTrue(MODULE._audio_failures(good, windows))
        for key in good:
            for value in (None, float("nan"), float("inf"), True):
                with self.subTest(key=key, value=value):
                    self.assertTrue(MODULE._audio_failures({**good, key: value},
                                    [{"mean_db": -23, "silence_ratio": 0.1}]))

    def test_evaluate_requires_audio_evidence_even_in_injected_test_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            *_, result = self._passing_release(Path(tmp), audio_metrics={}, window_metrics=[])
            self.assertEqual(result["status"], "FAIL")

    def test_short_clip_silence_ratio_uses_actual_duration(self):
        measured = subprocess.CompletedProcess([], 0, "", "mean_volume: -23.0 dB\nmax_volume: -10.0 dB\nsilence_duration: 1.2\n")
        with patch.object(MODULE, "run_cmd", return_value=measured):
            windows = MODULE.measure_windows(Path("synthetic.mp4"), 2.0)
        self.assertEqual(windows[0]["window_s"], 2.0)
        self.assertEqual(windows[0]["silence_ratio"], 0.6)

    def test_evaluate_rejects_cover_size_and_platform_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            *_, result = self._passing_release(Path(tmp), platform="douyin")
            self.assertEqual(result["status"], "FAIL")
            self.assertTrue(any("cover must be 2160x2880" in x for x in result["failures"]))
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, _, receipt, _ = self._passing_release(Path(tmp))
            self.assertIn("release receipt platform mismatch", MODULE.verify_pass_receipt(receipt, video, "youtube", cover))

    def test_verify_rejects_wrong_handoff_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, _, receipt, _ = self._passing_release(Path(tmp))
            errors = MODULE.verify_pass_receipt(receipt, video, "bilibili", cover, Path(tmp))
            self.assertIn("release receipt project does not match handoff project", errors)

    def test_output_cannot_overwrite_source_evidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, video, cover, qas, review, _, _ = self._passing_release(Path(tmp))
            before = review.read_bytes()
            proc = subprocess.run([sys.executable, str(SCRIPT), "evaluate", "--project-dir", str(project),
                                   "--video", str(video), "--cover", str(cover), "--platform", "bilibili",
                                   "--fact-qa", str(qas[0]), "--audio-qa", str(qas[1]), "--render-qa", str(qas[2]),
                                   "--review-receipt", str(review), "--output", str(review)],
                                  capture_output=True, text=True)
            self.assertEqual(proc.returncode, 64)
            self.assertEqual(review.read_bytes(), before)

    def test_evaluate_rejects_assets_outside_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            outside = Path(tmp) / "outside.md"
            outside.write_text("outside")
            *_, result = self._passing_release(Path(tmp), fact_qa=outside)
            self.assertTrue(any("outside project_dir" in x for x in result["failures"]))

    def test_verify_rejects_malformed_receipt_with_json_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, video, cover, _, _, receipt, result = self._passing_release(Path(tmp))
            for field in ("video", "cover", "qa", "independent_review", "quality_profile", "audio"):
                with self.subTest(field=field):
                    changed = {**result, field: []}
                    receipt.write_text(json.dumps(changed))
                    proc = subprocess.run([sys.executable, str(SCRIPT), "verify", "--receipt", str(receipt),
                                           "--video", str(video), "--cover", str(cover), "--platform", "bilibili"],
                                          capture_output=True, text=True)
                    self.assertEqual(proc.returncode, 2, proc.stderr)
                    self.assertEqual(json.loads(proc.stdout)["status"], "FAIL")

    def test_evaluate_is_public_command_and_usage_errors_are_64(self):
        for command in ("evaluate", "issue"):
            proc = subprocess.run([sys.executable, str(SCRIPT), command, "--help"], capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("--canonical-root", proc.stdout)
        proc = subprocess.run([sys.executable, str(SCRIPT), "verify"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 64)

    def test_distribute_pack_refuses_ungated_handoff_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            (project / "script.json").write_text('{"title":"Demo"}')
            (project / "metadata.json").write_text('{"fps":30,"slides":[]}')
            proc = subprocess.run(["node", str(SCRIPT.with_name("build-distribute-pack.mjs")), str(project)],
                                  capture_output=True, text=True)
            self.assertNotEqual(proc.returncode, 0)
            self.assertFalse((project / "distribute").exists())

    def test_distribute_pack_verifies_exact_final_before_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            project, video, cover, _, _, receipt, result = self._passing_release(Path(tmp))
            (project / "script.json").write_text('{"title":"Demo"}')
            (project / "metadata.json").write_text('{"fps":30,"slides":[{"title":"Start","durationInFrames":90}]}')
            command = ["node", str(SCRIPT.with_name("build-distribute-pack.mjs")), str(project),
                       "--platform", "bilibili", "--video", str(video), "--cover", str(cover),
                       "--release-receipt", str(receipt), "--intro-offset", "3"]
            proc = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            pack = project / "distribute" / "bilibili"
            handoff = json.loads((pack / "05-release-handoff.json").read_text())
            self.assertEqual(handoff["video"]["sha256"], result["video"]["sha256"])
            self.assertEqual(handoff["release_receipt_sha256"], MODULE.sha256_file(receipt))
            self.assertEqual((pack / "03-chapters.txt").read_text().strip(), "00:03 Start")
            self.assertFalse((project / "distribute" / "xiaohongshu").exists())
            before = (pack / "01-title.txt").read_bytes()
            video.write_bytes(b"changed-final")
            (project / "script.json").write_text('{"title":"Must not hand off"}')
            proc = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(proc.returncode, 0)
            self.assertEqual((pack / "01-title.txt").read_bytes(), before)

    def _fixture(self, root: Path):
        canonical = root / "content" / "video"
        project = canonical / "2026-09-07-demo-999"
        out = project / "out"
        out.mkdir(parents=True)
        video = out / "final.mp4"
        video.write_bytes(b"video-v1")
        cover = project / "cover.png"
        cover.write_bytes(b"cover-v1")
        vsha = MODULE.sha256_file(video)
        csha = MODULE.sha256_file(cover)
        qas = []
        for name in ("FACT-CHECK-v1.md", "AUDIO-QA-v1.md", "RENDER-QA-v1.md"):
            path = project / name
            path.write_text(f"final_video_sha256: {vsha}\n", encoding="utf-8")
            qas.append(path)
        review = project / "FINAL-REVIEW-bilibili.json"
        profile = MODULE.load_quality_profile()
        checks = {name: True for name in MODULE.COMMON_REVIEW_CHECKS}
        checks.update({name: True for name in profile["required_review_checks"]})
        checks["bilibili_title_centered"] = True
        review.write_text(
            json.dumps(
                {
                    "schema": MODULE.REVIEW_SCHEMA,
                    "status": "PASS",
                    "platform": "bilibili",
                    "video_sha256": vsha,
                    "cover_sha256": csha,
                    "producer_id": "producer-session",
                    "reviewer_id": "reviewer-session",
                    "reviewed_at": "2026-09-07T12:00:00Z",
                    "quality_profile_version": profile["version"],
                    "quality_scores": {name: 5 for name in profile["minimum_scores"]},
                    "checks": checks,
                }
            ),
            encoding="utf-8",
        )
        return canonical, project, video, cover, qas, review

    def test_independent_reviewer_cannot_equal_producer(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            data = json.loads(review.read_text())
            data["reviewer_id"] = data["producer_id"]
            errors = MODULE.validate_review_receipt(
                data,
                platform="bilibili",
                video_sha=MODULE.sha256_file(video),
                cover_sha=MODULE.sha256_file(cover),
            )
            self.assertIn("producer cannot approve their own final asset", errors)

    def test_review_fails_below_current_motion_quality_floor(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            data = json.loads(review.read_text())
            data["quality_scores"]["motion_design"] = 3
            errors = MODULE.validate_review_receipt(
                data,
                platform="bilibili",
                video_sha=MODULE.sha256_file(video),
                cover_sha=MODULE.sha256_file(cover),
            )
            self.assertTrue(any("motion_design=3" in e for e in errors))

    def test_review_fails_when_motion_v2_check_is_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            data = json.loads(review.read_text())
            data["checks"]["no_random_particles_or_floating_dots"] = False
            errors = MODULE.validate_review_receipt(
                data,
                platform="bilibili",
                video_sha=MODULE.sha256_file(video),
                cover_sha=MODULE.sha256_file(cover),
            )
            self.assertIn(
                "independent review check not PASS: no_random_particles_or_floating_dots",
                errors,
            )

    def test_audio_metrics_fail_quiet_high_lra_shape(self):
        metrics = {"integrated_lufs": -21.0, "lra_lu": 18.1, "true_peak_dbtp": -6.0}
        windows = [
            {"mean_db": -22.3, "silence_ratio": 0.04},
            {"mean_db": -38.3, "silence_ratio": 0.39},
            {"mean_db": -23.0, "silence_ratio": 0.10},
        ]
        errors = MODULE._audio_failures(metrics, windows)
        self.assertTrue(any("integrated loudness" in e for e in errors))
        self.assertTrue(any("LRA" in e for e in errors))
        self.assertTrue(any("mean level spread" in e for e in errors))

    def test_evaluate_pass_requires_hash_bound_qa_and_independent_review(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            video_probe = {
                "duration_s": 60.0,
                "video_start_s": 0.0,
                "audio_start_s": 0.0,
                "audio_duration_s": 60.0,
                "video_stream_count": 1,
                "audio_stream_count": 1,
                "width": 1920,
                "height": 1080,
                "audio_sample_rate": 48000,
                "audio_channels": 2,
                "has_video": True,
                "has_audio": True,
            }
            cover_probe = {
                "duration_s": 0.0,
                "width": 1920,
                "height": 1080,
                "audio_sample_rate": 0,
                "audio_channels": 0,
                "has_video": True,
                "has_audio": False,
            }
            with patch.object(MODULE, "probe_media", side_effect=[video_probe, cover_probe]):
                result = MODULE.evaluate_release(
                    project_dir=project,
                    video=video,
                    platform="bilibili",
                    cover=cover,
                    fact_qa=qas[0],
                    audio_qa=qas[1],
                    render_qa=qas[2],
                    review_receipt_path=review,
                    canonical_root=canonical,
                    measure_audio=False,
                    audio_metrics={"integrated_lufs": -14.0, "lra_lu": 5.0, "true_peak_dbtp": -2.0},
                    window_metrics=[
                        {"mean_db": -24.0, "silence_ratio": 0.10},
                        {"mean_db": -22.0, "silence_ratio": 0.12},
                        {"mean_db": -23.0, "silence_ratio": 0.08},
                    ],
                )
            self.assertEqual(result["status"], "PASS", result["failures"])

    def test_evaluate_fails_when_qa_does_not_bind_final_video_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            qas[1].write_text("audio: PASS\n", encoding="utf-8")
            video_probe = {
                "duration_s": 60.0,
                "video_start_s": 0.0,
                "audio_start_s": 0.0,
                "audio_duration_s": 60.0,
                "video_stream_count": 1,
                "audio_stream_count": 1,
                "width": 1920,
                "height": 1080,
                "audio_sample_rate": 48000,
                "audio_channels": 2,
                "has_video": True,
                "has_audio": True,
            }
            cover_probe = {
                "duration_s": 0.0,
                "width": 1920,
                "height": 1080,
                "audio_sample_rate": 0,
                "audio_channels": 0,
                "has_video": True,
                "has_audio": False,
            }
            with patch.object(MODULE, "probe_media", side_effect=[video_probe, cover_probe]):
                result = MODULE.evaluate_release(
                    project_dir=project,
                    video=video,
                    platform="bilibili",
                    cover=cover,
                    fact_qa=qas[0],
                    audio_qa=qas[1],
                    render_qa=qas[2],
                    review_receipt_path=review,
                    canonical_root=canonical,
                    measure_audio=False,
                    audio_metrics={"integrated_lufs": -14.0, "lra_lu": 5.0, "true_peak_dbtp": -2.0},
                    window_metrics=[
                        {"mean_db": -24.0, "silence_ratio": 0.10},
                        {"mean_db": -22.0, "silence_ratio": 0.12},
                        {"mean_db": -23.0, "silence_ratio": 0.08},
                    ],
                )
            self.assertEqual(result["status"], "FAIL")
            self.assertTrue(any("AUDIO QA does not contain" in e for e in result["failures"]))

    def test_verify_rejects_stale_pass_after_video_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            receipt = project / "VIDEO-RELEASE-GATE-bilibili.json"
            profile = MODULE.load_quality_profile()
            payload = {
                "schema": MODULE.SCHEMA,
                "status": "PASS",
                "platform": "bilibili",
                "quality_profile": {
                    "schema": profile["schema"],
                    "version": profile["version"],
                    "sha256": profile["_sha256"],
                    "path": profile["_path"],
                },
                "video": {"sha256": MODULE.sha256_file(video)},
                "cover": {"sha256": MODULE.sha256_file(cover)},
                "qa": {
                    "fact": {"path": str(qas[0]), "sha256": MODULE.sha256_file(qas[0])},
                    "audio": {"path": str(qas[1]), "sha256": MODULE.sha256_file(qas[1])},
                    "render": {"path": str(qas[2]), "sha256": MODULE.sha256_file(qas[2])},
                },
                "independent_review": {"path": str(review), "sha256": MODULE.sha256_file(review)},
            }
            receipt.write_text(json.dumps(payload), encoding="utf-8")
            video.write_bytes(b"video-v2")
            errors = MODULE.verify_pass_receipt(receipt, video, "bilibili", cover)
            self.assertIn("final video changed after release gate PASS", errors)

    def test_verify_rejects_old_quality_profile_binding(self):
        with tempfile.TemporaryDirectory() as tmp:
            canonical, project, video, cover, qas, review = self._fixture(Path(tmp))
            receipt = project / "VIDEO-RELEASE-GATE-bilibili.json"
            profile = MODULE.load_quality_profile()
            payload = {
                "schema": MODULE.SCHEMA,
                "status": "PASS",
                "platform": "bilibili",
                "quality_profile": {
                    "schema": profile["schema"],
                    "version": "older-motion-profile",
                    "sha256": "stale",
                    "path": profile["_path"],
                },
                "video": {"sha256": MODULE.sha256_file(video)},
                "cover": {"sha256": MODULE.sha256_file(cover)},
                "qa": {
                    "fact": {"path": str(qas[0]), "sha256": MODULE.sha256_file(qas[0])},
                    "audio": {"path": str(qas[1]), "sha256": MODULE.sha256_file(qas[1])},
                    "render": {"path": str(qas[2]), "sha256": MODULE.sha256_file(qas[2])},
                },
                "independent_review": {"path": str(review), "sha256": MODULE.sha256_file(review)},
            }
            receipt.write_text(json.dumps(payload), encoding="utf-8")
            errors = MODULE.verify_pass_receipt(receipt, video, "bilibili", cover)
            self.assertIn("video quality profile changed after release gate PASS; re-review required", errors)


if __name__ == "__main__":
    unittest.main()
