export function concatBuffers(
    buffers: Uint8Array[] | ArrayBuffer[]
): Uint8Array {
    let total_length = 0;

    if (buffers.length === 0) return new Uint8Array([]);
  
    for (let i = 0; i < buffers.length; i++) {
      total_length += buffers[i].byteLength;
    }
  
    let temp = new Uint8Array(total_length);
    let offset = 0;
  
    temp.set(new Uint8Array(buffers[0]), offset);
    offset += buffers[0].byteLength;
  
    for (let i = 1; i < buffers.length; i++) {
      temp.set(new Uint8Array(buffers[i]), offset);
      offset += buffers[i].byteLength;
    }
  
    return temp;
}

export function bufferToString(buffer: Uint8Array | ArrayBuffer): string {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
}

export function bufferToAscii(buffer: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    s += String.fromCharCode(buffer[i]);
  }
  return s;
}
  
export function stringToBuffer(string: string): Uint8Array {
    return new TextEncoder().encode(string);
}

export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
  return new Uint8Array(bytes).buffer;
}


export function byteArrayToLong(byteArray: Uint8Array): number {
  let value = 0;
  for (let i = byteArray.length - 1; i >= 0; i--) {
    value = value * 256 + byteArray[i];
  }
  return value;
}

export function shortTo2ByteArray(long: number): Uint8Array {
  if (long > (2 ^ (32 - 1))) throw new Error('Short too long');
  // we want to represent the input as a 8-bytes array
  const byteArray = [0, 0];

  for (let index = 0; index < byteArray.length; index++) {
    const byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }

  return Uint8Array.from(byteArray);
}

export function longTo8ByteArray(long: number): Uint8Array {
  // we want to represent the input as a 8-bytes array
  const byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let index = 0; index < byteArray.length; index++) {
    const byte = long & 0xff;
    byteArray[index] = byte;
    long = (long - byte) / 256;
  }

  return Uint8Array.from(byteArray);
}

export function readFileChunk(file: File, start: number, end: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(start, end));
  });
};