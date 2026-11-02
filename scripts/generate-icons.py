import math
import os
import struct
import zlib


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "icons")
BUILD_DIR = os.path.join(ROOT, "build")
BACKGROUND = (250, 239, 234, 255)
PETAL = (213, 139, 148, 255)
PETAL_HIGHLIGHT = (236, 181, 182, 255)
CENTER = (255, 244, 224, 255)
CENTER_DOT = (190, 123, 108, 255)


def blend(first, second, amount):
    return tuple(round(a + (b - a) * amount) for a, b in zip(first, second))


def png_bytes(size):
    row_length = size * 4
    raw = bytearray((row_length + 1) * size)
    center = (size - 1) / 2
    corner_radius = size * 0.255
    petal_orbit = size * 0.19
    petal_radius = size * 0.155
    flower_center_radius = size * 0.105
    dot_radius = size * 0.034

    for y in range(size):
        row_offset = y * (row_length + 1)
        raw[row_offset] = 0
        py = y + 0.5
        for x in range(size):
            px = x + 0.5
            dx = abs(px - center) - (center - corner_radius)
            dy = abs(py - center) - (center - corner_radius)
            outside_x = max(dx, 0)
            outside_y = max(dy, 0)
            if outside_x * outside_x + outside_y * outside_y > corner_radius * corner_radius:
                color = (0, 0, 0, 0)
            else:
                color = BACKGROUND
                flower_distance = math.hypot(px - center, py - center)
                for petal in range(5):
                    angle = -math.pi / 2 + petal * math.tau / 5
                    petal_x = center + math.cos(angle) * petal_orbit
                    petal_y = center + math.sin(angle) * petal_orbit
                    distance = math.hypot(px - petal_x, py - petal_y)
                    if distance < petal_radius:
                        color = blend(PETAL_HIGHLIGHT, PETAL, min(1, distance / petal_radius * 0.8))
                        break
                if flower_distance < flower_center_radius:
                    color = CENTER
                if flower_distance < dot_radius:
                    color = CENTER_DOT
            pixel = row_offset + 1 + x * 4
            raw[pixel:pixel + 4] = bytes(color)

    def chunk(name, data):
        return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def write_icon_set():
    os.makedirs(ICON_DIR, exist_ok=True)
    os.makedirs(BUILD_DIR, exist_ok=True)
    for size in (192, 512):
        with open(os.path.join(ICON_DIR, f"icon-{size}.png"), "wb") as icon:
            icon.write(png_bytes(size))

    png = png_bytes(256)
    directory = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0, 0, 0, 0, 1, 32, len(png), 22)
    with open(os.path.join(BUILD_DIR, "icon.ico"), "wb") as icon:
        icon.write(directory + entry + png)


if __name__ == "__main__":
    write_icon_set()
