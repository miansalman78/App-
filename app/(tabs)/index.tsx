import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as React from 'react';
import {
    Alert,
    ImageBackground,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../constants/Colors';
import {
    getDeviceType,
    getResponsiveLayout
} from '../../utils/enhancedResponsive';
import {
    getResponsiveButtonHeight,
    getResponsiveTabBarHeight,
    getTopSafeArea,
    isLargeScreen,
    isSmallScreen,
    responsiveBorderRadius,
    responsiveFontSize,
    responsivePadding,
    responsiveSpacing,
    SCREEN_WIDTH
} from '../../utils/scaling';

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const device = getDeviceType();
  const layout = getResponsiveLayout();
  const contentPaddingBottom = getResponsiveTabBarHeight() + insets.bottom + responsiveSpacing(20);
  
  const dynamicStyles = StyleSheet.create({
    recordingModes: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: responsiveSpacing(device.isTablet ? 40 : 30),
      gap: responsiveSpacing(device.isTablet ? 20 : 15),
    },
    modeButton: {
      flex: 1,
      backgroundColor: '#259B9A',
      borderRadius: responsiveBorderRadius(device.isTablet ? 14 : 12),
      padding: responsivePadding(device.isTablet ? 24 : (Platform.OS === 'ios' ? 18 : 20)),
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: device.isTablet 
        ? (device.isIPad ? 110 : 105) 
        : (Platform.OS === 'ios' 
          ? (isSmallScreen ? 85 : isLargeScreen ? 95 : 88)
          : (isSmallScreen ? 80 : isLargeScreen ? 100 : 90)),
      // Platform-specific shadows
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: Platform.OS === 'ios' ? 2 : 4,
      },
      shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.3,
      shadowRadius: Platform.OS === 'ios' ? 4 : 8,
      elevation: Platform.OS === 'android' ? 6 : 0,
    },
  });
  
  return (
    <View style={styles.container}>
      {/* Header with line */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Home</Text>
        </View>
        <View style={styles.headerLine} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        alwaysBounceVertical={false}
      >
        {/* Teleprompter Card with Background Image */}
        <ImageBackground
          source={require('../../assets/images/saa.jpg')}
          style={styles.teleprompterCard}
          imageStyle={styles.cardBackgroundImage}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Teleprompter</Text>
            <Text style={styles.cardDescription}>
              Create professional video pitches with{"\n"}
              built-in teleprompter and editing tools,{"\n"}
              right on your phone
            </Text>
          </View>
        </ImageBackground>

        {/* Recording Mode Section */}
        <Text style={styles.sectionTitle}>Select Recording Mode</Text>

        <View style={dynamicStyles.recordingModes}>
          <TouchableOpacity
            style={dynamicStyles.modeButton}
            onPress={() => {
              router.push({
                pathname: '/screens/videoShoot',
                params: { mode: '1min' },
              });
            }}
          >
            <MaterialIcons name="edit" size={Platform.OS === 'ios' ? responsiveFontSize(22, 26, 20) : 24} color={AppColors.white} />
            <Text style={styles.modeButtonText}>1-Minute Pitch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.modeButton}
            onPress={() => {
              router.push({
                pathname: '/screens/videoShoot',
                params: { mode: '3min' },
              });
            }}
          >
            <MaterialIcons name="slideshow" size={Platform.OS === 'ios' ? responsiveFontSize(22, 26, 20) : 24} color={AppColors.white} />
            <Text style={styles.modeButtonText}>3-Minute{"\n"}Presentation</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.quickStartButton}
          onPress={() => {
            router.push({
              pathname: '/screens/videoShoot',
              params: { mode: '1min' },
            });
          }}
        >
          <Text style={styles.quickStartText}>Quick start recording</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={async () => {
            try {
              // Request permission to access media library
              const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
              
              if (permissionResult.granted === false) {
                Alert.alert('Permission Required', 'Permission to access camera roll is required!');
                return;
              }

              // Launch image picker for video
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
              });

              if (!result.canceled && result.assets[0]) {
                const videoUri = result.assets[0].uri;
                // Navigate to PreviewVideoShoot with the selected video
                router.push({
                  pathname: '/screens/PreviewVideoShoot',
                  params: { 
                    videoUri: videoUri,
                    orientation: 'portrait'
                  },
                });
              }
            } catch (error) {
              console.error('Error picking video:', error);
              Alert.alert('Error', 'Failed to select video. Please try again.');
            }
          }}
        >
          <Text style={styles.uploadText}>Upload Video</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: getTopSafeArea() + (Platform.OS === 'ios' ? responsiveSpacing(16) : responsiveSpacing(20)),
    paddingBottom: Platform.OS === 'ios' ? responsiveSpacing(16) : responsiveSpacing(20),
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SCREEN_WIDTH * (isSmallScreen ? 0.9 : 0.85),
    paddingHorizontal: responsivePadding(20),
  },
  headerLine: {
    width: SCREEN_WIDTH * (isSmallScreen ? 0.85 : 0.8),
    height: 1,
    backgroundColor: '#259B9A',
    marginTop: responsiveSpacing(15),
  },
  headerTitle: {
    fontSize: responsiveFontSize(24, 28, 20),
    fontWeight: 'bold',
    color: AppColors.white,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: responsivePadding(20),
    paddingTop: responsiveSpacing(10),
  },
  content: {
    flex: 1,
    paddingHorizontal: responsivePadding(20),
    paddingTop: responsiveSpacing(10),
  },
  teleprompterCard: {
    borderRadius: responsiveBorderRadius(16),
    padding: responsivePadding(Platform.OS === 'ios' ? 18 : 20),
    marginBottom: Platform.OS === 'ios' ? responsiveSpacing(24) : responsiveSpacing(30),
    minHeight: Platform.OS === 'ios' 
      ? (isSmallScreen ? 185 : isLargeScreen ? 215 : 195)
      : (isSmallScreen ? 180 : isLargeScreen ? 220 : 200),
    justifyContent: 'center',
    overflow: 'hidden',
    // Platform-specific shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 2 : 4,
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.3,
    shadowRadius: Platform.OS === 'ios' ? 4 : 8,
    elevation: Platform.OS === 'android' ? 8 : 0,
  },
  cardBackgroundImage: {
    borderRadius: responsiveBorderRadius(16),
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: responsiveFontSize(24, 28, 20),
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: responsiveSpacing(12),
  },
  cardDescription: {
    fontSize: responsiveFontSize(14, 16, 12),
    color: AppColors.white,
    lineHeight: Platform.OS === 'ios' 
      ? (isSmallScreen ? 19 : isLargeScreen ? 22 : 21)
      : (isSmallScreen ? 18 : 20),
    opacity: 0.9,
    marginBottom: Platform.OS === 'ios' ? responsiveSpacing(35) : responsiveSpacing(39),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(18, 20, 16),
    fontWeight: Platform.OS === 'ios' ? '600' : '600',
    color: AppColors.white,
    marginBottom: Platform.OS === 'ios' ? responsiveSpacing(18) : responsiveSpacing(20),
  },
  modeButtonText: {
    color: AppColors.white,
    fontSize: responsiveFontSize(14, 16, 12),
    fontWeight: '600',
    textAlign: 'center',
    marginTop: responsiveSpacing(8),
  },
  quickStartButton: {
    backgroundColor: '#259B9A',
    borderRadius: responsiveBorderRadius(12),
    padding: responsivePadding(Platform.OS === 'ios' ? 16 : 18),
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? responsiveSpacing(12) : responsiveSpacing(15),
    minHeight: Platform.OS === 'ios' 
      ? (getResponsiveButtonHeight() + 2)
      : getResponsiveButtonHeight(),
    // Platform-specific shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 2 : 4,
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.3,
    shadowRadius: Platform.OS === 'ios' ? 4 : 8,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  quickStartText: {
    color: AppColors.white,
    fontSize: responsiveFontSize(16, 18, 14),
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#259B9A',
    borderRadius: responsiveBorderRadius(12),
    padding: responsivePadding(Platform.OS === 'ios' ? 16 : 18),
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? responsiveSpacing(16) : responsiveSpacing(20),
    minHeight: Platform.OS === 'ios' 
      ? (getResponsiveButtonHeight() + 2)
      : getResponsiveButtonHeight(),
    // Platform-specific shadows
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: Platform.OS === 'ios' ? 2 : 4,
    },
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.3,
    shadowRadius: Platform.OS === 'ios' ? 4 : 8,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  uploadText: {
    color: AppColors.white,
    fontSize: responsiveFontSize(16, 18, 14),
    fontWeight: '600',
  },
});

export default HomeScreen;