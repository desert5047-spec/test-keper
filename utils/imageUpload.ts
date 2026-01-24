import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export const uploadImage = async (
  imageUri: string,
  userId: string
): Promise<string> => {
  try {
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    let uploadData: Blob | Uint8Array;

    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      uploadData = blob;
    } else {
      const base64Data = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64Data) {
        throw new Error('画像データの読み込みに失敗しました');
      }

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      uploadData = bytes;
    }

    const { data, error } = await supabase.storage
      .from('test-images')
      .upload(filePath, uploadData, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (error) {
      throw new Error(`アップロードエラー: ${error.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('test-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('Image upload error:', error);
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
