import { supabase } from '@/lib/supabase';

export const uploadImage = async (
  imageUri: string,
  userId: string
): Promise<string> => {
  try {
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const response = await fetch(imageUri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from('test-images')
      .upload(filePath, bytes, {
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
