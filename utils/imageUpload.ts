import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

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
      console.error('[画像圧縮エラー]', error);
      // 圧縮に失敗した場合は元のURIを返す
      return imageUri;
    }
  }
};

export const uploadImage = async (
  imageUri: string,
  userId: string
): Promise<string> => {
  console.log('[画像アップロード開始]', {
    platform: Platform.OS,
    uriPrefix: imageUri.substring(0, 50),
    userId,
  });

  try {
    // 画像を圧縮（JPEG形式、長辺1600px、圧縮率0.5）
    console.log('[画像圧縮開始]');
    const compressedUri = await compressImage(imageUri);
    console.log('[画像圧縮完了]', { compressedUri: compressedUri.substring(0, 50) });

    // JPEG形式で固定
    const fileExt = 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('[ファイル情報]', { fileName, filePath, fileExt });

    let bytes: Uint8Array;

    if (Platform.OS === 'web') {
      console.log('[Web] blobとして画像を読み込み中...');
      const response = await fetch(compressedUri);

      if (!response.ok) {
        throw new Error(`画像の取得に失敗: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('[Web] blob取得成功', { size: blob.size, type: blob.type });

      const arrayBuffer = await convertBlobToArrayBuffer(blob);
      bytes = new Uint8Array(arrayBuffer);
      console.log('[Web] ArrayBuffer変換成功', { byteLength: bytes.length });
    } else {
      console.log('[Native] ArrayBufferとして画像を読み込み中...');
      const response = await fetch(compressedUri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
      console.log('[Native] ArrayBuffer取得成功', { byteLength: bytes.length });
    }

    console.log('[Supabase] ストレージへアップロード中...');
    const { data, error } = await supabase.storage
      .from('test-images')
      .upload(filePath, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) {
      console.error('[Supabase] アップロードエラー', error);
      throw new Error(`アップロードエラー: ${error.message}`);
    }

    console.log('[Supabase] アップロード成功', data);

    const { data: urlData } = supabase.storage
      .from('test-images')
      .getPublicUrl(filePath);

    console.log('[完了] 公開URL取得', urlData.publicUrl);

    // Web環境でblob URLをクリーンアップ
    if (Platform.OS === 'web' && compressedUri.startsWith('blob:')) {
      URL.revokeObjectURL(compressedUri);
    }

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('[エラー] 画像アップロード失敗:', error);
    throw new Error(error.message || '画像のアップロードに失敗しました');
  }
};

export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    const urlParts = imageUrl.split('/test-images/');
    if (urlParts.length < 2) return;

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('test-images')
      .remove([filePath]);

    if (error) {
      console.error('Image deletion error:', error);
    }
  } catch (error) {
    console.error('Image deletion error:', error);
  }
};
