declare module 'plantuml-encoder' {
  const encoder: {
    encode(source: string): string;
    decode(encoded: string): string;
  };
  export default encoder;
  export function encode(source: string): string;
  export function decode(encoded: string): string;
}
