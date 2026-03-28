import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image as RNImage,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Check, X } from 'lucide-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { error as logError } from '@/lib/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PADDING = 20;
const MIN_SIZE = 60;
const CORNER_HIT = 48;
const EDGE_HIT = 28;

interface Props {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

type Drag = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right' | null;

interface Rect { x: number; y: number; w: number; h: number }

export function ImageCropEditor({ visible, imageUri, onCrop, onCancel }: Props) {
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [dispSize, setDispSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  const dragRef = useRef<{ type: Drag; start: Rect }>({ type: null, start: { x: 0, y: 0, w: 0, h: 0 } });
  const cropRef = useRef(crop);
  const dispRef = useRef(dispSize);
  useEffect(() => { cropRef.current = crop; }, [crop]);
  useEffect(() => { dispRef.current = dispSize; }, [dispSize]);

  useEffect(() => {
    if (!visible || !imageUri) return;
    RNImage.getSize(
      imageUri,
      (w, h) => {
        setImgSize({ w, h });
        const maxW = SCREEN_WIDTH - PADDING * 2;
        const maxH = SCREEN_HEIGHT * 0.6;
        const r = w / h;
        let dw = maxW, dh = maxW / r;
        if (dh > maxH) { dh = maxH; dw = maxH * r; }
        setDispSize({ w: dw, h: dh });
        const mx = dw * 0.05, my = dh * 0.05;
        setCrop({ x: mx, y: my, w: dw - mx * 2, h: dh - my * 2 });
      },
      () => logError('画像サイズ取得エラー')
    );
  }, [visible, imageUri]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: tx, locationY: ty } = e.nativeEvent;
        const type = hitTest(tx, ty, cropRef.current);
        dragRef.current = { type, start: { ...cropRef.current } };
      },
      onPanResponderMove: (_e, gs) => {
        const { type, start } = dragRef.current;
        if (!type) return;
        const d = dispRef.current;
        const next = apply(type, start, gs.dx, gs.dy, d.w, d.h);
        cropRef.current = next;
        setCrop(next);
      },
      onPanResponderRelease: () => { dragRef.current.type = null; },
    })
  ).current;

  const doCrop = async () => {
    if (!imageUri || !imgSize.w) return;
    setBusy(true);
    try {
      const sx = imgSize.w / dispSize.w;
      const sy = imgSize.h / dispSize.h;
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: {
          originX: Math.round(crop.x * sx),
          originY: Math.round(crop.y * sy),
          width: Math.max(1, Math.round(crop.w * sx)),
          height: Math.max(1, Math.round(crop.h * sy)),
        }}],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );
      onCrop(result.uri);
    } catch {
      Alert.alert('エラー', 'トリミングに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={onCancel} style={s.hBtn}><X size={24} color="#fff" /></TouchableOpacity>
          <Text style={s.title}>トリミング</Text>
          <TouchableOpacity onPress={doCrop} style={[s.hBtn, s.done, busy && s.off]} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Check size={24} color="#fff" />}
          </TouchableOpacity>
        </View>

        <View style={s.body}>
          <View style={[s.wrap, { width: dispSize.w, height: dispSize.h }]} {...pan.panHandlers}>
            <Image source={imageUri} style={{ width: dispSize.w, height: dispSize.h }} contentFit="contain" />
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[s.dk, { height: crop.y }]} />
              <View style={{ flexDirection: 'row', height: crop.h }}>
                <View style={[s.dk, { width: crop.x }]} />
                <View style={[s.frame, { width: crop.w, height: crop.h }]}>
                  <View style={[s.edge, s.edgeTop]} />
                  <View style={[s.edge, s.edgeBottom]} />
                  <View style={[s.edge, s.edgeLeft]} />
                  <View style={[s.edge, s.edgeRight]} />
                  <View style={[s.cn, { top: -10, left: -10 }]} />
                  <View style={[s.cn, { top: -10, right: -10 }]} />
                  <View style={[s.cn, { bottom: -10, left: -10 }]} />
                  <View style={[s.cn, { bottom: -10, right: -10 }]} />
                </View>
                <View style={[s.dk, { flex: 1 }]} />
              </View>
              <View style={[s.dk, { flex: 1 }]} />
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.hint}>コーナー・辺をドラッグでサイズ調整{'\n'}中央ドラッグで移動</Text>
        </View>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  hBtn: { padding: 10 },
  done: { backgroundColor: '#4A90E2', borderRadius: 22 },
  off: { opacity: 0.4 },
  title: { fontSize: 18, fontFamily: 'Nunito-Bold', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: PADDING },
  wrap: { position: 'relative' },
  dk: { backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', position: 'relative' },
  edge: { position: 'absolute', backgroundColor: '#fff' },
  edgeTop: { top: -1, left: '20%', right: '20%', height: 3 },
  edgeBottom: { bottom: -1, left: '20%', right: '20%', height: 3 },
  edgeLeft: { left: -1, top: '20%', bottom: '20%', width: 3 },
  edgeRight: { right: -1, top: '20%', bottom: '20%', width: 3 },
  cn: {
    position: 'absolute', width: 28, height: 28,
    backgroundColor: '#4A90E2', borderWidth: 3, borderColor: '#fff', borderRadius: 14,
  },
  footer: { paddingBottom: 44, alignItems: 'center' },
  hint: { fontSize: 13, fontFamily: 'Nunito-Regular', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
