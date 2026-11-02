export const peLooksComplete = (u8) => {
  if (u8.length < 2) return false;
  if (u8[0] === 0 && u8[1] === 0) return false;
  if (u8[0] !== 0x4d || u8[1] !== 0x5a) return true;
  if (u8.length < 0x40) return false;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const pe = dv.getUint32(0x3c, true);
  if (pe + 24 > u8.length || dv.getUint32(pe, true) !== 0x00004550) return false;
  const sections = dv.getUint16(pe + 6, true),
    optSize = dv.getUint16(pe + 20, true);
  const table = pe + 24 + optSize;
  if (table + sections * 40 > u8.length) return false;
  let end = table + sections * 40;
  for (let i = 0; i < sections; i++) {
    const raw = dv.getUint32(table + i * 40 + 16, true),
      ptr = dv.getUint32(table + i * 40 + 20, true);
    if (raw) end = Math.max(end, ptr + raw);
  }
  return u8.length >= end;
};
