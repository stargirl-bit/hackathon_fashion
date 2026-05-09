import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status === 'granted') {
        // Greet the user when the app opens
        Speech.speak('Welcome to the Clothing Describer. Tap anywhere on the screen to scan your outfit.', {
          language: 'en-US',
          rate: 1.0,
        });
      } else {
        Speech.speak('Camera permission is required to use this app.', {
          language: 'en-US',
        });
      }
    })();
  }, []);

  const handleScan = async () => {
    if (isProcessing || !cameraRef.current) return;

    try {
      setIsProcessing(true);
      
      // Haptic and audio feedback for starting
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Speech.speak('Scanning your outfit...', { language: 'en-US' });

      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });

      // Call Gemini API
      const description = await analyzeImageWithGemini(photo.base64);

      // Feedback for success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Speech.speak(description, { language: 'en-US' });

    } catch (error) {
      console.error(error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Speech.speak('Sorry, there was an error analyzing the image. Please try again.', { language: 'en-US' });
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeImageWithGemini = async (base64Image) => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('API Key is missing');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: "You are a fashion assistant helping a blind person. When shown a clothing item, describe: the garment type, its color in simple everyday language (e.g., 'navy' or 'sky blue', not just 'blue'), and one or two colors that would match well. Keep your response under 4 sentences. Be warm, concise, and practical. Never say 'I see' or 'it appears' — speak directly to the user.",
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 150,
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      throw new Error('API request failed');
    }

    // Safely extract the response text from the Gemini payload
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Unexpected API response format');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="back"
        ref={cameraRef}
      >
        <TouchableOpacity
          style={styles.fullScreenButton}
          onPress={handleScan}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Scan outfit"
          accessibilityHint="Double tap to take a photo and describe the clothing in front of you"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>Analyzing...</Text>
            </View>
          ) : (
            <View style={styles.overlayTextContainer}>
              <Text style={styles.tapText}>Tap anywhere to scan</Text>
            </View>
          )}
        </TouchableOpacity>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  fullScreenButton: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', // Slight dim to make text more readable
  },
  overlayTextContainer: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 15,
  },
  tapText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  processingContainer: {
    padding: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 20,
    marginTop: 15,
    fontWeight: '600',
  },
  text: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },
});
