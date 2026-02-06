import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const STORAGE_BUCKET = 'test-images';
const SIGNED_URL_EXPIRES_IN = 60 * 60;

const isHttpUrl = (value: string) => value.startsWith('http://') || value.startsWith('https://');

const debugLog = (...args: unknown[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const getStoragePathFromUrl = (url: string): string | null => {
  try {
    if (!isHttpUrl(url)) return null;
    const marker = '/storage/v1/object/';
    const index = url.indexOf(marker);
    if (index === -1) return null;
    const after = url.substring(index + marker.length);
    const parts = after.split('/');
    if (parts[0] === 'public') {
      parts.shift();
    }
    const bucket = parts.shift();
    if (!bucket || bucket !== STORAGE_BUCKET) return null;
    const path = parts.join('/');
    return path ? path : null;
  } catch {
    return null;
  }
};

export const getSignedImageUrl = async (
  uriOrPath: string | null,
  expiresIn = SIGNED_URL_EXPIRES_IN
): Promise<string | null> => {
  if (!uriOrPath) return null;
  if (isHttpUrl(uriOrPath)) {
    const storagePath = getStoragePathFromUrl(uriOrPath);
    if (!storagePath) {
      return uriOrPath;
    }
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error || !data?.signedUrl) {
      console.warn('[画像URL] 署名付きURL取得失敗');
      return uriOrPath;
    }
    return data.signedUrl;
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(uriOrPath, expiresIn);
  if (error || !data?.signedUrl) {
    console.warn('[画像URL] 署名付きURL取得失敗');
    return null;
  }
  return data.signedUrl;
};

const convertBlobToArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to ArrayBuffer'));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * base64文字列をUint8Arrayに変換（React Native用）
 * シンプルで確実な実装
 */
const base64ToUint8Array = (base64: string): Uint8Array => {
  try {
    if (!base64 || typeof base64 !== 'string') {
      throw new Error('base64文字列が無効です（型エラー）');
    }
    
    // base64文字列から改行や空白を除去
    const cleanBase64 = base64.replace(/[\s\n\r]/g, '');
    
    if (cleanBase64.length === 0) {
      throw new Error('base64文字列が空です');
    }
    
    // 大きすぎるbase64文字列をチェック（100MB制限）
    const maxLength = 100 * 1024 * 1024; // 100MB
    if (cleanBase64.length > maxLength) {
      throw new Error(`base64文字列が大きすぎます（${Math.round(cleanBase64.length / 1024 / 1024)}MB）`);
    }
    
    // base64デコードテーブル
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup: number[] = new Array(256).fill(-1);
    for (let i = 0; i < base64Chars.length; i++) {
      lookup[base64Chars.charCodeAt(i)] = i;
    }
    lookup['='.charCodeAt(0)] = 0;
    
    // パディングを考慮したバッファサイズの計算
    let paddingCount = 0;
    if (cleanBase64.endsWith('==')) paddingCount = 2;
    else if (cleanBase64.endsWith('=')) paddingCount = 1;
    
    const bufferLength = Math.floor((cleanBase64.length * 3) / 4) - paddingCount;
    if (bufferLength <= 0) {
      throw new Error('無効なbase64文字列です（バッファサイズが0以下）');
    }
    
    // メモリ不足を防ぐため、バッファサイズをチェック
    if (bufferLength > maxLength) {
      throw new Error(`デコード後のバッファサイズが大きすぎます（${Math.round(bufferLength / 1024 / 1024)}MB）`);
    }
    
    const bytes = new Uint8Array(bufferLength);
    let byteIndex = 0;
    const len = cleanBase64.length;
    
    for (let i = 0; i < len; i += 4) {
      // 4文字ずつ処理
      if (i + 3 >= len) break;
      
      const char1 = cleanBase64.charCodeAt(i);
      const char2 = cleanBase64.charCodeAt(i + 1);
      const char3 = cleanBase64.charCodeAt(i + 2);
      const char4 = cleanBase64.charCodeAt(i + 3);
      
      const encoded1 = lookup[char1];
      const encoded2 = lookup[char2];
      const encoded3 = char3 === '='.charCodeAt(0) ? 64 : lookup[char3];
      const encoded4 = char4 === '='.charCodeAt(0) ? 64 : lookup[char4];
      
      if (encoded1 === -1 || encoded2 === -1) {
        throw new Error(`無効なbase64文字（位置 ${i}）`);
      }
      
      const bitmap = (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;
      
      if (byteIndex < bufferLength && encoded3 !== 64) {
        bytes[byteIndex++] = (bitmap >> 16) & 255;
      }
      if (byteIndex < bufferLength && encoded4 !== 64) {
        bytes[byteIndex++] = (bitmap >> 8) & 255;
      }
      if (byteIndex < bufferLength && encoded4 !== 64) {
        bytes[byteIndex++] = bitmap & 255;
      }
    }
    
    // 実際に書き込んだバイト数に合わせてリサイズ
    const result = bytes.slice(0, byteIndex);
    
    if (result.length === 0) {
      throw new Error('デコード結果が空です');
    }
    
    return result;
  } catch (error: any) {
    console.error('[base64ToUint8Array] エラー');
    throw new Error(`base64デコードに失敗しました: ${error.message || '不明なエラー'}`);
  }
};

/**
 * 画像をJPEG形式、長辺1600px、圧縮率0.5に圧縮
 */
const compressImage = async (imageUri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    // Web環境ではCanvas APIを使用
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // 長辺を1600pxにリサイズ
        const maxDimension = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // JPEG形式、圧縮率0.5でエクスポート
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const compressedUri = URL.createObjectURL(blob);
            resolve(compressedUri);
          },
          'image/jpeg',
          0.5
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUri;
    });
  } else {
    // Native環境ではImageManipulatorを使用
    try {
      // まず画像のサイズを取得
      const { width, height } = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );

      // 長辺を1600pxにリサイズ
      const maxDimension = 1600;
      let newWidth = width;
      let newHeight = height;

      if (width > height) {
        if (width > maxDimension) {
          newHeight = Math.round((height * maxDimension) / width);
          newWidth = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          newWidth = Math.round((width * maxDimension) / height);
          newHeight = maxDimension;
        }
      }

      // リサイズと圧縮を実行
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: newWidth, height: newHeight } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return result.uri;
    } catch (error: any) {
      console.error('[画像圧縮エラー]');
      // 圧縮に失敗した場合は元のURIを返す
      return imageUri;
    }
  }
};

export const uploadImage = async (
  imageUri: string,
  userId: string
): Promise<string> => {
  debugLog('[画像アップロード開始]', {
    platform: Platform.OS,
  });

  if (!imageUri || imageUri.trim() === '') {
    throw new Error('画像URIが無効です');
  }

  if (!userId || userId.trim() === '') {
    throw new Error('ユーザーIDが無効です');
  }

  let compressedUri: string | null = null;

  try {
    // 画像を圧縮（JPEG形式、長辺1600px、圧縮率0.5）
    debugLog('[画像圧縮開始]');
    try {
      compressedUri = await compressImage(imageUri);
      if (!compressedUri || compressedUri.trim() === '') {
        throw new Error('圧縮後のURIが空です');
      }
      debugLog('[画像圧縮完了]');
    } catch (compressError: any) {
      console.error('[画像圧縮エラー]');
      // 圧縮に失敗した場合は元のURIを使用
      compressedUri = imageUri;
      debugLog('[画像圧縮] 元のURIを使用');
    }

    if (!compressedUri || compressedUri.trim() === '') {
      throw new Error('画像URIが無効です');
    }

    // JPEG形式で固定
    const fileExt = 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    debugLog('[ファイル情報]', { fileName, fileExt });

    let bytes: Uint8Array;

    if (Platform.OS === 'web') {
      debugLog('[Web] blobとして画像を読み込み中...');
      try {
        const response = await fetch(compressedUri);

        if (!response.ok) {
          throw new Error(`画像の取得に失敗: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        debugLog('[Web] blob取得成功', { size: blob.size, type: blob.type });

        const arrayBuffer = await convertBlobToArrayBuffer(blob);
        bytes = new Uint8Array(arrayBuffer);
        debugLog('[Web] ArrayBuffer変換成功', { byteLength: bytes.length });
      } catch (error: any) {
        console.error('[Web] fetchエラー、フォールバック処理');
        throw new Error(`画像の読み込みに失敗しました: ${error.message}`);
      }
    } else {
      // Native環境（Android/iOS Expo Go含む）
      debugLog('[Native] 画像を読み込み中...');
      
      // Expo Goではfetchがfile://スキームで失敗する可能性があるため、FileSystemを優先
      let readSuccess = false;
      
      // Expo Goではfetchがfile://スキームで失敗する可能性が高いため、FileSystemを優先
      let lastError: Error | null = null;
      
      // まずFileSystemを試す（Expo Goでより確実）
      try {
        debugLog('[Native] FileSystemで読み込みを試行...', { 
          uri: compressedUri?.substring?.(0, 50) || 'N/A',
          platform: Platform.OS 
        });
        
        // FileSystemでbase64として読み込む（タイムアウト付き）
        const readPromise = FileSystem.readAsStringAsync(compressedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('FileSystem読み込みがタイムアウトしました（30秒）')), 30000);
        });
        
        const base64 = await Promise.race([readPromise, timeoutPromise]);
        
        if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
          throw new Error('base64データが空です');
        }
        
        debugLog('[Native] FileSystemでbase64取得成功', { 
          length: base64.length,
          platform: Platform.OS 
        });
        
        // base64をUint8Arrayに変換（タイムアウト付き）
        try {
          const decodePromise = Promise.resolve(base64ToUint8Array(base64));
          const decodeTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('base64デコードがタイムアウトしました（10秒）')), 10000);
          });
          
          bytes = await Promise.race([decodePromise, decodeTimeoutPromise]);
          
          debugLog('[Native] base64からUint8Array変換成功', { 
            byteLength: bytes.length,
            platform: Platform.OS 
          });
          
          if (!bytes || bytes.length === 0) {
            throw new Error('Uint8Arrayが空です');
          }
          
          readSuccess = true;
        } catch (decodeError: any) {
          console.error('[Native] base64デコードエラー');
          lastError = new Error(`base64デコードに失敗しました: ${decodeError.message || '不明なエラー'}`);
          throw lastError;
        }
      } catch (fileSystemError: any) {
        debugLog('[Native] FileSystem読み込み失敗、fetchを試行:', {
          message: fileSystemError?.message,
          platform: Platform.OS,
        });
        lastError = fileSystemError;
        
        // FileSystemが失敗した場合、fetchを試す（フォールバック）
        try {
          debugLog('[Native] fetchで読み込みを試行...', { platform: Platform.OS });
          
          const fetchPromise = fetch(compressedUri);
          const fetchTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('fetchがタイムアウトしました（30秒）')), 30000);
          });
          
          const response = await Promise.race([fetchPromise, fetchTimeoutPromise]);
          
          if (!response.ok) {
            throw new Error(`画像の取得に失敗: ${response.status} ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          bytes = new Uint8Array(arrayBuffer);
          debugLog('[Native] fetchで取得成功', { 
            byteLength: bytes.length,
            platform: Platform.OS 
          });
          
          if (!bytes || bytes.length === 0) {
            throw new Error('fetchで取得したデータが空です');
          }
          
          readSuccess = true;
          lastError = null; // 成功したのでエラーをクリア
        } catch (fetchError: any) {
          console.error('[Native] fetchも失敗');
          lastError = fetchError;
          throw new Error(`画像の読み込みに失敗しました: ${fileSystemError?.message || fetchError?.message || '不明なエラー'}`);
        }
      }
      
      if (!readSuccess || !bytes || bytes.length === 0) {
        const errorMsg = lastError?.message || '画像データの読み込みに失敗しました（データが空です）';
        throw new Error(errorMsg);
      }
    }

    debugLog('[Supabase] ストレージへアップロード中...', { 
      byteLength: bytes.length,
      platform: Platform.OS 
    });
    
    try {
      // アップロード処理にタイムアウトを設定（120秒）
      const uploadPromise = supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: false,
        });
      
      const uploadTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Supabaseアップロードがタイムアウトしました（120秒）')), 120000);
      });
      
      const { data, error } = await Promise.race([uploadPromise, uploadTimeoutPromise]);

      if (error) {
        console.error('[Supabase] アップロードエラー');
        throw new Error(`アップロードエラー: ${error.message || '不明なエラー'}`);
      }

      if (!data) {
        throw new Error('アップロードデータが取得できませんでした');
      }

      debugLog('[Supabase] アップロード成功', { 
        platform: Platform.OS 
      });

      // 公開URLの取得
      // Web環境でblob URLをクリーンアップ
      if (Platform.OS === 'web' && compressedUri && compressedUri.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(compressedUri);
        } catch (revokeError) {
          console.warn('[Web] blob URLクリーンアップエラー');
        }
      }

      return filePath;
    } catch (uploadError: any) {
      console.error('[Supabase] アップロード処理エラー');
      throw uploadError;
    }
  } catch (error: any) {
    console.error('[エラー] 画像アップロード失敗');
    
    // エラーメッセージを構築（安全に）
    let errorMessage = '画像のアップロードに失敗しました';
    try {
      if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error?.toString && typeof error.toString === 'function') {
        const errorStr = error.toString();
        if (errorStr && errorStr !== '[object Object]') {
          errorMessage = errorStr;
        }
      }
    } catch (msgError: any) {
      console.error('[エラー] エラーメッセージ構築エラー');
      // デフォルトメッセージを使用
    }
    
    // 新しいエラーオブジェクトを作成（スタックトレースを保持）
    const uploadError = new Error(errorMessage);
    if (error?.stack) {
      uploadError.stack = error.stack;
    }
    throw uploadError;
  }
};

export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    if (!imageUrl) return;
    let filePath: string | null = null;
    if (isHttpUrl(imageUrl)) {
      filePath = getStoragePathFromUrl(imageUrl);
      if (!filePath) return;
    } else {
      filePath = imageUrl;
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Image deletion error');
    }
  } catch (error) {
    console.error('Image deletion error');
  }
};
