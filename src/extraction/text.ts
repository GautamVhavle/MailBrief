export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes).replace(/^\uFEFF/, '');
}
