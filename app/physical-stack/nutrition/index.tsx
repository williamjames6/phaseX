import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function NutritionIndex() {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        showsHorizontalScrollIndicator={true}
        showsVerticalScrollIndicator={true}
        bouncesZoom={true}
      >
        <Image
          source={require('../../../assets/images/nutritionPlan.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: screenWidth,
    minHeight: screenHeight,
  },
  image: {
    width: screenWidth,
    height: screenHeight,
  },
});

