import gzip, sys
p = r"src-tauri\resources\terrain\srtm_tiles\11\3120\1313.terrain"
with gzip.open(p, "rb") as f:
    data = f.read()
print(f"length: {len(data)}")
print(f"first 32 bytes (ascii): {data[:32]!r}")
print(f"first 32 bytes (hex):   {data[:32].hex(' ')}")