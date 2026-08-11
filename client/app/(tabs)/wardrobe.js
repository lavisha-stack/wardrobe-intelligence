import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../../lib/supabase";
import Colors from "../../constants/colors";
import Spacing from "../../constants/spacing";
import Typography from "../../constants/typography";

const { width } = Dimensions.get("window");

const CARD_GAP = Spacing.md;
const CARD_WIDTH =
  (width - Spacing.lg * 2 - CARD_GAP) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.35;

const FOCUS_WIDTH = width * 0.78;
const FOCUS_HEIGHT = FOCUS_WIDTH * 1.35;

const CATEGORIES = [
  "All",
  "Tops",
  "Bottoms",
  "Dresses",
  "Outerwear",
  "Shoes",
  "Accessories",
];

export default function WardrobeScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("All");

  const [selectedItem, setSelectedItem] =
    useState(null);

  useEffect(() => {
    fetchWardrobe();
  }, []);

  const fetchWardrobe = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You are not signed in."
        );
      }

      console.log(
        "CURRENT USER ID:",
        user.id
      );

      const { data, error } =
        await supabase
          .from("clothing_items")
          .select(`
            id,
            image_url,
            normalized_image_url,
            category,
            subcategory,
            primary_color,
            secondary_color,
            pattern,
            material,
            fit,
            season,
            occasion
          `)
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });

      console.log(
        "WARDROBE DATA:",
        data
      );

      console.log(
        "WARDROBE QUERY ERROR:",
        error
      );

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch (error) {
      console.error(
        "WARDROBE FETCH ERROR:",
        error
      );

      setErrorMessage(
        error?.message ||
          "We couldn't load your wardrobe. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const getFilterCategory = (item) => {
    const text = [
      item.category,
      item.subcategory,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      text.includes("dress") ||
      text.includes("gown") ||
      text.includes("jumpsuit") ||
      text.includes("romper")
    ) {
      return "Dresses";
    }

    if (
      text.includes("shoe") ||
      text.includes("sneaker") ||
      text.includes("sandal") ||
      text.includes("boot") ||
      text.includes("heel") ||
      text.includes("loafer") ||
      text.includes("flat") ||
      text.includes("slipper") ||
      text.includes("crocs")
    ) {
      return "Shoes";
    }

    if (
      text.includes("jacket") ||
      text.includes("coat") ||
      text.includes("blazer") ||
      text.includes("cardigan") ||
      text.includes("hoodie") ||
      text.includes("sweater") ||
      text.includes("sweatshirt") ||
      text.includes("outerwear") ||
      text.includes("shrug")
    ) {
      return "Outerwear";
    }

    if (
      text.includes("bag") ||
      text.includes("belt") ||
      text.includes("scarf") ||
      text.includes("hat") ||
      text.includes("cap") ||
      text.includes("jewelry") ||
      text.includes("jewellery") ||
      text.includes("necklace") ||
      text.includes("bracelet") ||
      text.includes("earring") ||
      text.includes("watch") ||
      text.includes("accessory") ||
      text.includes("accessories")
    ) {
      return "Accessories";
    }

    if (
      text.includes("jean") ||
      text.includes("pant") ||
      text.includes("trouser") ||
      text.includes("short") ||
      text.includes("skirt") ||
      text.includes("legging") ||
      text.includes("bottom")
    ) {
      return "Bottoms";
    }

    if (
      text.includes("shirt") ||
      text.includes("t-shirt") ||
      text.includes("tee") ||
      text.includes("top") ||
      text.includes("blouse") ||
      text.includes("tank") ||
      text.includes("camisole") ||
      text.includes("polo") ||
      text.includes("crop top") ||
      text.includes("kurti") ||
      text.includes("kurta")
    ) {
      return "Tops";
    }

    return "Tops";
  };

  const matchesSearch = (item) => {
    const search = searchText
      .trim()
      .toLowerCase();

    if (!search) {
      return true;
    }

    const searchableText = [
      item.category,
      item.subcategory,
      item.primary_color,
      item.secondary_color,
      item.pattern,
      item.material,
      item.fit,
      item.season,
      item.occasion,
    ]
      .flatMap((value) =>
        Array.isArray(value)
          ? value
          : [value]
      )
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(
      search
    );
  };

  const filteredItems =
    items.filter((item) => {
      const categoryMatches =
        selectedCategory === "All" ||
        getFilterCategory(item) ===
          selectedCategory;

      const searchMatches =
        matchesSearch(item);

      return (
        categoryMatches &&
        searchMatches
      );
    });

  if (loading) {
    return (
      <View
        style={styles.centerContainer}
      >
        <ActivityIndicator
          size="large"
          color={Colors.text}
        />

        <Text
          style={styles.statusText}
        >
          Loading your wardrobe...
        </Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View
        style={styles.centerContainer}
      >
        <Text
          style={styles.errorTitle}
        >
          Something went wrong
        </Text>

        <Text
          style={styles.statusText}
        >
          {errorMessage}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={fetchWardrobe}
        >
          <Text
            style={styles.retryText}
          >
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.mainList}
        data={filteredItems}
        keyExtractor={(item) =>
          item.id.toString()
        }
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={
          styles.grid
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        ListHeaderComponent={
          <>
            <Text style={styles.title}>
              My Wardrobe
            </Text>

            <Text
              style={styles.subtitle}
            >
              {items.length === 0
                ? "Your wardrobe is waiting for its first piece."
                : `${items.length} ${
                    items.length === 1
                      ? "item"
                      : "items"
                  } in your wardrobe`}
            </Text>

            {items.length > 0 && (
              <>
                <View
                  style={
                    styles.searchContainer
                  }
                >
                  <Text
                    style={styles.searchIcon}
                  >
                    🔍
                  </Text>

                  <TextInput
                    style={
                      styles.searchInput
                    }
                    value={searchText}
                    onChangeText={
                      setSearchText
                    }
                    placeholder="Search your wardrobe..."
                    placeholderTextColor={
                      Colors.textLight
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  {searchText.length >
                    0 && (
                    <Pressable
                      onPress={() =>
                        setSearchText("")
                      }
                      style={
                        styles.clearButton
                      }
                    >
                      <Text
                        style={
                          styles.clearText
                        }
                      >
                        ×
                      </Text>
                    </Pressable>
                  )}
                </View>

                <View
                  style={
                    styles.categoryContainer
                  }
                >
                  <FlatList
                    data={CATEGORIES}
                    horizontal
                    scrollEnabled
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={
                      false
                    }
                    keyboardShouldPersistTaps="handled"
                    keyExtractor={(
                      category
                    ) => category}
                    contentContainerStyle={
                      styles.categoryList
                    }
                    renderItem={({
                      item: category,
                    }) => {
                      const active =
                        selectedCategory ===
                        category;

                      return (
                        <Pressable
                          style={[
                            styles.categoryChip,
                            active &&
                              styles.categoryChipActive,
                          ]}
                          hitSlop={6}
                          onPress={() =>
                            setSelectedCategory(
                              category
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.categoryText,
                              active &&
                                styles.categoryTextActive,
                            ]}
                          >
                            {category}
                          </Text>
                        </Pressable>
                      );
                    }}
                  />
                </View>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          items.length === 0 ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={styles.emptyTitle}
              >
                Your wardrobe is empty
              </Text>

              <Text
                style={styles.emptyText}
              >
                Add your first clothing item to see it here.
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={styles.emptyTitle}
              >
                No items found
              </Text>

              <Text
                style={styles.emptyText}
              >
                Try a different search or category.
              </Text>

              <Pressable
                style={
                  styles.resetButton
                }
                onPress={() => {
                  setSearchText("");
                  setSelectedCategory(
                    "All"
                  );
                }}
              >
                <Text
                  style={
                    styles.resetButtonText
                  }
                >
                  Clear filters
                </Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <WardrobeCard
            item={item}
            onPress={() =>
              setSelectedItem(item)
            }
          />
        )}
      />

      {selectedItem && (
        <FocusedCard
          item={selectedItem}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      )}
    </View>
  );
}

function WardrobeCard({
  item,
  onPress,
}) {
  return (
    <View
      style={styles.cardWrapper}
    >
      <Pressable
        style={styles.card}
        onPress={onPress}
      >
        <View
          style={styles.normalCardFace}
        >
          <Animated.Image
            source={{
              uri:
                item.normalized_image_url ||
                item.image_url,
            }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
      </Pressable>
    </View>
  );
}

function FocusedCard({
  item,
  onClose,
}) {
  const scale = useRef(
    new Animated.Value(0.75)
  ).current;

  const opacity = useRef(
    new Animated.Value(0)
  ).current;

  const backdropOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const rotation = useRef(
    new Animated.Value(0)
  ).current;

  const [flipped, setFlipped] =
    useState(false);

  const [animating, setAnimating] =
    useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),

      Animated.timing(
        backdropOpacity,
        {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }
      ),
    ]).start();
  }, []);

  const flipToBack = () => {
    if (animating) return;

    setAnimating(true);

    Animated.timing(rotation, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start(() => {
      setFlipped(true);
      setAnimating(false);
    });
  };

  const flipToFront = () => {
    if (animating) return;

    setAnimating(true);

    Animated.timing(rotation, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start(() => {
      setFlipped(false);
      setAnimating(false);
    });
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0.75,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),

      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),

      Animated.timing(
        backdropOpacity,
        {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }
      ),
    ]).start(() => {
      onClose();
    });
  };

  const closeOverlay = () => {
    if (animating) return;

    if (flipped) {
      setAnimating(true);

      Animated.timing(rotation, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        setFlipped(false);
        setAnimating(false);
        animateOut();
      });
    } else {
      animateOut();
    }
  };

  const frontRotation =
    rotation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        "0deg",
        "90deg",
        "180deg",
      ],
    });

  const backRotation =
    rotation.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [
        "180deg",
        "270deg",
        "360deg",
      ],
    });

  const formatList = (value) => {
    if (!value) {
      return "—";
    }

    if (Array.isArray(value)) {
      return value.length > 0
        ? value.join(", ")
        : "—";
    }

    return String(value);
  };

  const colorText = [
    item.primary_color,
    item.secondary_color,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <View style={styles.overlay}>
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity:
              backdropOpacity,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeOverlay}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.focusedCardWrapper,
          {
            opacity,
            transform: [
              {
                perspective: 1200,
              },
              {
                scale,
              },
            ],
          },
        ]}
      >
        <View
          style={styles.focusedCard}
        >
          <Animated.View
            pointerEvents={
              flipped ? "none" : "auto"
            }
            style={[
              styles.focusedFace,
              styles.focusedFront,
              {
                transform: [
                  {
                    perspective: 1200,
                  },
                  {
                    rotateY:
                      frontRotation,
                  },
                ],
              },
            ]}
          >
            <Pressable
              style={
                styles.fullFacePressable
              }
              onPress={
                flipToBack
              }
              disabled={animating}
            >
              <Animated.Image
                source={{
                  uri:
                    item.normalized_image_url ||
                    item.image_url,
                }}
                style={
                  styles.focusedImage
                }
                resizeMode="cover"
              />

              <View
                style={
                  styles.flipHintContainer
                }
              >
                <Text
                  style={styles.flipHint}
                >
                  Tap to see details
                </Text>
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View
            pointerEvents={
              flipped ? "auto" : "none"
            }
            style={[
              styles.focusedFace,
              styles.focusedBack,
              {
                transform: [
                  {
                    perspective: 1200,
                  },
                  {
                    rotateY:
                      backRotation,
                  },
                ],
              },
            ]}
          >
            <View
              style={
                styles.detailsContainer
              }
            >
              <View
                style={
                  styles.backHeader
                }
              >
                <View
                  style={
                    styles.backHeaderText
                  }
                >
                  <Text
                    style={
                      styles.backTitle
                    }
                  >
                    {item.category ||
                      "Clothing Item"}
                  </Text>

                  {item.subcategory ? (
                    <Text
                      style={
                        styles.subcategory
                      }
                    >
                      {item.subcategory}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  style={
                    styles.backButton
                  }
                  onPress={
                    flipToFront
                  }
                  disabled={
                    animating
                  }
                >
                  <Text
                    style={
                      styles.backButtonText
                    }
                  >
                    ↩
                  </Text>
                </Pressable>
              </View>

              <View
                style={
                  styles.detailsList
                }
              >
                <DetailRow
                  label="Color"
                  value={colorText}
                />

                <DetailRow
                  label="Pattern"
                  value={
                    item.pattern
                  }
                />

                <DetailRow
                  label="Material"
                  value={
                    item.material
                  }
                />

                <DetailRow
                  label="Fit"
                  value={item.fit}
                />

                <DetailRow
                  label="Season"
                  value={formatList(
                    item.season
                  )}
                />

                <DetailRow
                  label="Occasion"
                  value={formatList(
                    item.occasion
                  )}
                />
              </View>

              <Text
                style={
                  styles.flipBackHint
                }
              >
                Tap ↩ to see the image
              </Text>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.Text
        style={[
          styles.closeHint,
          {
            opacity,
          },
        ]}
      >
        Tap outside to close
      </Animated.Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <View
      style={styles.detailRow}
    >
      <Text
        style={styles.detailLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.detailValue}
        numberOfLines={2}
      >
        {value || "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:
      Colors.background,
    paddingHorizontal:
      Spacing.lg,
    paddingTop:
      Spacing.xxl,
  },

  title: {
    ...Typography.heading,
    color: Colors.text,
    marginBottom:
      Spacing.xs,
  },

  subtitle: {
    ...Typography.body,
    color: Colors.textLight,
    marginBottom:
      Spacing.md,
  },

  mainList: {
    flex: 1,
  },

  searchContainer: {
    height: 48,
    borderRadius: 24,
    backgroundColor:
      "#FFFFFF",
    borderWidth: 1,
    borderColor:
      Colors.border,
    flexDirection:
      "row",
    alignItems:
      "center",
    paddingHorizontal: 15,
    marginBottom: 6,
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },

  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  clearText: {
    fontSize: 22,
    color: Colors.textLight,
    lineHeight: 22,
  },

  categoryContainer: {
    height: 38,
    marginBottom: 8,
    overflow: "visible",
  },

  categoryList: {
    alignItems:
      "center",
    paddingRight: 8,
    gap: 6,
  },

  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 30,
    borderRadius: 15,
    backgroundColor:
      "#FFFFFF",
    borderWidth: 1,
    borderColor:
      Colors.border,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  categoryChipActive: {
    backgroundColor:
      Colors.text,
    borderColor:
      Colors.text,
  },

  categoryText: {
    fontSize: 11,
    lineHeight: 14,
    color: Colors.text,
  },

  categoryTextActive: {
    color: "#FFFFFF",
    fontWeight:
      "600",
  },

  grid: {
    paddingTop: 0,
    paddingBottom:
      Spacing.xxl,
  },

  row: {
    justifyContent:
      "space-between",
    marginBottom:
      CARD_GAP,
  },

  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },

  card: {
    width: "100%",
    height: "100%",
  },

  normalCardFace: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor:
      "#FFFFFF",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  overlay: {
    position:
      "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems:
      "center",
    justifyContent:
      "center",
    zIndex: 100,
  },

  backdrop: {
    position:
      "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      "rgba(0, 0, 0, 0.42)",
  },

  focusedCardWrapper: {
    width: FOCUS_WIDTH,
    height: FOCUS_HEIGHT,
    zIndex: 101,
  },

  focusedCard: {
    width: "100%",
    height: "100%",
  },

  focusedFace: {
    position:
      "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 22,
    overflow: "hidden",
    backfaceVisibility:
      "hidden",

    shadowOffset: {
      width: 0,
      height: 10,
    },

    shadowOpacity: 0.25,
    shadowRadius: 20,

    elevation: 15,
  },

  focusedFront: {
    backgroundColor:
      "#FFFFFF",
  },

  focusedBack: {
    backgroundColor:
      "#FFFFFF",
  },

  fullFacePressable: {
    flex: 1,
  },

  focusedImage: {
    width: "100%",
    height: "100%",
  },

  flipHintContainer: {
    position:
      "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    alignItems:
      "center",
  },

  flipHint: {
    backgroundColor:
      "rgba(0, 0, 0, 0.55)",
    color: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    fontSize: 12,
  },

  detailsContainer: {
    flex: 1,
    paddingHorizontal:
      Spacing.md,
    paddingVertical:
      Spacing.md,
  },

  backHeader: {
    flexDirection:
      "row",
    alignItems:
      "flex-start",
    justifyContent:
      "space-between",
    marginBottom:
      Spacing.sm,
  },

  backHeaderText: {
    flex: 1,
    paddingRight:
      Spacing.sm,
  },

  backTitle: {
    fontSize: 21,
    fontWeight:
      "700",
    color: Colors.text,
    marginBottom: 2,
  },

  subcategory: {
    fontSize: 13,
    color: Colors.textLight,
  },

  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor:
      Colors.background,
    alignItems:
      "center",
    justifyContent:
      "center",
  },

  backButtonText: {
    fontSize: 19,
    color: Colors.text,
  },

  detailsList: {
    flex: 1,
    justifyContent:
      "space-evenly",
  },

  detailRow: {
    marginBottom: 5,
  },

  detailLabel: {
    fontSize: 10,
    fontWeight:
      "600",
    color: Colors.textLight,
    marginBottom: 1,
    textTransform:
      "uppercase",
  },

  detailValue: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.text,
  },

  flipBackHint: {
    textAlign:
      "center",
    fontSize: 10,
    color: Colors.textLight,
    marginTop: 3,
  },

  closeHint: {
    position:
      "absolute",
    bottom: Spacing.xxl,
    color: "#FFFFFF",
    fontSize: 13,
    zIndex: 102,
  },

  centerContainer: {
    flex: 1,
    backgroundColor:
      Colors.background,
    alignItems:
      "center",
    justifyContent:
      "center",
    paddingHorizontal:
      Spacing.xl,
  },

  statusText: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign:
      "center",
    marginTop:
      Spacing.md,
  },

  errorTitle: {
    ...Typography.heading,
    color: Colors.text,
    textAlign:
      "center",
  },

  retryButton: {
    marginTop:
      Spacing.lg,
    paddingHorizontal:
      Spacing.lg,
    paddingVertical:
      Spacing.sm,
    borderRadius: 20,
    backgroundColor:
      Colors.text,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight:
      "600",
  },

  emptyContainer: {
    alignItems:
      "center",
    justifyContent:
      "center",
    paddingVertical:
      Spacing.xxl,
    paddingHorizontal:
      Spacing.lg,
  },

  emptyTitle: {
    ...Typography.heading,
    color: Colors.text,
    textAlign:
      "center",
    marginBottom:
      Spacing.sm,
  },

  emptyText: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign:
      "center",
    maxWidth: 280,
  },

  resetButton: {
    marginTop:
      Spacing.lg,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor:
      Colors.text,
  },

  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight:
      "600",
  },
});