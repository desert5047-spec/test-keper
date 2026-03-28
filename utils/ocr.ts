import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import { log } from '@/lib/logger';
import { Platform } from 'react-native';

export interface OcrBlock {
  text: string;
  lines: string[];
}

export interface OcrResult {
  text: string;
  blocks: OcrBlock[];
  raw: unknown;
}

/**
 * 端末内 ML Kit で画像から日本語テキストを認識する。
 * iOS / Android 両対応。Dev Client ビルドが必要。
 */
export async function recognizeText(imageUri: string): Promise<OcrResult> {
  const t0 = Date.now();
  log('[OCR] start', { uri: imageUri.slice(-50), platform: Platform.OS });

  const result = await TextRecognition.recognize(
    imageUri,
    TextRecognitionScript.JAPANESE,
  );

  const blocks: OcrBlock[] = result.blocks.map((b) => ({
    text: b.text,
    lines: b.lines.map((l) => l.text),
  }));

  const elapsed = Date.now() - t0;
  log('[OCR] done', { elapsed, chars: result.text.length, blocks: blocks.length });

  return {
    text: result.text,
    blocks,
    raw: result,
  };
}
