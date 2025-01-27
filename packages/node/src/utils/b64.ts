import { Buffer } from "buffer";

export function concatBuffers(buffers: Buffer[]): Buffer {
  return Buffer.concat(buffers);
}

export function b64UrlToString(b64UrlString: string): string {
  const buffer = b64UrlToBuffer(b64UrlString);
  return bufferToString(buffer);
}

export function bufferToString(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export function stringToBuffer(string: string): Buffer {
  return Buffer.from(string, "utf-8");
}

export function stringToB64Url(string: string): string {
  return bufferTob64Url(stringToBuffer(string));
}

export function b64UrlToBuffer(b64UrlString: string): Buffer {
  return Buffer.from(b64UrlDecode(b64UrlString), "base64");
}

export function bufferTob64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function bufferTob64Url(buffer: Buffer): string {
  return b64UrlEncode(bufferTob64(buffer));
}

export function b64UrlEncode(b64String: string): string {
  try {
    return b64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  } catch (error) {
    throw new Error("Failed to encode string " + error);
  }
}

export function b64UrlDecode(b64UrlString: string): string {
  try {
    b64UrlString = b64UrlString.replace(/\-/g, "+").replace(/_/g, "/");
    const padding =
      b64UrlString.length % 4 === 0 ? 0 : 4 - (b64UrlString.length % 4);
    return b64UrlString.concat("=".repeat(padding));
  } catch (error) {
    throw new Error("Failed to decode string " + error);
  }
}
