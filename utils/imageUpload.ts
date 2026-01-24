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

    let uploadData: Blob | ArrayBuffer;

    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      uploadData = await response.blob();
    } else {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      uploadData = byteArray.buffer;
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
