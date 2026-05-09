#!/usr/bin/env python3
"""
Patches the Tauri-generated Android project with custom widget code.
Run after: cargo tauri android init
"""
import os
import shutil
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
ANDROID_SRC = REPO_ROOT / "android-src"
GEN_DIR = REPO_ROOT / "src-tauri" / "gen" / "android"


def find_package_dir(base: Path) -> Path | None:
    """Find the directory containing MainActivity.kt"""
    for candidate in ["kotlin", "java"]:
        for root, dirs, files in os.walk(base / "app" / "src" / "main" / candidate):
            if "MainActivity.kt" in files:
                return Path(root)
    return None


def main():
    if not GEN_DIR.exists():
        print(f"ERROR: {GEN_DIR} not found. Run 'cargo tauri android init' first.", file=sys.stderr)
        sys.exit(1)

    # Find package directory
    pkg_dir = find_package_dir(GEN_DIR)
    if pkg_dir is None:
        print("ERROR: Could not find MainActivity.kt in generated Android project.", file=sys.stderr)
        sys.exit(1)

    print(f"Package dir: {pkg_dir}")

    # Copy Kotlin widget
    kt_src = ANDROID_SRC / "kotlin" / "StatsWidget.kt"
    kt_dst = pkg_dir / "StatsWidget.kt"
    shutil.copy2(kt_src, kt_dst)
    print(f"Copied: {kt_dst}")

    # Copy resources
    res_src = ANDROID_SRC / "res"
    res_dst = GEN_DIR / "app" / "src" / "main" / "res"
    for item in res_src.rglob("*"):
        if item.is_file():
            rel = item.relative_to(res_src)
            dst = res_dst / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dst)
            print(f"Copied res: {dst}")

    # Patch AndroidManifest.xml
    manifest_path = GEN_DIR / "app" / "src" / "main" / "AndroidManifest.xml"
    ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
    tree = ET.parse(manifest_path)
    root = tree.getroot()
    ns = "http://schemas.android.com/apk/res/android"

    app_el = root.find("application")
    if app_el is None:
        print("ERROR: <application> not found in manifest", file=sys.stderr)
        sys.exit(1)

    # Check if widget receiver already added
    widget_already = any(
        r.get(f"{{{ns}}}name") == "com.sysmonitor.app.StatsWidget"
        for r in app_el.findall("receiver")
    )

    if not widget_already:
        receiver = ET.SubElement(app_el, "receiver")
        receiver.set(f"{{{ns}}}name", "com.sysmonitor.app.StatsWidget")
        receiver.set(f"{{{ns}}}label", "SysMonitor Widget")
        receiver.set(f"{{{ns}}}exported", "true")

        intent_filter = ET.SubElement(receiver, "intent-filter")
        action1 = ET.SubElement(intent_filter, "action")
        action1.set(f"{{{ns}}}name", "android.appwidget.action.APPWIDGET_UPDATE")
        action2 = ET.SubElement(intent_filter, "action")
        action2.set(f"{{{ns}}}name", "com.sysmonitor.app.WIDGET_UPDATE")

        meta = ET.SubElement(receiver, "meta-data")
        meta.set(f"{{{ns}}}name", "android.appwidget.provider")
        meta.set(f"{{{ns}}}resource", "@xml/widget_info")

        tree.write(manifest_path, xml_declaration=True, encoding="utf-8")
        print("Patched AndroidManifest.xml with widget receiver")
    else:
        print("Widget receiver already present in manifest")

    print("Patch complete!")


if __name__ == "__main__":
    main()
