import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

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
    let fileExt = 'jpg';

    if (imageUri.includes('.')) {
      const ext = imageUri.split('.').pop()?.toLowerCase();
      if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        fileExt = ext;
      }
    }

    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('[ファイル情報]', { fileName, filePath, fileExt });

    let bytes: Uint8Array;

    if (Platform.OS === 'web') {
      console.log('[Web] blobとして画像を読み込み中...');
      const response = await fetch(imageUri);

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
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      bytes = new Uint8Array(arrayBuffer);
      console.log('[Native] ArrayBuffer取得成功', { byteLength: bytes.length });
    }

    console.log('[Supabase] ストレージへアップロード中...');
    const { data, error } = await supabase.storage
      .from('test-images')
      .upload(filePath, bytes, {
        contentType: `image/${fileExt}`,
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
