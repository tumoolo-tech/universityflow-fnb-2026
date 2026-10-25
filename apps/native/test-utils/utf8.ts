/** Jest runs on Node, which has TextEncoder; the app's type library has no DOM, so declare it. */
declare const TextEncoder: new () => { encode(text: string): Uint8Array };

const encoder = new TextEncoder();

/** A string as UTF-8 bytes, as the network delivers it. */
export const utf8 = (text: string): Uint8Array => encoder.encode(text);
