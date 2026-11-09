/**
 * Flatpak build helper for Sark Docs Manager
 * Builds an official Flatpak manifest for sark.docs.
 */
import fs from "node:fs";
import path from "node:path";

const manifest = {
  appId: "sark.docs",
  runtime: "org.gnome.Platform",
  runtimeVersion: "46",
  sdk: "org.gnome.Sdk",
  command: "sark-docs-manager",
  finishArgs: [
    "--share=ipc",
    "--socket=fallback-x11",
    "--socket=wayland",
    "--device=dri",
    "--filesystem=host",
    "--filesystem=home"
  ],
  modules: [
    {
      name: "sark-docs-manager",
      buildsystem: "simple",
      buildCommands: [
        "install -D sark-docs-manager /app/bin/sark-docs-manager"
      ],
      sources: [
        {
          type: "file",
          path: "../src-tauri/target/release/sark-docs-manager"
        }
      ]
    }
  ]
};

const flatpakDir = path.resolve("flatpak");
if (!fs.existsSync(flatpakDir)) {
  fs.mkdirSync(flatpakDir, { recursive: true });
}

fs.writeFileSync(
  path.join(flatpakDir, "sark.docs.json"),
  JSON.stringify(manifest, null, 2)
);

console.log("Flatpak manifest generated at flatpak/sark.docs.json");
