import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, GestureResponderEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  const [currentPath, setCurrentPath] = useState('');
  const [currentPoints, setCurrentPoints] = useState<{x:number;y:number}[]>([]);
  const [mode, setMode] = useState<'x'|'o'|'solid'|'dashed'>('solid');
  const [strokeCounts, setStrokeCounts] = useState<number[]>([]);
  const actionId = params.actionId as string;
  const sessionId = params.sessionId as string;


  useFocusEffect(
    useCallback( () =>
      {
        console.log(new Date());
        console.log(params.sketchId);
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
            }
          }
          catch (error: unknown) {
            console.error('Error in handleSave:', error);
            if (error instanceof Error) {
              alert('Error saving sketch: ' + error.message);
            } else {
              alert('An unknown error occurred while saving the sketch');
            }
          }
        };

        handleRender();

        return () => {
          // Do something when the screen is unfocused
          // Useful for cleanup functions
        };
      }, [])
  );

  // Debug: Log the received parameters
  //console.log('Sketchpad received params:', { actionId, sessionId, allParams: params });


  const handleTouchStart = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    if (mode === 'x') {
      // Two perpendicular 10px lines intersecting at tap point (plus sign)
      const half = 5;
      const horiz = `M ${locationX - half} ${locationY} L ${locationX + half} ${locationY}`;
      const vert = `M ${locationX} ${locationY - half} L ${locationX} ${locationY + half}`;
      setPaths(prev => [...prev, horiz, vert]);
      setStrokeCounts(prev => [...prev, 2]);
      return;
    }
    if (mode === 'o') {
      // Circle of radius 5px centered at tap point (approximate with arc path)
      const r = 5;
      const circle = `M ${locationX + r} ${locationY} A ${r} ${r} 0 1 0 ${locationX - r} ${locationY} A ${r} ${r} 0 1 0 ${locationX + r} ${locationY}`;
      setPaths(prev => [...prev, circle]);
      setStrokeCounts(prev => [...prev, 1]);
      return;
    }
    // Start free draw for arrows
    setCurrentPoints([{ x: locationX, y: locationY }]);
    setCurrentPath(`M ${locationX} ${locationY}`);
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (mode === 'x' || mode === 'o') return; // tap-only modes
    const { locationX, locationY } = event.nativeEvent;
    setCurrentPoints(prev => [...prev, { x: locationX, y: locationY }]);
    setCurrentPath(prev => `${prev} L ${locationX} ${locationY}`);
  };

  const handleTouchEnd = () => {
    if (!currentPath || currentPoints.length < 1) {
      setCurrentPath('');
      setCurrentPoints([]);
      return;
    }

    const addArrowHeadSegments = (points: {x:number;y:number}[]) => {
      if (points.length < 2) return [] as string[];
      const p2 = points[points.length - 1];
      const p1 = points[points.length - 2];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
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
      const a1x = p2.x + rx1 * arrowLen;
      const a1y = p2.y + ry1 * arrowLen;
      const a2x = p2.x + rx2 * arrowLen;
      const a2y = p2.y + ry2 * arrowLen;
      const head1 = `M ${p2.x} ${p2.y} L ${a1x} ${a1y}`;
      const head2 = `M ${p2.x} ${p2.y} L ${a2x} ${a2y}`;
      return [head1, head2];
    };

    if (mode === 'solid') {
      const heads = addArrowHeadSegments(currentPoints);
      const toAdd = [currentPath, ...heads];
      setPaths(prev => [...prev, ...toAdd]);
      setStrokeCounts(prev => [...prev, toAdd.length]);
      setCurrentPath('');
      setCurrentPoints([]);
      return;
    }

    if (mode === 'dashed') {
      // Convert the polyline into many short segments with gaps
      const dash = 6;
      const gap = 4;
      const outSegments: string[] = [];
      for (let i = 0; i < currentPoints.length - 1; i++) {
        const p0 = currentPoints[i];
        const p1 = currentPoints[i + 1];
        const segDx = p1.x - p0.x;
        const segDy = p1.y - p0.y;
        const segLen = Math.hypot(segDx, segDy);
        if (segLen === 0) continue;
        const ux = segDx / segLen;
        const uy = segDy / segLen;
        let dist = 0;
        let draw = true;
        while (dist < segLen) {
          const l = Math.min(draw ? dash : gap, segLen - dist);
          if (draw) {
            const sx = p0.x + ux * dist;
            const sy = p0.y + uy * dist;
            const ex = p0.x + ux * (dist + l);
            const ey = p0.y + uy * (dist + l);
            outSegments.push(`M ${sx} ${sy} L ${ex} ${ey}`);
          }
          dist += l;
          draw = !draw;
        }
      }
      const heads = addArrowHeadSegments(currentPoints);
      const toAdd = [...outSegments, ...heads];
      setPaths(prev => [...prev, ...toAdd]);
      setStrokeCounts(prev => [...prev, toAdd.length]);
      setCurrentPath('');
      setCurrentPoints([]);
      return;
    }
  };

  const handleUndo = () => {
    if (strokeCounts.length === 0) return;
    const counts = [...strokeCounts];
    const last = counts.pop() as number;
    setStrokeCounts(counts);
    setPaths(prev => prev.slice(0, Math.max(0, prev.length - last)));
    setCurrentPath('');
    setCurrentPoints([]);
  };

  const handleSave = async () => {
    if (!actionId || !sessionId) {
      alert('Missing action or session information');
      return;
    }

    if (paths.length === 0) {
      alert('Please draw something before saving');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be logged in to save sketches');
        return;
      }
      // 1. Create new row in TacticalSketches table
      const { data: sketchData, error: sketchError } = await supabase
        .from('TacticalSketches')
        .upsert([
          {
            user_id: user.id,
            paths: paths,
            id: params.sketchId
          }
          ],
          {onConflict: "id"}
        )
        .select()
        .single();

      if (sketchError) throw sketchError;
      console.log('Sketch created successfully:', sketchData.id);

      alert('Sketch saved successfully!');
      
      // Navigate back to the journal entry with the sketch ID
      router.back();
      // Note: The sketch ID will be stored in the action's pendingSketchId field
      // when the user returns to the journal entry
    } catch (error: unknown) {
      console.error('Error in handleSave:', error);
      if (error instanceof Error) {
        alert('Error saving sketch: ' + error.message);
      } else if (typeof(error)=="object" && error) {
        alert("Did you enter a time stamp or description? No? You dumb slut. Do that first before saving a sketch.");
      } else {
        alert('An unknown error occurred while saving the sketch');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => setMode('x')} style={[styles.toolButton, mode==='x' && styles.toolActive]}>
          <Text style={styles.toolText}>x</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('o')} style={[styles.toolButton, mode==='o' && styles.toolActive]}>
          <Text style={styles.toolText}>o</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('solid')} style={[styles.toolButton, mode==='solid' && styles.toolActive]}>
          <Text style={styles.toolText}>solid →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('dashed')} style={[styles.toolButton, mode==='dashed' && styles.toolActive]}>
          <Text style={styles.toolText}>dashed →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleUndo} style={[styles.toolButton, styles.undoButton]}>
          <Text style={styles.toolText}>Undo</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.canvas}>
        <Svg
          height={height * 0.6}
          width={width}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {paths.map((path, index) => (
            <Path
              key={index}
              d={path}
              stroke="black"
              strokeWidth={2}
              fill="none"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke="black"
              strokeWidth={2}
              fill="none"
            />
          ) : null}
        </Svg>
      </View>
      <TouchableOpacity 
        style={styles.saveButton} 
        onPress={handleSave}
      >
        <Text style={styles.saveButtonText}>Save Sketch</Text>
      </TouchableOpacity>
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
  toolButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  toolActive: {
    backgroundColor: '#ffcc80',
  },
  toolText: {
    fontSize: 16,
    fontWeight: '600',
  },
  undoButton: {
    backgroundColor: '#f8d7da',
  },
  canvas: {
    backgroundColor: 'white',
    borderRadius: 5,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: '#ff9800',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 