type Hashable = string | Uint8Array | Array<any> | ArrayBuffer;

declare module 'js-sha1' {
  export default function (input: Hashable): string;
  export function hex(input: Hashable): string;
  export function array(input: Hashable): number[];
  export function digest(input: Hashable): number[];
  export function arrayBuffer(input: Hashable): ArrayBuffer;
}

declare module 'bodec' {
  export function toUnicode(binary, start?, end?): string;
  export function fromUnicode(unicode: string, binary?: number[], offset?: number): number[];
  export type Binary = Uint8Array;
  // Utility functions
  export function isBinary(value: any): boolean;
  export function create(length: number): Uint8Array;
  export function join(chunks: any[]): Uint8Array;

  // Binary input and output
  export function copy(source, binary, offset): Uint8Array;
  export function slice(source, start?, end?): Uint8Array;

  // String input and output
  export function toRaw(binary, start?, end?): string;
  export function fromRaw(raw: string, binary?, offset?): Uint8Array;
  export function toHex(binary, start?, end?);
  export function fromHex(hex);
  export function toBase64(binary, start?, end?);
  export function fromBase64(base64, binary, offset?);

  // Array input and output
  export function toArray(binary, start?, end?);
  export function fromArray(array, binary, offset);

  // Raw <-> Hex-encoded codec
  export function decodeHex(hex);
  export function encodeHex(raw);

  export function decodeBase64(base64);
  export function encodeBase64(raw);

  // Unicode <-> Utf8-encoded-raw codec
  export function encodeUtf8(utf8);
  export function decodeUtf8(utf8);

  // Hex <-> Nibble codec
  export function nibbleToCode(nibble);
  export function codeToNibble(code);

}
