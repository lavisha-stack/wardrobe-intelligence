import Constants from "expo-constants";

const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

function getBackendUrl() {
  if (configuredBackendUrl) {
    return configuredBackendUrl.replace(/\/$/, "");
  }

  // In Expo Go, use the same LAN host that Metro is using.
  // This avoids hard-coding a computer's old Wi-Fi IP address.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];

  if (host) {
    return `http://${host}:8000`;
  }

  return "http://127.0.0.1:8000";
}

const BACKEND_URL = getBackendUrl();

export async function analyzeClothing(imageUrl) {
  const endpoint = `${BACKEND_URL}/analyze-clothing`;

  console.log("CALLING BACKEND ANALYZE:", endpoint);
  console.log("IMAGE URL SENT TO BACKEND:", imageUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
      }),
      signal: controller.signal,
    });

    console.log("BACKEND RESPONSE STATUS:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("BACKEND ERROR RESPONSE:", errorText);
      throw new Error(
        `AI analysis failed. Status: ${response.status}`
      );
    }

    const result = await response.json();
    console.log("BACKEND ANALYSIS RESULT:", result);
    return result;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "AI analysis took too long. Please check that the backend is reachable and try again."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
