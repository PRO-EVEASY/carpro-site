/* Browser-local authorization file packaging. No network requests. */
(function (root) {
  'use strict';
  const flagText = JSON.stringify([
    {
      index: 0,
      name: 'PnScreen',
      params: {
        PartNumber: null,
        IPCScreenType: null,
        IVIScreenType: null,
        action: 'eu_debugmode'
      }
    }
  ], null, 2) + '\n';
  const encoder = new TextEncoder();
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }
  function packageFiles(keyText) {
    if (typeof keyText !== 'string' || !keyText.trim()) throw new Error('A received authorization key is required.');
    const key = encoder.encode(keyText);
    if (key.length > 16384) throw new Error('Authorization key is too large.');
    const files = [
      {name: encoder.encode('adbauth.key'), data: key},
      {name: encoder.encode('svtasklist.flag'), data: encoder.encode(flagText)}
    ];
    const now = new Date();
    const year = Math.max(1980, Math.min(2107, now.getFullYear()));
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >>> 1);
    const date = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const localSize = files.reduce((n, f) => n + 30 + f.name.length + f.data.length, 0);
    const centralSize = files.reduce((n, f) => n + 46 + f.name.length, 0);
    const output = new Uint8Array(localSize + centralSize + 22);
    const view = new DataView(output.buffer);
    const u16 = (at, value) => view.setUint16(at, value, true);
    const u32 = (at, value) => view.setUint32(at, value >>> 0, true);
    let offset = 0;
    for (const file of files) {
      file.offset = offset;
      file.crc = crc32(file.data);
      u32(offset, 0x04034b50); u16(offset + 4, 20); u16(offset + 6, 0x800);
      u16(offset + 10, time); u16(offset + 12, date); u32(offset + 14, file.crc);
      u32(offset + 18, file.data.length); u32(offset + 22, file.data.length);
      u16(offset + 26, file.name.length);
      output.set(file.name, offset + 30);
      output.set(file.data, offset + 30 + file.name.length);
      offset += 30 + file.name.length + file.data.length;
    }
    for (const file of files) {
      u32(offset, 0x02014b50); u16(offset + 4, 20); u16(offset + 6, 20);
      u16(offset + 8, 0x800); u16(offset + 12, time); u16(offset + 14, date);
      u32(offset + 16, file.crc); u32(offset + 20, file.data.length);
      u32(offset + 24, file.data.length); u16(offset + 28, file.name.length);
      u32(offset + 42, file.offset); output.set(file.name, offset + 46);
      offset += 46 + file.name.length;
    }
    u32(offset, 0x06054b50); u16(offset + 8, files.length); u16(offset + 10, files.length);
    u32(offset + 12, centralSize); u32(offset + 16, localSize);
    return output;
  }
  const api = Object.freeze({flagText, packageFiles});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ADBAuthFiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
