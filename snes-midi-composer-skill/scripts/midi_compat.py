"""Small Standard MIDI File writer used when the optional mido package is absent."""
from __future__ import annotations

import math
import struct
from pathlib import Path
from typing import Any


def bpm2tempo(bpm: float) -> int:
    if bpm <= 0:
        raise ValueError("BPM must be positive")
    return round(60_000_000 / bpm)


def variable_length(value: int) -> bytes:
    if value < 0:
        raise ValueError("MIDI delta time cannot be negative")
    buffer = value & 0x7F
    encoded = bytearray([buffer])
    while value >> 7:
        value >>= 7
        buffer = (value & 0x7F) | 0x80
        encoded.insert(0, buffer)
    return bytes(encoded)


class Message:
    def __init__(self, message_type: str, *, time: int = 0, **values: Any) -> None:
        self.type = message_type
        self.time = int(time)
        self.values = values

    def encode(self) -> bytes:
        channel = int(self.values.get("channel", 0)) & 0x0F
        if self.type == "program_change":
            return bytes((0xC0 | channel, int(self.values["program"]) & 0x7F))
        if self.type == "control_change":
            return bytes((0xB0 | channel, int(self.values["control"]) & 0x7F, int(self.values["value"]) & 0x7F))
        if self.type in {"note_on", "note_off"}:
            status = 0x90 if self.type == "note_on" else 0x80
            return bytes((status | channel, int(self.values["note"]) & 0x7F, int(self.values["velocity"]) & 0x7F))
        raise ValueError(f"Unsupported MIDI message type: {self.type}")


class MetaMessage(Message):
    def encode(self) -> bytes:
        if self.type in {"track_name", "text"}:
            meta_type = 0x03 if self.type == "track_name" else 0x01
            key = "name" if self.type == "track_name" else "text"
            payload = str(self.values[key]).encode("latin-1", "replace")
        elif self.type == "set_tempo":
            meta_type = 0x51
            payload = int(self.values["tempo"]).to_bytes(3, "big")
        elif self.type == "time_signature":
            meta_type = 0x58
            numerator = int(self.values["numerator"])
            denominator = int(self.values["denominator"])
            power = int(math.log2(denominator)) if denominator > 0 and denominator & (denominator - 1) == 0 else 2
            payload = bytes((numerator & 0xFF, power & 0xFF, 24, 8))
        else:
            raise ValueError(f"Unsupported MIDI meta message type: {self.type}")
        return bytes((0xFF, meta_type)) + variable_length(len(payload)) + payload


class MidiTrack(list[Message]):
    def encode(self) -> bytes:
        body = bytearray()
        for message in self:
            body.extend(variable_length(int(message.time)))
            body.extend(message.encode())
        body.extend(b"\x00\xff\x2f\x00")
        return b"MTrk" + struct.pack(">I", len(body)) + body


class MidiFile:
    def __init__(self, *, type: int = 1, ticks_per_beat: int = 480) -> None:
        self.type = int(type)
        self.ticks_per_beat = int(ticks_per_beat)
        self.tracks: list[MidiTrack] = []

    def save(self, path: str | Path) -> None:
        header = b"MThd" + struct.pack(">IHHH", 6, self.type, len(self.tracks), self.ticks_per_beat)
        Path(path).write_bytes(header + b"".join(track.encode() for track in self.tracks))
