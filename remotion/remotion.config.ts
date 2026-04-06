import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
// publicDir is set per-render via the --public-dir CLI flag in scripts/render.sh
// (each example has its own workspace/ folder, so a static config value won't work).
