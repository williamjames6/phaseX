import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Dimensions, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../../../lib/supabase';

const { width, height } = Dimensions.get('window');
const ERASE_HIT_THRESHOLD = 5;

interface PathData {
  d: string;
  filled: boolean;
}

type DrawMode = 'x' | 'o' | 'solid' | 'dashed' | 'x-circle' | 'o-filled' | 'solid-grey' | 'dashed-grey' | 'erase';

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointNearPath(px: number, py: number, pathD: string, threshold: number): boolean {
  const nums = pathD.match(/[-+]?\d*\.?\d+/g)?.map(Number);
  if (!nums || nums.length < 2) return false;

  if (pathD.includes('A') && nums.length >= 3) {
    const startX = nums[0];
    const startY = nums[1];
    const r = nums[2];
    const cx = startX - r;
    const cy = startY;
    const dist = Math.hypot(px - cx, py - cy);
    return Math.abs(dist - r) <= threshold || dist <= r + threshold;
  }

  if (pathD.includes('L') && nums.length >= 4) {
    return distToSegment(px, py, nums[0], nums[1], nums[2], nums[3]) <= threshold;
  }

  return Math.hypot(px - nums[0], py - nums[1]) <= threshold;
}

function isElementHit(px: number, py: number, element: PathData[], threshold = ERASE_HIT_THRESHOLD): boolean {
  return element.some((path) => pointNearPath(px, py, path.d, threshold));
}

export default function NewSketchScreen() {
  const params = useLocalSearchParams();
  const [elements, setElements] = useState<PathData[][]>([]);
  const [greyElements, setGreyElements] = useState<PathData[][]>([]);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<DrawMode>('solid');
  const actionId = params.actionId as string;
  const sessionId = params.sessionId as string;
  const appState = useRef(AppState.currentState);
  const hasUnsavedChanges = useRef(false);
  const sketchDataRef = useRef<{ elements: PathData[][]; greyElements: PathData[][] }>({
    elements: [],
    greyElements: [],
  });

  useEffect(() => {
    sketchDataRef.current = { elements, greyElements };
  }, [elements, greyElements]);

  const isGreyMode = (currentMode: string) => {
    return currentMode === 'solid-grey' || currentMode === 'dashed-grey';
  };

  const addElement = (newPaths: PathData[]) => {
    if (isGreyMode(mode)) {
      setGreyElements((prev) => [...prev, newPaths]);
    } else {
      setElements((prev) => [...prev, newPaths]);
    }
  };

  const handleAutoSave = useCallback(async () => {
    if (!actionId || !sessionId || !hasUnsavedChanges.current) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.log('User not logged in, skipping auto-save');
        return;
      }

      const currentPaths = sketchDataRef.current.elements.flat();
      const currentGreyPaths = sketchDataRef.current.greyElements.flat();
      if (currentPaths.length === 0 && currentGreyPaths.length === 0) {
        return;
      }

      await supabase
        .from('TacticalSketches')
        .upsert([
          {
            user_id: user.id,
            paths: currentPaths,
            grey_paths: currentGreyPaths,
            id: params.sketchId,
          },
        ], { onConflict: 'id' });

      hasUnsavedChanges.current = false;
      console.log('Sketch auto-saved successfully');
    } catch (error: unknown) {
      console.error('Error in auto-save:', error);
    }
  }, [actionId, sessionId, params.sketchId]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground');
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App has gone to the background, auto-saving...');
        handleAutoSave();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAutoSave]);

  useFocusEffect(
    useCallback(() => {
      const handleRender = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            alert('You must be logged in to save sketches');
            return;
          }
          const { data: sketchData, error: sketchError } = await supabase
            .from('TacticalSketches')
            .select('paths, grey_paths')
            .eq('id', params.sketchId)
            .maybeSingle();

          if (sketchError) {
            console.log(sketchData);
            throw sketchError;
          }
          if (sketchData) {
            const convertToPathData = (pathArray: any[]): PathData[] => {
              if (!pathArray || pathArray.length === 0) return [];
              return pathArray.map((path) => {
                if (typeof path === 'string') {
                  return { d: path, filled: false };
                }
                return path;
              });
            };

            const blackPaths = convertToPathData(sketchData.paths);
            const greyPaths = convertToPathData(sketchData.grey_paths);

            setElements(blackPaths.map((path) => [path]));
            setGreyElements(greyPaths.map((path) => [path]));
            console.log('Black paths:', blackPaths);
            console.log('Grey paths:', greyPaths);
          }
        } catch (error: unknown) {
          console.error('Error in handleRender:', error);
          if (error instanceof Error) {
            alert('Error loading sketch: ' + error.message);
          } else {
            alert('An unknown error occurred while loading the sketch');
          }
        }
      };

      handleRender();

      return () => {
        console.log('Screen losing focus, auto-saving...');
        handleAutoSave();

        const hasPaths =
          sketchDataRef.current.elements.length > 0 ||
          sketchDataRef.current.greyElements.length > 0;
        if (hasPaths) {
          console.log('Sketch has paths, button should be red');
        }
      };
    }, [handleAutoSave])
  );

  const eraseAtPoint = (locationX: number, locationY: number) => {
    const blackHit = elements.findIndex((element) => isElementHit(locationX, locationY, element));
    if (blackHit !== -1) {
      setElements((prev) => prev.filter((_, index) => index !== blackHit));
      hasUnsavedChanges.current = true;
      return;
    }

    const greyHit = greyElements.findIndex((element) => isElementHit(locationX, locationY, element));
    if (greyHit !== -1) {
      setGreyElements((prev) => prev.filter((_, index) => index !== greyHit));
      hasUnsavedChanges.current = true;
    }
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;

    if (mode === 'erase') {
      eraseAtPoint(locationX, locationY);
      return;
    }

    if (mode === 'x') {
      const half = 4 * Math.sqrt(2);
      const horiz = `M ${locationX - half} ${locationY - half} L ${locationX + half} ${locationY + half}`;
      const vert = `M ${locationX - half} ${locationY + half} L ${locationX + half} ${locationY - half}`;
      addElement([
        { d: horiz, filled: false },
        { d: vert, filled: false },
      ]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'x-circle') {
      const half = 4 * Math.sqrt(2);
      const r = 8;
      const horiz = `M ${locationX - half} ${locationY - half} L ${locationX + half} ${locationY + half}`;
      const vert = `M ${locationX - half} ${locationY + half} L ${locationX + half} ${locationY - half}`;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      addElement([
        { d: horiz, filled: false },
        { d: vert, filled: false },
        { d: circle, filled: false },
      ]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'o') {
      const r = 8;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      addElement([{ d: circle, filled: false }]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'o-filled') {
      const r = 8;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      addElement([{ d: circle, filled: true }]);
      hasUnsavedChanges.current = true;
      return;
    }
    setStartPoint({ x: locationX, y: locationY });
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (mode === 'erase') {
      return;
    }

    if (!startPoint) return;

    const { locationX, locationY } = event.nativeEvent;
    const endPoint = { x: locationX, y: locationY };

    const addArrowHeadSegments = (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const arrowLen = 10;
      const angle = Math.PI / 6;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const rx1 = (-ux * cos - -uy * sin);
      const ry1 = (-ux * sin + -uy * cos);
      const rx2 = (-ux * cos - -uy * -sin);
      const ry2 = (-ux * -sin + -uy * cos);
      const a1x = end.x + rx1 * arrowLen;
      const a1y = end.y + ry1 * arrowLen;
      const a2x = end.x + rx2 * arrowLen;
      const a2y = end.y + ry2 * arrowLen;
      const head1 = `M ${end.x} ${end.y} L ${a1x} ${a1y}`;
      const head2 = `M ${end.x} ${end.y} L ${a2x} ${a2y}`;
      return [head1, head2];
    };

    if (mode === 'solid' || mode === 'solid-grey') {
      const line = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;
      const heads = addArrowHeadSegments(startPoint, endPoint);
      addElement([
        { d: line, filled: false },
        ...heads.map((head) => ({ d: head, filled: false })),
      ]);
      setStartPoint(null);
      hasUnsavedChanges.current = true;
      return;
    }

    if (mode === 'dashed' || mode === 'dashed-grey') {
      const dash = 6;
      const gap = 4;
      const outSegments: string[] = [];

      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const totalLen = Math.hypot(dx, dy);
      if (totalLen === 0) {
        setStartPoint(null);
        return;
      }

      const ux = dx / totalLen;
      const uy = dy / totalLen;
      let dist = 0;
      let draw = true;

      while (dist < totalLen) {
        const l = Math.min(draw ? dash : gap, totalLen - dist);
        if (draw) {
          const sx = startPoint.x + ux * dist;
          const sy = startPoint.y + uy * dist;
          const ex = startPoint.x + ux * (dist + l);
          const ey = startPoint.y + uy * (dist + l);
          outSegments.push(`M ${sx} ${sy} L ${ex} ${ey}`);
        }
        dist += l;
        draw = !draw;
      }

      const heads = addArrowHeadSegments(startPoint, endPoint);
      addElement([
        ...outSegments.map((segment) => ({ d: segment, filled: false })),
        ...heads.map((head) => ({ d: head, filled: false })),
      ]);
      setStartPoint(null);
      hasUnsavedChanges.current = true;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('x')} style={[styles.toolButton, mode === 'x' && styles.toolActive]}>
            <Text style={styles.toolIcon}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('x-circle')} style={[styles.toolButton, mode === 'x-circle' && styles.toolActive]}>
            <Text style={styles.toolIcon}>⨂</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('o')} style={[styles.toolButton, mode === 'o' && styles.toolActive]}>
            <Text style={styles.toolIcon}>○</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('o-filled')} style={[styles.toolButton, mode === 'o-filled' && styles.toolActive]}>
            <Text style={styles.toolIcon}>●</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('solid')} style={[styles.toolButton, mode === 'solid' && styles.toolActive]}>
            <Text style={styles.toolIcon}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('solid-grey')} style={[styles.toolButton, mode === 'solid-grey' && styles.toolActive]}>
            <Text style={[styles.toolIcon, { color: '#acb3b9' }]}>→</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('dashed')} style={[styles.toolButton, mode === 'dashed' && styles.toolActive]}>
            <Text style={styles.toolIcon}>⇢</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('dashed-grey')} style={[styles.toolButton, mode === 'dashed-grey' && styles.toolActive]}>
            <Text style={[styles.toolIcon, { color: '#acb3b9' }]}>⇢</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolColumn}>
          <TouchableOpacity
            onPress={() => setMode('erase')}
            style={[styles.toolButton, styles.eraseButton, mode === 'erase' && styles.toolActive]}
          >
            <Text style={styles.toolIcon}>⌫</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.canvas}>
        <Svg
          height={height - 120}
          width={width - 40}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {elements.flat().map((pathData, index) => {
            const fillColor = pathData.filled ? 'black' : 'none';

            return (
              <Path
                key={`black-${index}`}
                d={pathData.d}
                stroke="black"
                strokeWidth={2}
                fill={fillColor}
              />
            );
          })}

          {greyElements.flat().map((pathData, index) => {
            const fillColor = pathData.filled ? '#acb3b9' : 'none';

            return (
              <Path
                key={`grey-${index}`}
                d={pathData.d}
                stroke="#acb3b9"
                strokeWidth={2}
                fill={fillColor}
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 20,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolColumn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginBottom: 4,
  },
  toolActive: {
    backgroundColor: '#ffcc80',
  },
  toolText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toolIcon: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  eraseButton: {
    backgroundColor: '#f8d7da',
  },
  canvas: {
    backgroundColor: 'white',
    borderRadius: 5,
    flex: 1,
    marginBottom: 10,
  },
});
