#!/usr/bin/env python3
"""Fail-closed release gate for agent-produced video publishing.

The gate intentionally separates production from release approval:
- machine checks operate on the exact final video/cover;
- QA documents must bind to the final video SHA256;
- an independent final-review receipt must bind to the same video/cover;
- publishers should call `verify` immediately before upload/schedule/publish.

Exit codes: 0=PASS, 2=gate FAIL, 64=usage/config error.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA = "video_release_gate.v1"
REVIEW_SCHEMA = "video_final_review.v1"
QUALITY_PROFILE_SCHEMA = "video_quality_profile.v1"
DEFAULT_QUALITY_PROFILE = Path(__file__).resolve().parents[1] / "config" / "video_quality_profile.json"
TARGET_LUFS = -14.0
LUFS_TOLERANCE = 1.5
MAX_LRA_LU = 8.0
MAX_TRUE_PEAK_DBTP = -1.5
MAX_WINDOW_MEAN_SPREAD_DB = 8.0
MAX_WINDOW_SILENCE_RATIO = 0.45
MAX_AUDIO_TIMELINE_GAP_S = 0.25  # allow codec timing skew, not an unfinished audio track
WINDOW_COUNT = 9
WINDOW_SECONDS = 20.0

PLATFORM_ALIASES = {
    "bilibili": "bilibili",
    "b站": "bilibili",
    "youtube": "youtube",
    "yt": "youtube",
    "xiaohongshu": "xiaohongshu",
    "xhs": "xiaohongshu",
    "小红书": "xiaohongshu",
    "wechat_channels": "wechat_channels",
    "video_account": "wechat_channels",
    "视频号": "wechat_channels",
    "x": "x",
    "twitter": "x",
    "douyin": "douyin",
}

COVER_DIMENSIONS = {
    "bilibili": (1920, 1080),
    "youtube": (1920, 1080),
    "xiaohongshu": (2160, 2880),
    "wechat_channels": (2160, 2880),
    "douyin": (2160, 2880),
}

COMMON_REVIEW_CHECKS = (
    "final_asset_opened",
    "end_card_present",
    "cover_320_readable",
    "cover_layout_pass",
    "ambient_motion_semantic",
    "audio_pacing_consistent",
    "audio_level_consistent",
    "no_black_frames_or_unintended_gaps",
    "platform_variant_correct",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_platform(value: str) -> str:
    key = value.strip().lower()
    if key not in PLATFORM_ALIASES:
        raise ValueError(f"unsupported platform: {value}")
    return PLATFORM_ALIASES[key]


def is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def run_cmd(args: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, check=False)


def require_media_tools() -> list[str]:
    errors: list[str] = []
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            errors.append(f"required tool missing: {tool}")
    return errors


def probe_media(path: Path) -> dict[str, Any]:
    proc = run_cmd([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height,sample_rate,channels,start_time,duration",
        "-of", "json", str(path),
    ])
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed for {path}: {proc.stderr.strip()}")
    data = json.loads(proc.stdout)
    streams = data.get("streams") or []
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)
    duration = float((video_stream or {}).get("duration") or (data.get("format") or {}).get("duration") or 0.0)

    def stream_time(stream: dict[str, Any] | None, key: str) -> float | None:
        value = (stream or {}).get(key)
        return float(value) if value not in (None, "N/A") else None

    return {
        "duration_s": duration,
        "width": int((video_stream or {}).get("width") or 0),
        "height": int((video_stream or {}).get("height") or 0),
        "audio_sample_rate": int((audio_stream or {}).get("sample_rate") or 0),
        "audio_channels": int((audio_stream or {}).get("channels") or 0),
        "has_video": video_stream is not None,
        "has_audio": audio_stream is not None,
        "video_stream_count": sum(s.get("codec_type") == "video" for s in streams),
        "audio_stream_count": sum(s.get("codec_type") == "audio" for s in streams),
        "video_start_s": stream_time(video_stream, "start_time"),
        "audio_start_s": stream_time(audio_stream, "start_time"),
        "audio_duration_s": stream_time(audio_stream, "duration"),
    }


def _media_failures(media: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if media.get("has_video") is not True or media.get("has_audio") is not True:
        errors.append("final asset must contain both video and audio")
    if media.get("video_stream_count") != 1 or media.get("audio_stream_count") != 1:
        errors.append("final master must contain exactly one video and one audio stream")
    if media.get("audio_sample_rate") != 48000 or media.get("audio_channels") != 2:
        errors.append("final asset requires stereo (2) 48000 Hz audio")
    for name in ("duration_s", "video_start_s", "audio_start_s", "audio_duration_s"):
        value = media.get(name)
        if type(value) not in (int, float) or not math.isfinite(value):
            errors.append(f"audio timeline evidence missing or non-finite: {name}")
    if errors:
        return errors
    duration = media["duration_s"]
    if duration <= 0 or media["audio_duration_s"] <= 0:
        errors.append("video and audio timeline durations must be positive")
    video_start, audio_start = media["video_start_s"], media["audio_start_s"]
    if (audio_start > video_start + MAX_AUDIO_TIMELINE_GAP_S or
            audio_start + media["audio_duration_s"] < video_start + duration - MAX_AUDIO_TIMELINE_GAP_S):
        errors.append("audio timeline does not cover final video (maximum codec timing gap 0.25s)")
    return errors


def measure_loudness(video: Path) -> dict[str, float]:
    proc = run_cmd([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-map", "0:a:0", "-vn",
        "-af", f"loudnorm=I={TARGET_LUFS}:LRA={MAX_LRA_LU}:TP={MAX_TRUE_PEAK_DBTP}:print_format=json",
        "-f", "null", "-",
    ])
    text = proc.stderr
    matches = re.findall(r"\{\s*\"input_i\".*?\}", text, flags=re.S)
    if proc.returncode != 0 or not matches:
        raise RuntimeError(f"loudness measurement failed: {text[-1000:]}")
    data = json.loads(matches[-1])
    return {
        "integrated_lufs": float(data["input_i"]),
        "lra_lu": float(data["input_lra"]),
        "true_peak_dbtp": float(data["input_tp"]),
    }


def _parse_volumedetect(stderr: str) -> tuple[float | None, float | None]:
    mean = re.search(r"mean_volume:\s*(-?[0-9.]+) dB", stderr)
    peak = re.search(r"max_volume:\s*(-?[0-9.]+) dB", stderr)
    return (
        float(mean.group(1)) if mean else None,
        float(peak.group(1)) if peak else None,
    )


def _parse_silence(stderr: str, window_seconds: float) -> tuple[float, int]:
    durations = [float(x) for x in re.findall(r"silence_duration:\s*([0-9.]+)", stderr)]
    total = min(sum(durations), window_seconds)
    return total / window_seconds if window_seconds else 0.0, len(durations)


def measure_windows(video: Path, duration_s: float) -> list[dict[str, float | int | None]]:
    if duration_s <= 0:
        return []
    window = min(duration_s, WINDOW_SECONDS, max(5.0, duration_s / max(WINDOW_COUNT, 1)))
    if duration_s <= window:
        starts = [0.0]
    else:
        first = min(max(0.0, duration_s * 0.05), duration_s - window)
        last = max(first, duration_s - window - min(duration_s * 0.03, 10.0))
        if WINDOW_COUNT == 1 or last <= first:
            starts = [first]
        else:
            step = (last - first) / (WINDOW_COUNT - 1)
            starts = [first + i * step for i in range(WINDOW_COUNT)]
    results: list[dict[str, float | int | None]] = []
    for start in starts:
        proc = run_cmd([
            "ffmpeg", "-hide_banner", "-nostats", "-ss", f"{start:.3f}",
            "-t", f"{window:.3f}", "-i", str(video), "-map", "0:a:0", "-vn",
            "-af", f"apad=whole_dur={window:.3f},atrim=duration={window:.3f},silencedetect=n=-45dB:d=0.7,volumedetect",
            "-f", "null", "-",
        ])
        if proc.returncode != 0:
            results.append({"start_s": round(start, 3), "error": proc.returncode})
            continue
        mean_db, peak_db = _parse_volumedetect(proc.stderr)
        silence_ratio, silence_events = _parse_silence(proc.stderr, window)
        results.append({
            "start_s": round(start, 3),
            "window_s": round(window, 3),
            "mean_db": mean_db,
            "peak_db": peak_db,
            "silence_ratio": round(silence_ratio, 4),
            "silence_events": silence_events,
        })
    return results


def qa_binds_hash(path: Path, video_sha: str) -> bool:
    try:
        text = path.read_text(encoding="utf-8", errors="replace").lower()
    except OSError:
        return False
    return video_sha.lower() in text


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def load_quality_profile(path: Path = DEFAULT_QUALITY_PROFILE) -> dict[str, Any]:
    path = path.expanduser().resolve()
    content = path.read_bytes()
    value = json.loads(content)
    if not isinstance(value, dict):
        raise ValueError("quality profile must be an object")
    if value.get("schema") != QUALITY_PROFILE_SCHEMA:
        raise ValueError(f"quality profile schema must be {QUALITY_PROFILE_SCHEMA}")
    version = str(value.get("version") or "").strip()
    minimum_scores = value.get("minimum_scores")
    required_checks = value.get("required_review_checks")
    if not version:
        raise ValueError("quality profile version is required")
    if not isinstance(minimum_scores, dict) or not minimum_scores:
        raise ValueError("quality profile minimum_scores must be a non-empty object")
    if not isinstance(required_checks, list) or not required_checks or any(
        not isinstance(name, str) or not name.strip() for name in required_checks
    ):
        raise ValueError("quality profile required_review_checks must be a non-empty array of names")
    for name, floor in minimum_scores.items():
        if not isinstance(name, str) or type(floor) not in (int, float) or not 1 <= float(floor) <= 5:
            raise ValueError("quality profile scores must use named 1..5 floors")
    value = dict(value)
    value["_path"] = str(path)
    value["_sha256"] = hashlib.sha256(content).hexdigest()
    return value


def validate_review_receipt(
    receipt: dict[str, Any], *, platform: str, video_sha: str, cover_sha: str | None,
    quality_profile: dict[str, Any] | None = None,
) -> list[str]:
    errors: list[str] = []
    if receipt.get("schema") != REVIEW_SCHEMA:
        errors.append(f"review receipt schema must be {REVIEW_SCHEMA}")
    if receipt.get("status") != "PASS":
        errors.append("independent final review status is not PASS")
    if receipt.get("platform") != platform:
        errors.append("review receipt platform does not match release platform")
    if receipt.get("video_sha256") != video_sha:
        errors.append("review receipt is not bound to final video SHA256")
    if cover_sha is not None and receipt.get("cover_sha256") != cover_sha:
        errors.append("review receipt is not bound to final cover SHA256")
    producer = str(receipt.get("producer_id") or "").strip()
    reviewer = str(receipt.get("reviewer_id") or "").strip()
    if not producer or not reviewer:
        errors.append("review receipt must include producer_id and reviewer_id")
    elif producer == reviewer:
        errors.append("producer cannot approve their own final asset")
    profile = quality_profile or load_quality_profile()
    if receipt.get("quality_profile_version") != profile["version"]:
        errors.append("independent review quality_profile_version is not current")
    scores = receipt.get("quality_scores")
    if not isinstance(scores, dict):
        errors.append("review receipt quality_scores must be an object")
        scores = {}
    for name, floor in profile["minimum_scores"].items():
        score = scores.get(name)
        if type(score) not in (int, float):
            errors.append(f"quality score missing or invalid: {name}")
            continue
        if not 1 <= float(score) <= 5:
            errors.append(f"quality score must be 1..5: {name}")
        elif float(score) < float(floor):
            errors.append(f"quality score below current floor: {name}={score} < {floor}")

    checks = receipt.get("checks")
    if not isinstance(checks, dict):
        errors.append("review receipt checks must be an object")
        checks = {}
    required = list(COMMON_REVIEW_CHECKS) + list(profile["required_review_checks"])
    if platform == "bilibili":
        required.append("bilibili_title_centered")
    for name in dict.fromkeys(required):
        if checks.get(name) is not True:
            errors.append(f"independent review check not PASS: {name}")
    return errors


def review_template(platform: str) -> dict[str, Any]:
    profile = load_quality_profile()
    checks = {name: False for name in COMMON_REVIEW_CHECKS}
    checks.update({name: False for name in profile["required_review_checks"]})
    if platform == "bilibili":
        checks["bilibili_title_centered"] = False
    return {
        "schema": REVIEW_SCHEMA,
        "status": "PENDING",
        "platform": platform,
        "video_sha256": "<final-video-sha256>",
        "cover_sha256": "<final-cover-sha256>",
        "producer_id": "<producer-session-or-agent-id>",
        "reviewer_id": "<different-reviewer-session-or-agent-id>",
        "reviewed_at": None,
        "quality_profile_version": profile["version"],
        "quality_scores": {name: None for name in profile["minimum_scores"]},
        "checks": checks,
        "notes": [],
    }


def _audio_failures(metrics: dict[str, float], windows: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    for name in ("integrated_lufs", "lra_lu", "true_peak_dbtp"):
        value = metrics.get(name)
        if type(value) not in (int, float) or not math.isfinite(value):
            errors.append(f"audio metric missing or non-finite: {name}")
    if errors:
        return errors
    if not windows:
        errors.append("representative audio windows unavailable")
    for window in windows:
        if not isinstance(window, dict) or "error" in window:
            errors.append("representative audio window measurement failed")
            continue
        for name in ("mean_db", "silence_ratio"):
            value = window.get(name)
            if type(value) not in (int, float) or not math.isfinite(value):
                errors.append(f"audio window missing or non-finite: {name}")
        ratio = window.get("silence_ratio")
        if type(ratio) in (int, float) and not 0 <= ratio <= 1:
            errors.append("audio window silence_ratio must be between 0 and 1")
    if errors:
        return errors
    lufs = metrics["integrated_lufs"]
    if not (TARGET_LUFS - LUFS_TOLERANCE <= lufs <= TARGET_LUFS + LUFS_TOLERANCE):
        errors.append(
            f"integrated loudness {lufs:.1f} LUFS outside {TARGET_LUFS:.1f}±{LUFS_TOLERANCE:.1f} LU"
        )
    if metrics["lra_lu"] > MAX_LRA_LU:
        errors.append(f"LRA {metrics['lra_lu']:.1f} LU exceeds {MAX_LRA_LU:.1f} LU")
    if metrics["true_peak_dbtp"] > MAX_TRUE_PEAK_DBTP:
        errors.append(
            f"true peak {metrics['true_peak_dbtp']:.1f} dBTP exceeds {MAX_TRUE_PEAK_DBTP:.1f} dBTP"
        )
    means = [float(x["mean_db"]) for x in windows if x.get("mean_db") is not None]
    if len(means) >= 3:
        spread = max(means) - min(means)
        if spread > MAX_WINDOW_MEAN_SPREAD_DB:
            errors.append(
                f"chapter/window mean level spread {spread:.1f} dB exceeds {MAX_WINDOW_MEAN_SPREAD_DB:.1f} dB"
            )
    high_silence = [x for x in windows if float(x.get("silence_ratio") or 0.0) > MAX_WINDOW_SILENCE_RATIO]
    if high_silence:
        starts = ",".join(str(x.get("start_s")) for x in high_silence[:4])
        errors.append(
            f"representative windows exceed {MAX_WINDOW_SILENCE_RATIO:.0%} near-silence ratio at {starts}s"
        )
    return errors


def evaluate_release(
    *,
    project_dir: Path,
    video: Path,
    platform: str,
    cover: Path | None,
    fact_qa: Path,
    audio_qa: Path,
    render_qa: Path,
    review_receipt_path: Path,
    canonical_root: Path | None = None,
    measure_audio: bool = True,
    audio_metrics: dict[str, float] | None = None,
    window_metrics: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    platform = normalize_platform(platform)
    project_dir = project_dir.expanduser().resolve()
    video = video.expanduser().resolve()
    canonical_root = (canonical_root or project_dir).expanduser().resolve()
    cover = cover.expanduser().resolve() if cover else None
    fact_qa = fact_qa.expanduser().resolve()
    audio_qa = audio_qa.expanduser().resolve()
    render_qa = render_qa.expanduser().resolve()
    review_receipt_path = review_receipt_path.expanduser().resolve()

    failures: list[str] = []
    warnings: list[str] = []
    try:
        quality_profile = load_quality_profile()
    except Exception as exc:
        quality_profile = {}
        failures.append(f"invalid video quality profile: {exc}")
    failures.extend(require_media_tools())
    if not project_dir.is_dir():
        failures.append("project_dir does not exist")
    if not is_relative_to(project_dir, canonical_root):
        failures.append(f"project_dir is outside canonical video root: {canonical_root}")
    if not video.is_file():
        failures.append("final video does not exist")
    elif not is_relative_to(video, project_dir):
        failures.append("final video is outside project_dir")

    cover_required = platform in COVER_DIMENSIONS
    if cover_required and (cover is None or not cover.is_file()):
        failures.append(f"final cover is required for {platform}")

    for label, path in (("FACT QA", fact_qa), ("AUDIO QA", audio_qa), ("RENDER QA", render_qa)):
        if not path.is_file():
            failures.append(f"{label} file missing: {path}")
    if not review_receipt_path.is_file():
        failures.append(f"independent final review receipt missing: {review_receipt_path}")
    inputs = [video, fact_qa, audio_qa, render_qa, review_receipt_path]
    if cover is not None:
        inputs.append(cover)
    for path in inputs:
        if not is_relative_to(path, project_dir):
            failures.append(f"release input is outside project_dir: {path}")
        if not path.is_file():
            failures.append(f"release input missing: {path}")
    initial_hashes = {path: sha256_file(path) for path in inputs if path.is_file()}

    if failures and not video.is_file():
        return {"schema": SCHEMA, "status": "FAIL", "failures": failures, "warnings": warnings}

    video_sha = sha256_file(video) if video.is_file() else ""
    cover_sha = sha256_file(cover) if cover and cover.is_file() else None

    qa_rows: dict[str, Any] = {}
    for label, path in (("fact", fact_qa), ("audio", audio_qa), ("render", render_qa)):
        if path.is_file():
            bound = qa_binds_hash(path, video_sha)
            qa_rows[label] = {"path": str(path), "sha256": sha256_file(path), "binds_video_sha": bound}
            if not bound:
                failures.append(f"{label.upper()} QA does not contain final video SHA256")

    media: dict[str, Any] = {}
    if video.is_file() and not require_media_tools():
        try:
            media = probe_media(video)
        except Exception as exc:  # fail closed
            failures.append(str(exc))
    if media:
        failures.extend(_media_failures(media))
    else:
        failures.append("final video probe unavailable")

    cover_probe: dict[str, Any] | None = None
    if cover and cover.is_file() and not require_media_tools():
        try:
            cover_probe = probe_media(cover)
            expected = COVER_DIMENSIONS.get(platform)
            if expected and (cover_probe["width"], cover_probe["height"]) != expected:
                failures.append(
                    f"{platform} cover must be {expected[0]}x{expected[1]}, got {cover_probe['width']}x{cover_probe['height']}"
                )
        except Exception as exc:
            failures.append(f"cover probe failed: {exc}")

    if measure_audio and video.is_file() and not require_media_tools():
        try:
            audio_metrics = measure_loudness(video)
            window_metrics = measure_windows(video, float(media.get("duration_s") or 0.0))
        except Exception as exc:
            failures.append(str(exc))
    audio_metrics = audio_metrics or {}
    window_metrics = window_metrics or []
    failures.extend(_audio_failures(audio_metrics, window_metrics))

    review: dict[str, Any] = {}
    if review_receipt_path.is_file():
        try:
            review = load_json(review_receipt_path)
            failures.extend(
                validate_review_receipt(
                    review,
                    platform=platform,
                    video_sha=video_sha,
                    cover_sha=cover_sha,
                    quality_profile=quality_profile or None,
                )
            )
        except Exception as exc:
            failures.append(f"invalid independent review receipt: {exc}")

    for path, digest in initial_hashes.items():
        if not path.is_file() or sha256_file(path) != digest:
            failures.append(f"release input changed during evaluation: {path}")

    return {
        "schema": SCHEMA,
        "status": "PASS" if not failures else "FAIL",
        "issued_at": utc_now(),
        "platform": platform,
        "project_dir": str(project_dir),
        "canonical_root": str(canonical_root),
        "video": {"path": str(video), "sha256": video_sha, **media},
        "cover": None if cover is None else {
            "path": str(cover),
            "sha256": cover_sha,
            **(cover_probe or {}),
        },
        "qa": qa_rows,
        "independent_review": {
            "path": str(review_receipt_path),
            "sha256": sha256_file(review_receipt_path) if review_receipt_path.is_file() else None,
            "reviewer_id": review.get("reviewer_id"),
            "producer_id": review.get("producer_id"),
        },
        "quality_profile": None if not quality_profile else {
            "schema": quality_profile.get("schema"),
            "version": quality_profile.get("version"),
            "sha256": quality_profile.get("_sha256"),
            "path": quality_profile.get("_path"),
        },
        "audio": {
            "thresholds": {
                "target_lufs": TARGET_LUFS,
                "tolerance_lu": LUFS_TOLERANCE,
                "max_lra_lu": MAX_LRA_LU,
                "max_true_peak_dbtp": MAX_TRUE_PEAK_DBTP,
                "max_window_mean_spread_db": MAX_WINDOW_MEAN_SPREAD_DB,
                "max_window_silence_ratio": MAX_WINDOW_SILENCE_RATIO,
            },
            "metrics": audio_metrics,
            "representative_windows": window_metrics,
        },
        "failures": failures,
        "warnings": warnings,
    }


def write_receipt(path: Path, result: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def verify_pass_receipt(
    receipt_path: Path, video: Path, platform: str, cover: Path | None,
    project_dir: Path | None = None,
) -> list[str]:
    return verify_release(receipt_path, video, platform, cover, project_dir)["failures"]


def verify_release(
    receipt_path: Path, video: Path, platform: str, cover: Path | None,
    project_dir: Path | None = None,
) -> dict[str, Any]:
    """Return only bindings from the snapshot actually verified, never a later reread."""
    verified: dict[str, Any] = {}
    try:
        failures = _verify_pass_receipt(receipt_path, video, platform, cover, project_dir, verified)
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        failures = [f"invalid or unreadable release evidence: {exc}"]
    result = {"status": "FAIL" if failures else "PASS", "failures": failures}
    if not failures:
        result["verified"] = verified
    return result


def _verify_pass_receipt(
    receipt_path: Path, video: Path, platform: str, cover: Path | None,
    project_dir: Path | None,
    verified: dict[str, Any],
) -> list[str]:
    receipt_path = receipt_path.expanduser().resolve()
    receipt_sha = sha256_file(receipt_path)
    receipt = load_json(receipt_path)
    platform = normalize_platform(platform)
    video = video.expanduser().resolve()
    cover = cover.expanduser().resolve() if cover else None
    failures: list[str] = []
    if receipt.get("schema") != SCHEMA:
        failures.append(f"release receipt schema must be {SCHEMA}")
    if receipt.get("status") != "PASS" or receipt.get("failures") != []:
        failures.append("release receipt status is not PASS or contains failures")

    def object_field(name: str) -> dict[str, Any]:
        value = receipt.get(name)
        if not isinstance(value, dict) or not value:
            raise ValueError(f"release receipt requires {name} object")
        return value

    if receipt.get("platform") != platform:
        failures.append("release receipt platform mismatch")
    profile = load_quality_profile()
    bound_profile = object_field("quality_profile")
    if (bound_profile.get("schema") != profile["schema"] or
            bound_profile.get("version") != profile["version"] or
            bound_profile.get("sha256") != profile["_sha256"]):
        failures.append("video quality profile changed after release gate PASS; re-review required")
    if not video.is_file():
        return failures + ["final video missing"]
    current_video_sha = sha256_file(video)
    video_row = object_field("video")
    if video_row.get("sha256") != current_video_sha:
        failures.append("final video changed after release gate PASS")
    if failures:
        return failures

    qa = object_field("qa")
    for label in ("fact", "audio", "render"):
        row = qa.get(label)
        if not isinstance(row, dict) or not isinstance(row.get("path"), str):
            failures.append(f"missing or invalid {label} QA binding in release receipt")
            continue
        qa_path = Path(row["path"]).expanduser().resolve()
        if not qa_path.is_file() or sha256_file(qa_path) != row.get("sha256"):
            failures.append(f"{label} QA changed or disappeared after release gate PASS")
        elif not qa_binds_hash(qa_path, current_video_sha):
            failures.append(f"{label} QA does not bind final video SHA256")

    receipt_cover = receipt.get("cover")
    current_cover_sha = None
    if platform in COVER_DIMENSIONS or receipt_cover is not None or cover is not None:
        if cover is None or not cover.is_file():
            failures.append("required or previously bound final cover missing")
        else:
            current_cover_sha = sha256_file(cover)
            if not isinstance(receipt_cover, dict) or receipt_cover.get("sha256") != current_cover_sha:
                failures.append("final cover changed after release gate PASS")
            expected = COVER_DIMENSIONS.get(platform)
            if expected and isinstance(receipt_cover, dict) and (
                receipt_cover.get("width"), receipt_cover.get("height")
            ) != expected:
                failures.append("release receipt cover dimensions do not meet current platform profile")

    review = object_field("independent_review")
    review_path = Path(str(review.get("path") or "")).expanduser().resolve()
    if not review_path.is_file() or sha256_file(review_path) != review.get("sha256"):
        failures.append("independent final review receipt changed or disappeared after gate PASS")
    else:
        failures.extend(validate_review_receipt(
            load_json(review_path), platform=platform, video_sha=current_video_sha,
            cover_sha=current_cover_sha, quality_profile=profile,
        ))

    recorded_project = receipt.get("project_dir")
    recorded_root = receipt.get("canonical_root")
    if not isinstance(recorded_project, str) or not isinstance(recorded_root, str):
        failures.append("release receipt requires project_dir and canonical_root")
    else:
        project = Path(recorded_project).expanduser().resolve()
        root = Path(recorded_root).expanduser().resolve()
        if project_dir is not None and project_dir.expanduser().resolve() != project:
            failures.append("release receipt project does not match handoff project")
        if not project.is_dir() or not is_relative_to(project, root):
            failures.append("release receipt project is outside canonical root or missing")
        paths = [video, review_path] + ([cover] if cover else [])
        paths.extend(Path(row["path"]).expanduser().resolve() for row in qa.values()
                     if isinstance(row, dict) and isinstance(row.get("path"), str))
        if any(not is_relative_to(path, project) for path in paths):
            failures.append("release input is outside project_dir")

    failures.extend(_media_failures(video_row))
    audio = object_field("audio")
    metrics, windows = audio.get("metrics"), audio.get("representative_windows")
    if not isinstance(metrics, dict) or not isinstance(windows, list):
        failures.append("release receipt lacks audio measurements")
    else:
        failures.extend(_audio_failures(metrics, windows))
    if not failures:
        snapshot = {
            receipt_path: receipt_sha,
            video: current_video_sha,
            Path(profile["_path"]): profile["_sha256"],
            review_path: review["sha256"],
        }
        snapshot.update({Path(qa[label]["path"]).expanduser().resolve(): qa[label]["sha256"]
                         for label in ("fact", "audio", "render")})
        if cover is not None:
            snapshot[cover] = current_cover_sha
        for path, digest in snapshot.items():
            if not path.is_file() or sha256_file(path) != digest:
                failures.append(f"release evidence changed during verification: {path}")
    if not failures:
        verified.update(
            platform=platform, verified_at=utc_now(),
            video={"path": str(video), "sha256": current_video_sha},
            cover={"path": str(cover), "sha256": current_cover_sha} if cover else None,
            release_receipt=str(receipt_path), release_receipt_sha256=receipt_sha,
        )
    return failures


def _default_output(project: Path, platform: str) -> Path:
    return project / f"VIDEO-RELEASE-GATE-{platform}.json"


def cmd_issue(args: argparse.Namespace) -> int:
    platform = normalize_platform(args.platform)
    project = Path(args.project_dir)
    output = Path(args.output) if args.output else _default_output(project, platform)
    inputs = [args.video, args.cover, args.fact_qa, args.audio_qa, args.render_qa, args.review_receipt,
              str(DEFAULT_QUALITY_PROFILE)]
    if output.expanduser().resolve() in {Path(p).expanduser().resolve() for p in inputs if p}:
        raise ValueError("release output must not overwrite an input or quality profile")
    result = evaluate_release(
        project_dir=project,
        video=Path(args.video),
        platform=platform,
        cover=Path(args.cover) if args.cover else None,
        fact_qa=Path(args.fact_qa),
        audio_qa=Path(args.audio_qa),
        render_qa=Path(args.render_qa),
        review_receipt_path=Path(args.review_receipt),
        canonical_root=Path(args.canonical_root) if args.canonical_root else None,
    )
    write_receipt(output, result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 2


def cmd_verify(args: argparse.Namespace) -> int:
    result = verify_release(
        Path(args.receipt).expanduser().resolve(),
        Path(args.video).expanduser().resolve(),
        args.platform,
        Path(args.cover).expanduser().resolve() if args.cover else None,
        Path(args.project_dir) if args.project_dir else None,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 2


def cmd_review_template(args: argparse.Namespace) -> int:
    print(json.dumps(review_template(normalize_platform(args.platform)), ensure_ascii=False, indent=2))
    return 0


class GateArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise ValueError(message)


def build_parser() -> argparse.ArgumentParser:
    parser = GateArgumentParser(description="Fail-closed video release gate")
    sub = parser.add_subparsers(dest="command", required=True)

    issue = sub.add_parser("evaluate", aliases=["issue"], help="evaluate final assets and write a release-gate receipt")
    issue.add_argument("--project-dir", required=True)
    issue.add_argument("--canonical-root", help="optional parent boundary; defaults to project-dir")
    issue.add_argument("--video", required=True)
    issue.add_argument("--platform", required=True)
    issue.add_argument("--cover")
    issue.add_argument("--fact-qa", required=True)
    issue.add_argument("--audio-qa", required=True)
    issue.add_argument("--render-qa", required=True)
    issue.add_argument("--review-receipt", required=True)
    issue.add_argument("--output")
    issue.set_defaults(func=cmd_issue)

    verify = sub.add_parser("verify", help="publisher preflight: verify an existing PASS receipt still binds current assets")
    verify.add_argument("--receipt", required=True)
    verify.add_argument("--project-dir", help="require the receipt to belong to this handoff project")
    verify.add_argument("--video", required=True)
    verify.add_argument("--platform", required=True)
    verify.add_argument("--cover")
    verify.set_defaults(func=cmd_verify)

    template = sub.add_parser("review-template", help="print independent final-review receipt template")
    template.add_argument("--platform", required=True)
    template.set_defaults(func=cmd_review_template)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        return int(args.func(args))
    except (ValueError, OSError, TypeError) as exc:
        print(json.dumps({"status": "FAIL", "failures": [str(exc)]}, ensure_ascii=False, indent=2))
        return 64


if __name__ == "__main__":
    raise SystemExit(main())
