#!/usr/bin/env python3
"""Connect a phone's loopback SOCKS5 listener to this Mac over USB."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess


def adb(*args):
    try:
        result = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        raise SystemExit("ADB is unavailable. Check the USB connection and Android platform tools.") from None
    if result.returncode:
        raise SystemExit("ADB could not complete the bridge operation. Check the USB connection and port availability.")
    return result.stdout.strip()


def choose_phone(devices, state, model=None):
    ready = [row for row in devices if len(row) >= 2 and row[1] == "device"]
    if model:
        matches = [row for row in ready if f"model:{model}" in row[2:]]
    elif state.get("serial"):
        # Never silently switch to another phone when the configured one leaves.
        matches = [row for row in ready if row[0] == state["serial"]]
    else:
        matches = ready
    if len(matches) != 1:
        raise SystemExit("Connect the configured phone and approve USB debugging. For a different phone, select its model with --model.")
    row = matches[0]
    label = next((field.split(":", 1)[1] for field in row[2:] if field.startswith("model:")), "unknown")
    return row[0], label


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stop", action="store_true")
    parser.add_argument("--port", type=int)
    parser.add_argument("--remote-port", type=int, help="The phone's existing SOCKS5 listener port")
    parser.add_argument("--model", help="Select a phone model explicitly when multiple devices are connected")
    args = parser.parse_args()
    private = Path(__file__).resolve().parent / ".local-provider"
    state_file = private / "phone-bridge.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    port = args.port if args.port is not None else state.get("local_port", 1086)
    remote_port = args.remote_port if args.remote_port is not None else state.get("remote_port", 1086)
    if not isinstance(port, int) or not 1024 <= port <= 65535:
        parser.error("--port must be between 1024 and 65535")
    if not isinstance(remote_port, int) or not 1 <= remote_port <= 65535:
        parser.error("--remote-port must be between 1 and 65535")
    forwards = [line.split() for line in adb("forward", "--list").splitlines() if line.strip()]
    if args.stop:
        if not state.get("owned"):
            raise SystemExit("No USB forwarding owned by this launcher is recorded.")
        expected = [state["serial"], f"tcp:{state['local_port']}", f"tcp:{state['remote_port']}"]
        if expected in forwards:
            adb("-s", state["serial"], "forward", "--remove", expected[1])
        state_file.unlink()
        print("The recorded USB bridge is stopped. The phone VPN and Termux are unchanged.")
        return

    devices = [line.split() for line in adb("devices", "-l").splitlines()[1:] if line.strip()]
    serial, model = choose_phone(devices, state, args.model)
    local, remote = f"tcp:{port}", f"tcp:{remote_port}"
    expected = [serial, local, remote]
    if state.get("owned"):
        previous = [state["serial"], f"tcp:{state['local_port']}", f"tcp:{state['remote_port']}"]
        if previous != expected and previous in forwards:
            raise SystemExit("Stop the recorded bridge with --stop before choosing another device or port.")
    owners = [row for row in forwards if len(row) == 3 and row[1] == local]
    if owners and owners != [expected]:
        raise SystemExit("That local port belongs to another USB forward. Choose another --port.")
    owned = bool(state.get("owned") and state.get("serial") == serial
                 and state.get("local_port") == port and state.get("remote_port") == remote_port)
    if not owners:
        adb("-s", serial, "forward", "--no-rebind", local, remote)
        owned = True
    os.umask(0o077)
    private.mkdir(mode=0o700, exist_ok=True)
    private.chmod(0o700)
    state_file.write_text(json.dumps({"serial": serial, "model": model, "local_port": port,
                                     "remote_port": remote_port, "owned": owned}) + "\n")
    state_file.chmod(0o600)
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=3) as connection:
            connection.settimeout(3)
            connection.sendall(b"\x05\x01\x00")
            if connection.recv(2) != b"\x05\x00":
                raise OSError
    except OSError:
        if remote_port == 1086:
            message = "USB forwarding is prepared. In a new Termux session, run: python -m pproxy -l socks5://127.0.0.1:1086\nKeep Transocks connected and route Termux through it, then run this launcher again."
        else:
            message = "USB forwarding is prepared, but the phone proxy is not responding. Keep the configured phone and its VPN connected, then retry."
        raise SystemExit(message) from None
    print(f"USB SOCKS5 bridge is responding on the configured phone ({model}).")
    print(f"Private server proxy setting: socks5h://127.0.0.1:{port}")
    print("The phone must stay connected. VPN routing still needs an endpoint test.")


if __name__ == "__main__":
    main()
