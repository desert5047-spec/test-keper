import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { log, error as logError } from '@/lib/logger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const MIN_SIZE = 60;
const CORNER_HIT = 48;
const EDGE_HIT = 28;

// カメラ画面と同じ 4:3（portrait）コンテナ
const CONTAINER_W = SCREEN_W;
const CONTAINER_H = Math.round(SCREEN_W * (4 / 3));

interface Props {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

type Drag = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right' | null;

interface Rect { x: number; y: number; w: number; h: number }

interface Layout {
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
}

// contentFit="contain" で画像が実際に描画される領域を計算
function computeLayout(iw: number, ih: number): Layout {
  if (!iw || !ih) return { renderedW: 0, renderedH: 0, offsetX: 0, offsetY: 0 };
  const imgAspect = iw / ih;
  const cAspect = CONTAINER_W / CONTAINER_H;
  let rw: number, rh: number;
  if (imgAspect > cAspect) {
    rw = CONTAINER_W;
    rh = CONTAINER_W / imgAspect;
  } else {
    rh = CONTAINER_H;
    rw = CONTAINER_H * imgAspect;
  }
  return {
    renderedW: Math.round(rw),
    renderedH: Math.round(rh),
    offsetX: Math.round((CONTAINER_W - rw) / 2),
    offsetY: Math.round((CONTAINER_H - rh) / 2),
  };
}

export function ImageCropEditor({ visible, imageUri, onCrop, onCancel }: Props) {
  const insets = useSafeAreaInsets();
  // 正規化済み画像URI — 表示とクロップの両方にこれを使う
  const [normUri, setNormUri] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const layout = computeLayout(imgSize.w, imgSize.h);
  const { renderedW, renderedH, offsetX, offsetY } = layout;

  const hintOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (ready) {
      hintOpacity.setValue(1);
      const timer = setTimeout(() => {
        Animated.timing(hintOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [ready]);

  const dragRef = useRef<{ type: Drag; start: Rect }>({ type: null, start: { x: 0, y: 0, w: 0, h: 0 } });
  const cropRef = useRef(crop);
  const layoutRef = useRef(layout);
  const imgRef = useRef(imgSize);
  const normUriRef = useRef(normUri);
  useEffect(() => { cropRef.current = crop; }, [crop]);
  useEffect(() => { layoutRef.current = layout; }, [layout]);
  useEffect(() => { imgRef.current = imgSize; }, [imgSize]);
  useEffect(() => { normUriRef.current = normUri; }, [normUri]);

  // EXIF 正規化してサイズを取得 → 正規化済み URI を保持
  useEffect(() => {
    if (!visible || !imageUri) { setReady(false); return; }
    setReady(false);
    let cancelled = false;

    (async () => {
      try {
        // manipulateAsync は EXIF 回転を焼き込んでから処理するため
        // 返却 width/height は表示向きと一致する
        const info = await ImageManipulator.manipulateAsync(
          imageUri,
          [],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (cancelled) return;

        log('[CropEditor] 正規化完了', {
          origUri: imageUri.slice(-40),
          normUri: info.uri.slice(-40),
          w: info.width,
          h: info.height,
        });

        setNormUri(info.uri);
        setImgSize({ w: info.width, h: info.height });
        setReady(true);
      } catch (e) {
        logError('[CropEditor] 正規化/サイズ取得エラー', e);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, imageUri]);

  // layout が確定したら初期 crop（画像表示領域の 90%）
  useEffect(() => {
    if (!ready || !renderedW || !renderedH) return;
    const mx = renderedW * 0.05, my = renderedH * 0.05;
    const initCrop = { x: mx, y: my, w: renderedW - mx * 2, h: renderedH - my * 2 };
    log('[CropEditor] layout', {
      containerW: CONTAINER_W, containerH: CONTAINER_H,
      renderedW, renderedH, offsetX, offsetY,
      imgW: imgSize.w, imgH: imgSize.h,
      initCrop,
    });
    setCrop(initCrop);
  }, [ready, renderedW, renderedH]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const lo = layoutRef.current;
        // タッチ座標をコンテナ基準 → 画像表示領域基準へ変換
        const tx = e.nativeEvent.locationX - lo.offsetX;
        const ty = e.nativeEvent.locationY - lo.offsetY;
        const type = hitTest(tx, ty, cropRef.current);
        dragRef.current = { type, start: { ...cropRef.current } };
      },
      onPanResponderMove: (_e, gs) => {
        const { type, start } = dragRef.current;
        if (!type) return;
        const lo = layoutRef.current;
        const next = apply(type, start, gs.dx, gs.dy, lo.renderedW, lo.renderedH);
        cropRef.current = next;
        setCrop(next);
      },
      onPanResponderRelease: () => { dragRef.current.type = null; },
    })
  ).current;

  const doCrop = async () => {
    const img = imgRef.current;
    const lo = layoutRef.current;
    const c = cropRef.current;
    const uri = normUriRef.current;

    if (!uri || !img.w || !lo.renderedW) return;
    setBusy(true);
    try {
      // 画像表示領域基準 → 元画像ピクセル座標へ変換
      // scaleX = 元画像幅 / 表示領域幅（コンテナ幅ではない）
      const scaleX = img.w / lo.renderedW;
      const scaleY = img.h / lo.renderedH;

      const originX = Math.max(0, Math.round(c.x * scaleX));
      const originY = Math.max(0, Math.round(c.y * scaleY));
      const width  = Math.min(img.w - originX, Math.max(1, Math.round(c.w * scaleX)));
      const height = Math.min(img.h - originY, Math.max(1, Math.round(c.h * scaleY)));

      log('[CropEditor] doCrop', {
        cropDisplay: { x: c.x.toFixed(1), y: c.y.toFixed(1), w: c.w.toFixed(1), h: c.h.toFixed(1) },
        scale: { x: scaleX.toFixed(3), y: scaleY.toFixed(3) },
        cropImage: { originX, originY, width, height },
        imgSize: { w: img.w, h: img.h },
        rendered: { w: lo.renderedW, h: lo.renderedH },
        offset: { x: lo.offsetX, y: lo.offsetY },
        normUri: uri.slice(-40),
      });

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      log('[CropEditor] crop結果', { w: result.width, h: result.height });
      onCrop(result.uri);
    } catch (e) {
      logError('[CropEditor] crop error', e);
      Alert.alert('エラー', 'トリミングに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !imageUri) return null;

  // オーバーレイ描画: crop は画像表示領域基準 → コンテナ基準に変換
  const oTop = offsetY + crop.y;
  const oLeft = offsetX + crop.x;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={st.root}>
        <View style={[st.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <TouchableOpacity onPress={onCancel} style={st.hBtn}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={st.title}>トリミング</Text>
          <TouchableOpacity
            onPress={doCrop}
            style={[st.hBtn, st.done, (busy || !ready) && st.off]}
            disabled={busy || !ready}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Check size={24} color="#fff" />}
          </TouchableOpacity>
        </View>

        <Animated.Text style={[st.hint, { opacity: hintOpacity }]}>
          角で調整 ・ 中央で移動
        </Animated.Text>

        <View style={st.body}>
          {ready && normUri ? (
            <View
              style={st.wrap}
              onLayout={(e) => {
                const { width: lw, height: lh } = e.nativeEvent.layout;
                log('[CropEditor] wrap onLayout', { actual: { lw, lh }, expected: { CONTAINER_W, CONTAINER_H } });
              }}
              {...pan.panHandlers}
            >
              {/* 正規化済み URI を表示 — crop 対象と同一ファイル */}
              <Image
                source={{ uri: normUri }}
                style={{ width: CONTAINER_W, height: CONTAINER_H }}
                contentFit="contain"
                cachePolicy="none"
              />
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[st.dk, { height: oTop }]} />
                <View style={{ flexDirection: 'row', height: crop.h }}>
                  <View style={[st.dk, { width: oLeft }]} />
                  <View style={[st.frame, { width: crop.w, height: crop.h }]}>
                    <View style={[st.edge, st.edgeTop]} />
                    <View style={[st.edge, st.edgeBottom]} />
                    <View style={[st.edge, st.edgeLeft]} />
                    <View style={[st.edge, st.edgeRight]} />
                    <View style={[st.cn, { top: -12, left: -12 }]} />
                    <View style={[st.cn, { top: -12, right: -12 }]} />
                    <View style={[st.cn, { bottom: -12, left: -12 }]} />
                    <View style={[st.cn, { bottom: -12, right: -12 }]} />
                  </View>
                  <View style={[st.dk, { flex: 1 }]} />
                </View>
                <View style={[st.dk, { flex: 1 }]} />
              </View>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#fff" />
          )}
        </View>

        <View style={st.footer} />
      </View>
    </Modal>
  );
}

function hitTest(tx: number, ty: number, c: Rect): Drag {
  const near = (px: number, py: number) =>
    Math.abs(tx - px) < CORNER_HIT && Math.abs(ty - py) < CORNER_HIT;
  if (near(c.x, c.y)) return 'tl';
  if (near(c.x + c.w, c.y)) return 'tr';
  if (near(c.x, c.y + c.h)) return 'bl';
  if (near(c.x + c.w, c.y + c.h)) return 'br';

  const inX = tx >= c.x + CORNER_HIT && tx <= c.x + c.w - CORNER_HIT;
  const inY = ty >= c.y + CORNER_HIT && ty <= c.y + c.h - CORNER_HIT;
  if (inX && Math.abs(ty - c.y) < EDGE_HIT) return 'top';
  if (inX && Math.abs(ty - (c.y + c.h)) < EDGE_HIT) return 'bottom';
  if (inY && Math.abs(tx - c.x) < EDGE_HIT) return 'left';
  if (inY && Math.abs(tx - (c.x + c.w)) < EDGE_HIT) return 'right';

  if (tx >= c.x && tx <= c.x + c.w && ty >= c.y && ty <= c.y + c.h) return 'move';
  return null;
}

function apply(t: Drag, s: Rect, dx: number, dy: number, mw: number, mh: number): Rect {
  let { x, y, w, h } = s;
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  switch (t) {
    case 'move':
      return { x: cl(x + dx, 0, mw - w), y: cl(y + dy, 0, mh - h), w, h };
    case 'tl': {
      const nx = cl(x + dx, 0, x + w - MIN_SIZE);
      const ny = cl(y + dy, 0, y + h - MIN_SIZE);
      return { x: nx, y: ny, w: w + (x - nx), h: h + (y - ny) };
    }
    case 'tr': {
      const ny = cl(y + dy, 0, y + h - MIN_SIZE);
      return { x, y: ny, w: cl(w + dx, MIN_SIZE, mw - x), h: h + (y - ny) };
    }
    case 'bl': {
      const nx = cl(x + dx, 0, x + w - MIN_SIZE);
      return { x: nx, y, w: w + (x - nx), h: cl(h + dy, MIN_SIZE, mh - y) };
    }
    case 'br':
      return { x, y, w: cl(w + dx, MIN_SIZE, mw - x), h: cl(h + dy, MIN_SIZE, mh - y) };
    case 'top': {
      const ny = cl(y + dy, 0, y + h - MIN_SIZE);
      return { x, y: ny, w, h: h + (y - ny) };
    }
    case 'bottom':
      return { x, y, w, h: cl(h + dy, MIN_SIZE, mh - y) };
    case 'left': {
      const nx = cl(x + dx, 0, x + w - MIN_SIZE);
      return { x: nx, y, w: w + (x - nx), h };
    }
    case 'right':
      return { x, y, w: cl(w + dx, MIN_SIZE, mw - x), h };
    default:
      return s;
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  hBtn: { padding: 10 },
  done: { backgroundColor: '#4A90E2', borderRadius: 22 },
  off: { opacity: 0.4 },
  title: { fontSize: 18, fontFamily: 'Nunito-Bold', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  wrap: { width: CONTAINER_W, height: CONTAINER_H, position: 'relative' },
  dk: { backgroundColor: 'rgba(0,0,0,0.6)' },
  frame: { borderWidth: 2, borderColor: '#fff', position: 'relative' },
  edge: { position: 'absolute', backgroundColor: '#fff' },
  edgeTop: { top: -1, left: '20%', right: '20%', height: 3 },
  edgeBottom: { bottom: -1, left: '20%', right: '20%', height: 3 },
  edgeLeft: { left: -1, top: '20%', bottom: '20%', width: 3 },
  edgeRight: { right: -1, top: '20%', bottom: '20%', width: 3 },
  cn: {
    position: 'absolute', width: 32, height: 32,
    backgroundColor: '#fff', borderWidth: 3, borderColor: '#4A90E2', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4, shadowRadius: 2, elevation: 4,
  },
  footer: { height: 44 },
  hint: {
    fontSize: 13, fontFamily: 'Nunito-Regular',
    color: 'rgba(255,255,255,0.5)', textAlign: 'center',
    paddingBottom: 6,
  },
});
