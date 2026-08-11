import { analyzeClothing } from "../lib/api";

import { useState } from "react";

import {
  StyleSheet,
  Text,
  View,
  Image,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import * as FileSystem from "expo-file-system/legacy";

import { decode } from "base64-arraybuffer";

import { useRouter } from "expo-router";

import { supabase } from "../lib/supabase";

import SoftCard from "../components/SoftCard";

import PrimaryButton from "../components/PrimaryButton";

import Colors from "../constants/colors";

import Spacing from "../constants/spacing";

import Typography from "../constants/typography";


export default function Upload() {

  const router = useRouter();

  const [imageUri, setImageUri] =
    useState(null);

  const [imageUrl, setImageUrl] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);

  const [analysis, setAnalysis] =
    useState(null);

  const [saving, setSaving] =
    useState(false);


  // =======================================================
  // GALLERY
  // =======================================================

  const pickFromGallery =
    async () => {

      const permission =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {

        Alert.alert(
          "Permission needed",
          "Please allow photo library access to add clothing."
        );

        return;
      }

      const result =
        await ImagePicker
          .launchImageLibraryAsync({

            mediaTypes:
              ImagePicker.MediaTypeOptions.Images,

            quality: 0.8,

            allowsEditing: true,

            aspect: [3, 4],
          });


      if (!result.canceled) {

        setImageUri(
          result.assets[0].uri
        );

        setImageUrl(null);

        setAnalysis(null);
      }
    };


  // =======================================================
  // CAMERA
  // =======================================================

  const pickFromCamera =
    async () => {

      const permission =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permission.granted) {

        Alert.alert(
          "Permission needed",
          "Please allow camera access to add clothing."
        );

        return;
      }

      const result =
        await ImagePicker
          .launchCameraAsync({

            quality: 0.8,

            allowsEditing: true,

            aspect: [3, 4],
          });


      if (!result.canceled) {

        setImageUri(
          result.assets[0].uri
        );

        setImageUrl(null);

        setAnalysis(null);
      }
    };


  // =======================================================
  // UPLOAD + ANALYZE
  // =======================================================

  const handleContinue =
    async () => {

      if (!imageUri) {

        Alert.alert(
          "No photo selected",
          "Please choose or take a photo first."
        );

        return;
      }

      setUploading(true);


      try {

        // -------------------------------------------------
        // USER
        // -------------------------------------------------

        const {
          data: {
            user
          },
        } = await supabase.auth.getUser();


        if (!user) {

          setUploading(false);

          Alert.alert(
            "Not signed in",
            "Please log in again."
          );

          router.push(
            "/signup"
          );

          return;
        }


        // -------------------------------------------------
        // IMAGE → BASE64
        // -------------------------------------------------

        const base64 =
          await FileSystem
            .readAsStringAsync(
              imageUri,
              {
                encoding:
                  FileSystem
                    .EncodingType
                    .Base64,
              }
            );


        // -------------------------------------------------
        // SUPABASE STORAGE
        // -------------------------------------------------

        const fileName =
          `${user.id}/${Date.now()}.jpg`;


        const {
          error: uploadError
        } =
          await supabase.storage
            .from(
              "clothing-images"
            )
            .upload(
              fileName,
              decode(base64),
              {
                contentType:
                  "image/jpeg",
              }
            );


        if (uploadError) {

          setUploading(false);

          Alert.alert(
            "Upload failed",
            uploadError.message
          );

          return;
        }


        // -------------------------------------------------
        // PUBLIC URL
        // -------------------------------------------------

        const {
          data: urlData
        } =
          supabase.storage
            .from(
              "clothing-images"
            )
            .getPublicUrl(
              fileName
            );


        const publicImageUrl =
          urlData.publicUrl;


        console.log(
          "IMAGE URL:",
          publicImageUrl
        );


        setImageUrl(
          publicImageUrl
        );


        // -------------------------------------------------
        // GEMINI ANALYSIS
        // -------------------------------------------------

        console.log(
          "SENDING ORIGINAL IMAGE FOR ANALYSIS..."
        );


        const result =
          await analyzeClothing(
            publicImageUrl
          );


        console.log(
          "AI RESULT:",
          result
        );


        setUploading(false);


        // -------------------------------------------------
        // WARNINGS
        // -------------------------------------------------

        if (
          result?.warnings &&
          Array.isArray(
            result.warnings
          ) &&
          result.warnings.length > 0
        ) {

          Alert.alert(
            "We need a clearer photo",
            result.warnings.join(
              "\n\n"
            ),
            [
              {
                text:
                  "Choose another photo",

                onPress: () => {

                  setImageUri(null);

                  setImageUrl(null);

                  setAnalysis(null);
                },
              },

              {
                text:
                  "Try again",
              },
            ]
          );

          return;
        }


        // -------------------------------------------------
        // REVIEW
        // -------------------------------------------------

        setAnalysis(
          result
        );

      } catch (err) {

        setUploading(false);

        console.error(
          "Upload/analysis error:",
          err
        );

        Alert.alert(
          "Something went wrong",
          err?.message ||
            "We couldn't process this image. Please try again."
        );
      }
    };


  // =======================================================
  // ATTRIBUTE EDITING
  // =======================================================

  const updateAttribute =
    (
      field,
      value
    ) => {

      setAnalysis(
        (current) => ({
          ...current,

          structured_attributes: {
            ...current.structured_attributes,

            [field]:
              value,
          },
        })
      );
    };


  // =======================================================
  // SAVE
  // =======================================================

  const handleConfirm =
    async () => {

      if (
        !analysis ||
        !imageUrl
      ) {

        Alert.alert(
          "Nothing to save",
          "Please analyze a clothing item first."
        );

        return;
      }


      setSaving(true);


      try {

        const {
          data: {
            user
          },
          error: userError,
        } =
          await supabase.auth.getUser();


        if (
          userError ||
          !user
        ) {

          setSaving(false);

          Alert.alert(
            "Not signed in",
            "Please log in again."
          );

          router.push(
            "/signup"
          );

          return;
        }


        const attributes =
          analysis
            .structured_attributes
          || {};


        const clothingItem = {

          user_id:
            user.id,

          // ALWAYS save the original uploaded image.
          image_url:
            imageUrl,

          // No normalized image is created
          // during upload.
          normalized_image_url:
            null,

          category:
            attributes.category
            || null,

          subcategory:
            attributes.subcategory
            || null,

          primary_color:
            attributes.primary_color
            || null,

          secondary_color:
            attributes.secondary_color
            || null,

          pattern:
            attributes.pattern
            || null,

          material:
            attributes.material
            || null,

          fit:
            attributes.fit
            || null,

          neckline:
            attributes.neckline
            || null,

          sleeve_length:
            attributes.sleeve_length
            || null,

          length:
            attributes.length
            || null,

          season:
            Array.isArray(
              attributes.season
            )
              ? attributes.season
              : [],

          occasion:
            Array.isArray(
              attributes.occasion
            )
              ? attributes.occasion
              : [],

          description:
            analysis.description
            || null,

          confidence:
            typeof analysis.confidence
              === "number"
              ? analysis.confidence
              : null,
        };


        console.log(
          "SAVING CLOTHING ITEM:",
          clothingItem
        );


        const {
          data,
          error
        } =
          await supabase
            .from(
              "clothing_items"
            )
            .insert(
              clothingItem
            )
            .select()
            .single();


        if (error) {

          console.error(
            "SUPABASE SAVE ERROR:",
            error
          );

          throw error;
        }


        console.log(
          "SAVED CLOTHING ITEM:",
          data
        );


        setSaving(false);


        Alert.alert(
          "Saved!",
          "Your clothing item has been added to your wardrobe.",
          [
            {
              text:
                "OK",

              onPress: () => {

                setImageUri(
                  null
                );

                setImageUrl(
                  null
                );

                setAnalysis(
                  null
                );
              },
            },
          ]
        );

      } catch (err) {

        setSaving(false);

        console.error(
          "SAVE CLOTHING ERROR:",
          err
        );

        Alert.alert(
          "Couldn't save item",
          err?.message ||
            "We couldn't save this clothing item. Please try again."
        );
      }
    };


  // =======================================================
  // UI
  // =======================================================

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >

      <Text
        style={styles.title}
      >
        Add a clothing item
      </Text>


      <SoftCard
        style={styles.card}
      >

        {imageUri ? (

          <Image
            source={{
              uri: imageUri
            }}
            style={styles.preview}
            resizeMode="cover"
          />

        ) : (

          <View
            style={styles.placeholder}
          >

            <Text
              style={
                styles.placeholderText
              }
            >
              No photo yet
            </Text>

          </View>
        )}

      </SoftCard>


      <Text
        style={styles.orientationHint}
      >
        For the best analysis, upload your clothing
        photo upright when possible. You can rotate
        your photo before uploading.
      </Text>


      <PrimaryButton
        title="Take a Photo"
        onPress={
          pickFromCamera
        }
        disabled={
          uploading ||
          saving
        }
      />


      <View
        style={{
          height:
            Spacing.sm
        }}
      />


      <PrimaryButton
        title="Choose from Gallery"
        onPress={
          pickFromGallery
        }
        disabled={
          uploading ||
          saving
        }
      />


      <View
        style={{
          height:
            Spacing.md
        }}
      />


      {!analysis && (

        <PrimaryButton
          title={
            uploading
              ? "Analyzing..."
              : "Continue"
          }
          onPress={
            handleContinue
          }
          disabled={
            !imageUri ||
            uploading ||
            saving
          }
          loading={
            uploading
          }
        />

      )}


      {analysis && (

        <View
          style={
            styles.reviewSection
          }
        >

          <Text
            style={
              styles.reviewTitle
            }
          >
            Review your item
          </Text>

          <Text
            style={
              styles.reviewSubtitle
            }
          >
            Check the AI's suggestions and edit
            anything that isn't right.
          </Text>


          <SoftCard
            style={
              styles.detailsCard
            }
          >

            <Text
              style={
                styles.sectionLabel
              }
            >
              Category
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.category || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "category",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Subcategory
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.subcategory || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "subcategory",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Primary color
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.primary_color || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "primary_color",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Pattern
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.pattern || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "pattern",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Material
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.material || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "material",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Fit
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.fit || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "fit",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Neckline
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.neckline || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "neckline",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Sleeve length
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.sleeve_length || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "sleeve_length",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Length
            </Text>

            <TextInput
              style={
                styles.input
              }
              value={
                analysis
                  ?.structured_attributes
                  ?.length || ""
              }
              onChangeText={
                (value) =>
                  updateAttribute(
                    "length",
                    value
                  )
              }
            />


            <Text
              style={
                styles.sectionLabel
              }
            >
              Description
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.descriptionInput,
              ]}
              multiline
              value={
                analysis
                  ?.description || ""
              }
              onChangeText={
                (value) =>
                  setAnalysis(
                    (current) => ({
                      ...current,
                      description:
                        value,
                    })
                  )
              }
            />

          </SoftCard>


          <View
            style={{
              height:
                Spacing.md
            }}
          />


          <PrimaryButton
            title={
              saving
                ? "Saving..."
                : "Save to Wardrobe"
            }
            onPress={
              handleConfirm
            }
            disabled={
              saving ||
              uploading
            }
            loading={
              saving
            }
          />


          <View
            style={{
              height:
                Spacing.sm
            }}
          />


          <PrimaryButton
            title="Choose Another Photo"
            onPress={() => {

              setImageUri(null);

              setImageUrl(null);

              setAnalysis(null);
            }}
            disabled={
              saving
            }
          />

        </View>
      )}


      {!analysis && (

        <>

          <View
            style={{
              height:
                Spacing.sm
            }}
          />

          <PrimaryButton
            title="Cancel"
            onPress={() =>
              router.back()
            }
            disabled={
              uploading ||
              saving
            }
          />

        </>
      )}

    </ScrollView>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flexGrow: 1,
      backgroundColor:
        Colors.background,
      padding:
        Spacing.lg,
      paddingTop:
        Spacing.xxl,
    },

    title: {
      ...Typography.heading,
      color:
        Colors.text,
      marginBottom:
        Spacing.xl,
      textAlign:
        "center",
    },

    card: {
      marginBottom:
        Spacing.md,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    preview: {
      width: "100%",
      aspectRatio:
        3 / 4,
      borderRadius:
        Spacing.radiusMedium,
    },

    placeholder: {
      width: "100%",
      aspectRatio:
        3 / 4,
      borderRadius:
        Spacing.radiusMedium,
      backgroundColor:
        Colors.accent,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    placeholderText: {
      ...Typography.body,
      color:
        Colors.textLight,
    },

    orientationHint: {
      ...Typography.body,
      color:
        Colors.textLight,
      fontSize: 12,
      lineHeight: 18,
      textAlign:
        "center",
      marginBottom:
        Spacing.lg,
      paddingHorizontal:
        Spacing.md,
    },

    reviewSection: {
      marginTop:
        Spacing.md,
    },

    reviewTitle: {
      ...Typography.heading,
      color:
        Colors.text,
      marginBottom:
        Spacing.sm,
    },

    reviewSubtitle: {
      ...Typography.body,
      color:
        Colors.textLight,
      marginBottom:
        Spacing.lg,
    },

    detailsCard: {
      padding:
        Spacing.lg,
    },

    sectionLabel: {
      ...Typography.body,
      color:
        Colors.text,
      fontWeight:
        "600",
      marginBottom:
        Spacing.xs,
      marginTop:
        Spacing.sm,
    },

    input: {
      borderWidth: 1,
      borderColor:
        "#D8D8D8",
      borderRadius:
        Spacing.radiusMedium,
      paddingHorizontal:
        Spacing.md,
      paddingVertical:
        Spacing.sm,
      backgroundColor:
        "#FFFFFF",
      color:
        Colors.text,
      fontSize: 16,
    },

    descriptionInput: {
      minHeight: 90,
      textAlignVertical:
        "top",
    },
  });