import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Dimensions, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../../../lib/supabase';

const { width, height } = Dimensions.get('window');

interface Sketch {
  id: string;
  paths: string[];
  user_id: string;
}

export default function NewSketchScreen() {
  const params = useLocalSearchParams();
  const [paths, setPaths] = useState<string[]>([]);
  const [startPoint, setStartPoint] = useState<{x:number;y:number} | null>(null);
  const [mode, setMode] = useState<'x'|'o'|'solid'|'dashed'|'x-circle'|'o-filled'|'solid-grey'|'dashed-grey'>('solid');
  const [strokeCounts, setStrokeCounts] = useState<number[]>([]);
  const actionId = params.actionId as string;
  const sessionId = params.sessionId as string;
  const appState = useRef(AppState.currentState);
  const hasUnsavedChanges = useRef(false);
  const pathsRef = useRef<string[]>([]);


  // Auto-save function - using refs to avoid infinite loops
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

      // Get current paths from ref to avoid dependency issues
      const currentPaths = pathsRef.current;
      if (currentPaths.length === 0) {
        return;
      }

      await supabase
        .from('TacticalSketches')
        .upsert([
          {
            user_id: user.id,
            paths: currentPaths,
            id: params.sketchId
          }
        ], { onConflict: "id" });

      hasUnsavedChanges.current = false;
      console.log('Sketch auto-saved successfully');
    } catch (error: unknown) {
      console.error('Error in auto-save:', error);
    }
  }, [actionId, sessionId, params.sketchId]); // Stable dependencies only

  // App state change listener
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground
        console.log('App has come to the foreground');
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to the background
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
            .select('paths')
            .eq('id', params.sketchId)
            .maybeSingle();

          if (sketchError) {
            console.log(sketchData);
            throw sketchError;
          }
          if (sketchData) {
            setPaths(sketchData.paths);
            pathsRef.current = sketchData.paths;
            console.log(sketchData.paths);
          }
        }
        catch (error: unknown) {
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
        // Auto-save when screen loses focus
        console.log('Screen losing focus, auto-saving...');
        handleAutoSave();
      };
    }, [handleAutoSave])
  );

  // Debug: Log the received parameters
  //console.log('Sketchpad received params:', { actionId, sessionId, allParams: params });


  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    if (mode === 'x') {
      // Two perpendicular 10px lines intersecting at tap point (plus sign)
      const half = 4*Math.sqrt(2);
      const horiz = `M ${locationX - half} ${locationY - half} L ${locationX + half} ${locationY + half}`;
      const vert = `M ${locationX - half} ${locationY + half} L ${locationX + half} ${locationY - half}`;
      setPaths(prev => {
        const newPaths = [...prev, horiz, vert];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, 2]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'x-circle') {
      // X with circle around it
      const half = 4*Math.sqrt(2);
      const r = 8;
      const horiz = `M ${locationX - half} ${locationY - half} L ${locationX + half} ${locationY + half}`;
      const vert = `M ${locationX - half} ${locationY + half} L ${locationX + half} ${locationY - half}`;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      setPaths(prev => {
        const newPaths = [...prev, horiz, vert, circle];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, 3]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'o') {
      // Circle of radius 8px centered at tap point (approximate with arc path)
      const r = 8;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      setPaths(prev => {
        const newPaths = [...prev, circle];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, 1]);
      hasUnsavedChanges.current = true;
      return;
    }
    if (mode === 'o-filled') {
      // Filled circle of radius 8px centered at tap point
      const r = 8;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      setPaths(prev => {
        const newPaths = [...prev, circle];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, 1]);
      hasUnsavedChanges.current = true;
      return;
    }
    // Start point for straight arrows (solid, dashed, solid-grey, dashed-grey)
    setStartPoint({ x: locationX, y: locationY });
  };


  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!startPoint) return;

    const { locationX, locationY } = event.nativeEvent;
    const endPoint = { x: locationX, y: locationY };

    const addArrowHeadSegments = (start: {x:number;y:number}, end: {x:number;y:number}) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const arrowLen = 10;
      const angle = Math.PI / 6; // 30 degrees
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      // Rotate (-ux,-uy) by ±angle
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
      const toAdd = [line, ...heads];
      setPaths(prev => {
        const newPaths = [...prev, ...toAdd];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, toAdd.length]);
      setStartPoint(null);
      hasUnsavedChanges.current = true;
      return;
    }

    if (mode === 'dashed' || mode === 'dashed-grey') {
      // Convert the straight line into dashed segments
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
      const toAdd = [...outSegments, ...heads];
      setPaths(prev => {
        const newPaths = [...prev, ...toAdd];
        pathsRef.current = newPaths;
        return newPaths;
      });
      setStrokeCounts(prev => [...prev, toAdd.length]);
      setStartPoint(null);
      hasUnsavedChanges.current = true;
      return;
    }
  };

  const handleUndo = () => {
    if (strokeCounts.length === 0) return;
    const counts = [...strokeCounts];
    const last = counts.pop() as number;
    setStrokeCounts(counts);
    setPaths(prev => {
      const newPaths = prev.slice(0, Math.max(0, prev.length - last));
      pathsRef.current = newPaths;
      return newPaths;
    });
    setStartPoint(null);
    hasUnsavedChanges.current = true;
  };


  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {/* X Column */}
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('x')} style={[styles.toolButton, mode==='x' && styles.toolActive]}>
            <Text style={styles.toolIcon}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('x-circle')} style={[styles.toolButton, mode==='x-circle' && styles.toolActive]}>
            <Text style={styles.toolIcon}>⨂</Text>
          </TouchableOpacity>
        </View>
        
        {/* Circle Column */}
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('o')} style={[styles.toolButton, mode==='o' && styles.toolActive]}>
            <Text style={styles.toolIcon}>○</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('o-filled')} style={[styles.toolButton, mode==='o-filled' && styles.toolActive]}>
            <Text style={styles.toolIcon}>●</Text>
          </TouchableOpacity>
        </View>
        
        {/* Solid Arrow Column */}
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('solid')} style={[styles.toolButton, mode==='solid' && styles.toolActive]}>
            <Text style={styles.toolIcon}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('solid-grey')} style={[styles.toolButton, mode==='solid-grey' && styles.toolActive]}>
            <Text style={[styles.toolIcon, {color: '#acb3b9'}]}>→</Text>
          </TouchableOpacity>
        </View>
        
        {/* Dashed Arrow Column */}
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={() => setMode('dashed')} style={[styles.toolButton, mode==='dashed' && styles.toolActive]}>
            <Text style={styles.toolIcon}>⇢</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('dashed-grey')} style={[styles.toolButton, mode==='dashed-grey' && styles.toolActive]}>
            <Text style={[styles.toolIcon, {color: '#acb3b9'}]}>⇢</Text>
          </TouchableOpacity>
        </View>
        
        {/* Undo Column */}
        <View style={styles.toolColumn}>
          <TouchableOpacity onPress={handleUndo} style={[styles.toolButton, styles.undoButton]}>
            <Text style={styles.toolIcon}>↶</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.canvas}>
        <Svg
          height={height - 120} // Extend to bottom with padding
          width={width - 40} // Account for container padding
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {paths.map((path, index) => {
            // Determine color and fill based on the path index and mode
            // This is a simplified approach - in a real app you'd want to store color info with each path
            const isGrey = mode === 'solid-grey' || mode === 'dashed-grey';
            const isFilled = mode === 'o-filled';
            const strokeColor = isGrey ? '#acb3b9' : 'black';
            const fillColor = isFilled ? 'black' : 'none';
            
            return (
              <Path
                key={index}
                d={path}
                stroke={strokeColor}
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
    backgroundColor: '#fff3e0',
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
  undoButton: {
    backgroundColor: '#f8d7da',
  },
  canvas: {
    backgroundColor: 'white',
    borderRadius: 5,
    flex: 1,
    marginBottom: 10,
  },
}); 