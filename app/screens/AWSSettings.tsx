import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AWSS3Service from '../../utils/awsS3Service';

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucketName: string;
  useBackend: boolean;
  backendUrl: string;
}

export default function AWSSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets(); // iOS/Android safe area insets
  const [credentials, setCredentials] = useState<AWSCredentials>({
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    bucketName: '',
    useBackend: false, // Direct credentials is now default
    backendUrl: 'http://192.168.100.32:3000',
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const stored = await AsyncStorage.getItem('user_aws_credentials');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCredentials(parsed);
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  };

  const saveCredentials = async () => {
    try {
      // Validate inputs
      if (credentials.useBackend) {
        if (!credentials.backendUrl.trim()) {
          Alert.alert('Error', 'Please enter your backend URL');
          return;
        }
      } else {
        if (!credentials.accessKeyId.trim() || !credentials.secretAccessKey.trim() || 
            !credentials.bucketName.trim()) {
          Alert.alert('Error', 'Please fill in all AWS credentials');
          return;
        }
      }

      setLoading(true);

      // Save to AsyncStorage
      await AsyncStorage.setItem('user_aws_credentials', JSON.stringify(credentials));

      // Update AWS service config
      await AWSS3Service.saveConfig({
        presignedUrl: '', // Will be generated dynamically
        region: credentials.region,
        bucketName: credentials.bucketName,
        backendUrl: credentials.backendUrl,
      });

      setLoading(false);
      Alert.alert(
        'Success',
        'AWS credentials saved successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to save credentials: ' + error);
    }
  };

  const testConnection = async () => {
    try {
      setTesting(true);

      if (credentials.useBackend) {
        // Test backend connection
        const response = await fetch(`${credentials.backendUrl}/health`);
        const data = await response.json();

        if (response.ok && data.status === 'OK') {
          Alert.alert(
            'Connection Successful',
            `✅ Backend is running\n\n` +
            `Bucket: ${data.config.bucket}\n` +
            `Region: ${data.config.region}\n` +
            `Has Credentials: ${data.config.hasCredentials ? 'Yes' : 'No'}`
          );
        } else {
          Alert.alert('Connection Failed', 'Backend is not responding properly');
        }
      } else {
        // Test AWS credentials by generating a test presigned URL
        try {
          await AWSS3Service.generatePresignedUrlWithCredentials(
            'test-video.mp4',
            credentials.accessKeyId,
            credentials.secretAccessKey,
            credentials.region,
            credentials.bucketName,
            'video/mp4'
          );
          
          Alert.alert(
            'Credentials Valid ✅',
            `Successfully connected to AWS!\n\n` +
            `Bucket: ${credentials.bucketName}\n` +
            `Region: ${credentials.region}\n\n` +
            `You're ready to upload videos!`
          );
        } catch (error) {
          Alert.alert(
            'Credentials Invalid ❌',
            `Could not connect to AWS S3:\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
            'Please check:\n' +
            '1. Access Key ID is correct\n' +
            '2. Secret Access Key is correct\n' +
            '3. Bucket name exists\n' +
            '4. Region matches bucket region\n' +
            '5. IAM user has S3 permissions'
          );
        }
      }
    } catch (error) {
      Alert.alert(
        'Connection Failed',
        `Could not connect to backend:\n${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'Make sure:\n' +
        '1. Backend server is running\n' +
        '2. URL is correct\n' +
        '3. Phone is on same WiFi network'
      );
    } finally {
      setTesting(false);
    }
  };

  // Styles with dynamic safe area
  const dynamicStyles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      paddingTop: Platform.select({
        ios: 16 + (insets.top || 0),
        android: 48,
        default: 48,
      }),
      backgroundColor: '#161B1B',
      borderBottomWidth: 2,
      borderBottomColor: '#259B9A',
    },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MaterialIcons name="cloud" size={24} color="#259B9A" />
          <Text style={styles.headerTitle}>AWS Settings</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={{
          paddingBottom: Platform.select({
            ios: 20 + (insets.bottom || 0),
            android: 20,
            default: 20,
          }),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Section */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={22} color="#259B9A" />
          <Text style={styles.infoText}>
            Just enter your AWS credentials below and start uploading! No backend server needed. 🚀
          </Text>
        </View>

        {/* Upload Method Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Method</Text>
          
          <View style={styles.toggleContainer}>
            <View style={styles.toggleOption}>
              <Text style={styles.toggleLabel}>Use Backend Server (Optional)</Text>
              <Text style={styles.toggleDescription}>
                {credentials.useBackend 
                  ? 'Using backend - More secure for enterprise' 
                  : 'Direct upload - Easy setup, works instantly ⚡'}
              </Text>
            </View>
            <Switch
              value={credentials.useBackend}
              onValueChange={(value) => 
                setCredentials({ ...credentials, useBackend: value })
              }
              trackColor={{ false: '#4CAF50', true: '#2196F3' }}
              thumbColor={credentials.useBackend ? '#fff' : '#fff'}
            />
          </View>
        </View>

        {credentials.useBackend ? (
          /* Backend URL Configuration */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backend Configuration</Text>
            
            <View style={styles.inputContainer}>
              <MaterialIcons name="cloud" size={20} color="#259B9A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Backend URL (e.g., http://192.168.1.100:3000)"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={credentials.backendUrl}
                onChangeText={(text) => 
                  setCredentials({ ...credentials, backendUrl: text })
                }
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.helpBox}>
              <Text style={styles.helpTitle}>💡 How to get Backend URL:</Text>
              <Text style={styles.helpText}>
                1. Run backend server on your computer{'\n'}
                2. Find your computer's IP address{'\n'}
                3. Use: http://YOUR_IP:3000{'\n'}
                4. Make sure phone is on same WiFi
              </Text>
            </View>
          </View>
        ) : (
          /* Direct AWS Credentials */
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AWS Credentials</Text>
            
            {/* Access Key ID */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="vpn-key" size={20} color="#259B9A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="AWS Access Key ID"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={credentials.accessKeyId}
                onChangeText={(text) => 
                  setCredentials({ ...credentials, accessKeyId: text })
                }
                autoCapitalize="characters"
              />
            </View>

            {/* Secret Access Key */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#259B9A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="AWS Secret Access Key"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={credentials.secretAccessKey}
                onChangeText={(text) => 
                  setCredentials({ ...credentials, secretAccessKey: text })
                }
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility" : "visibility-off"} 
                  size={20} 
                  color="#259B9A" 
                />
              </TouchableOpacity>
            </View>

            {/* Region */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="public" size={20} color="#259B9A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="AWS Region (e.g., us-east-1)"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={credentials.region}
                onChangeText={(text) => 
                  setCredentials({ ...credentials, region: text })
                }
                autoCapitalize="none"
              />
            </View>

            {/* Bucket Name */}
            <View style={styles.inputContainer}>
              <MaterialIcons name="folder" size={20} color="#259B9A" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="S3 Bucket Name"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={credentials.bucketName}
                onChangeText={(text) => 
                  setCredentials({ ...credentials, bucketName: text })
                }
                autoCapitalize="none"
              />
            </View>

            <View style={styles.warningBox}>
              <MaterialIcons name="info" size={20} color="#2196F3" />
              <Text style={styles.warningText}>
                💡 Your credentials are stored securely on your device only. 
                They are never shared with anyone.
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testConnection}
            disabled={testing}
          >
            {testing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.buttonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={saveCredentials}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.buttonText}>Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Help Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>📚 How to get AWS Credentials:</Text>
          <Text style={styles.helpText}>
            1. Go to AWS Console → IAM{'\n'}
            2. Create new user with S3 permissions{'\n'}
            3. Generate Access Key{'\n'}
            4. Copy Access Key ID and Secret Key{'\n'}
            5. Enter them here{'\n\n'}
            
            For detailed guide, visit:{'\n'}
            https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
          </Text>
        </View>
      </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161B1B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#161B1B',
    borderBottomWidth: 2,
    borderBottomColor: '#259B9A',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(37, 155, 154, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 155, 154, 0.3)',
  },
  infoText: {
    color: '#259B9A',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toggleOption: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  eyeIcon: {
    padding: 8,
  },
  helpBox: {
    backgroundColor: 'rgba(37, 155, 154, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 155, 154, 0.2)',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#259B9A',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.2)',
  },
  warningText: {
    color: '#2196F3',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  buttonContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: 'rgba(37, 155, 154, 0.2)',
    borderWidth: 2,
    borderColor: '#259B9A',
  },
  saveButton: {
    backgroundColor: '#259B9A',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
});
