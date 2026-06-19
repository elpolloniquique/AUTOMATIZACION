declare module 'opentype.js' {
  export interface Font {
    getPath(text: string, x: number, y: number, fontSize: number, options?: { kerning?: boolean }): Path;
    getAdvanceWidth(text: string, fontSize: number): number;
  }
  export interface Path {
    toPathData(decimalPlaces?: number): string;
  }
  export function parse(buffer: ArrayBuffer): Font;
}
